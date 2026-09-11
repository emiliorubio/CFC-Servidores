import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

function generarClaveTemporal(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let clave = "";
  for (let i = 0; i < 10; i++) {
    clave += chars[Math.floor(Math.random() * chars.length)];
  }
  return clave;
}

export async function POST(request: NextRequest) {
  if (!url || !secret) {
    return NextResponse.json({ error: "El servidor no está configurado para autorizar accesos." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : "";
  const orgId = typeof body?.orgId === "string" ? body.orgId.trim() : "";

  if (!requestId || !orgId) {
    return NextResponse.json({ error: "Faltan datos de la solicitud o de la iglesia." }, { status: 400 });
  }

  // Solo el superadmin puede autorizar accesos.
  const token = request.headers.get("authorization")?.replace("Bearer ", "") || "";
  const supabaseUser = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await supabaseUser.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: "No autorizado. Inicia sesión como superadmin." }, { status: 401 });
  }

  const { data: perfil, error: perfilError } = await supabaseUser
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (perfilError || perfil?.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado. Solo el superadmin gestiona accesos de prueba." }, { status: 403 });
  }

  const { data: solicitud, error: solicitudError } = await supabaseUser
    .from("trial_requests")
    .select("id, full_name, email, status")
    .eq("id", requestId)
    .maybeSingle();
  if (solicitudError || !solicitud) {
    return NextResponse.json({ error: "No encontramos la solicitud de prueba." }, { status: 404 });
  }
  if (solicitud.status !== "pendiente") {
    return NextResponse.json({ error: "Esta solicitud ya fue gestionada." }, { status: 409 });
  }

  const clave = generarClaveTemporal();

  const { data: creado, error: createError } = await supabaseUser.auth.admin.createUser({
    email: solicitud.email.toLowerCase(),
    password: clave,
    email_confirm: true,
    user_metadata: { full_name: solicitud.full_name, requested_role: "admin" },
    app_metadata: { organization_id: orgId },
  });
  if (createError) {
    return NextResponse.json(
      { error: createError.message.includes("already registered") ? "Ese correo ya tiene una cuenta en la plataforma." : createError.message },
      { status: 400 }
    );
  }

  if (creado?.user) {
    const perfilId = creado.user.id;
    // El perfil ya puede existir (trigger de creación de usuario) o no: upsert
    // garantiza que quede con rol Admin y la iglesia elegida, sin importar cuál.
    const { error: upsertError } = await supabaseUser.from("profiles").upsert(
      {
        id: perfilId,
        full_name: solicitud.full_name,
        email: solicitud.email.toLowerCase(),
        role: "admin",
        requested_role: "admin",
        organization_id: orgId,
      },
      { onConflict: "id" }
    );
    if (upsertError) {
      return NextResponse.json(
        { error: "Cuenta creada, pero no se pudo asignar la iglesia: " + upsertError.message },
        { status: 500 }
      );
    }
  }

  await supabaseUser
    .from("trial_requests")
    .update({ status: "aprobado", approved_at: new Date().toISOString() })
    .eq("id", requestId);

  return NextResponse.json({ ok: true, email: solicitud.email.toLowerCase(), password: clave });
}