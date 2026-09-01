import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

function slugFromRequest(request: NextRequest, localSlug?: unknown) {
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
    .split(":")[0]
    .toLowerCase();

  if (host === "localhost" || host === "127.0.0.1") {
    return typeof localSlug === "string" ? localSlug.toLowerCase() : null;
  }

  const [subdomain] = host.split(".");
  return subdomain && subdomain !== "www" ? subdomain : null;
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

  if (!fullName || !email || !password || password.length < 8 || !slug) {
    return NextResponse.json({ error: "Completa nombre, correo, contraseña y abre el enlace de una iglesia válida." }, { status: 400 });
  }

  const supabase = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (organizationError || !organization) {
    return NextResponse.json({ error: "No encontramos una iglesia asociada a este enlace." }, { status: 404 });
  }

  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { organization_id: organization.id },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
