import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

function normalizeSlug(slug: string) {
  return slug.toLowerCase().replace(/-/g, "");
}

function slugFromRequest(request: NextRequest, localSlug?: unknown) {
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
    .split(":")[0]
    .toLowerCase();

  const fallbackSlug = typeof localSlug === "string" ? localSlug.toLowerCase() : "";

  if (host === "localhost" || host === "127.0.0.1") {
    return fallbackSlug;
  }

  const [subdomain] = host.split(".");
  if (subdomain && subdomain !== "www") {
    return subdomain;
  }

  return fallbackSlug;
}

export async function POST(request: NextRequest) {
  if (!url || !secret) {
    return NextResponse.json({ error: "El registro todavía no está configurado en el servidor." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const slug = slugFromRequest(request, body?.orgSlug);
  const requestedRole =
    typeof body?.requestedRole === "string" &&
    ["servidor", "lider", "coordinador", "pastor", "admin", "superadmin"].includes(body.requestedRole.toLowerCase())
      ? body.requestedRole.toLowerCase()
      : "servidor";

  const problemas: string[] = [];
  if (!fullName) problemas.push("Nombre completo");
  if (!email) problemas.push("Correo electrónico");
  if (!password) problemas.push("Contraseña");
  else if (password.length < 8) problemas.push("Contraseña (mínimo 8 caracteres)");
  if (!slug) problemas.push("la iglesia asociada a este enlace");

  if (problemas.length > 0) {
    const detalle = problemas.map((p) => `"${p}"`).join(", ");
    return NextResponse.json(
      { error: `Faltan datos o son inválidos: revisa ${detalle}.` },
      { status: 400 }
    );
  }

  const supabase = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: allOrganizations, error: organizationsError } = await supabase.from("organizations").select("id, slug, signup_visible");
  if (organizationsError) {
    return NextResponse.json({ error: "No pudimos verificar la iglesia asociada a este enlace." }, { status: 500 });
  }
  const organization = (allOrganizations || []).find(
    (item) => normalizeSlug(item.slug) === normalizeSlug(slug) && item.signup_visible !== false
  );

  if (!organization) {
    return NextResponse.json({ error: "No encontramos una iglesia asociada a este enlace." }, { status: 404 });
  }

  const { data: createdUser, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, requested_role: requestedRole },
    app_metadata: { organization_id: organization.id },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Garantiza que el perfil quede asignado a la iglesia elegida aunque el
  // trigger de creación no haya aplicado el app_metadata.
  if (createdUser?.user) {
    const createdId = createdUser.user.id;
    const { data: profileExistente } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", createdId)
      .maybeSingle();

    if (profileExistente) {
      await supabase
        .from("profiles")
        .update({ organization_id: organization.id, email })
        .eq("id", createdId);
    } else {
      await supabase.from("profiles").insert({
        id: createdId,
        full_name: fullName,
        email,
        role: "servidor",
        requested_role: requestedRole === "servidor" ? null : requestedRole,
        organization_id: organization.id,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
