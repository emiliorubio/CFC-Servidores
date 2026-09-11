import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: NextRequest) {
  if (!url || !secret) {
    return NextResponse.json({ error: "El servidor no está configurado para enviar correos." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : "";

  if (!requestId) {
    return NextResponse.json({ error: "Falta la solicitud." }, { status: 400 });
  }

  // Solo superadmin.
  const token = request.headers.get("authorization")?.replace("Bearer ", "") || "";
  const supabase = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData } = await supabase.auth.getUser(token);
  if (!authData.user) {
    return NextResponse.json({ error: "No autorizado. Inicia sesión como superadmin." }, { status: 401 });
  }
  const { data: perfil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (perfil?.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado. Solo el superadmin gestiona accesos de prueba." }, { status: 403 });
  }

  const { data: solicitud, error: solicitudError } = await supabase
    .from("trial_requests")
    .select("full_name, email, status")
    .eq("id", requestId)
    .maybeSingle();
  if (solicitudError || !solicitud) {
    return NextResponse.json({ error: "No encontramos la solicitud de prueba." }, { status: 404 });
  }
  if (solicitud.status !== "aprobado") {
    return NextResponse.json(
      { error: "Primero autoriza la solicitud para poder enviar el correo de bienvenida." },
      { status: 409 }
    );
  }

  // Supabase envía el correo automáticamente (plantilla "Reset Password" de
  // Recuperación), con un enlace que lleva a /bienvenida para crear la clave.
  const origin = new URL(request.url).origin;
  const { error: sendError } = await supabase.auth.resetPasswordForEmail(solicitud.email, {
    redirectTo: origin + "/bienvenida",
  });

  if (sendError) {
    return NextResponse.json(
      { error: "No se pudo enviar el correo: " + sendError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, email: solicitud.email });
}