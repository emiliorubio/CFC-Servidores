import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  if (!url || !secret) {
    return NextResponse.json({ error: "El registro de solicitudes no está configurado en el servidor." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim().slice(0, 120) : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  const churchName = typeof body?.churchName === "string" ? body.churchName.trim().slice(0, 120) : "";
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 1000) : "";

  const problemas: string[] = [];
  if (!fullName) problemas.push("Nombre completo");
  if (!email || !EMAIL_RE.test(email)) problemas.push("Correo electrónico válido");
  if (!churchName) problemas.push("Nombre de la iglesia");

  if (problemas.length > 0) {
    return NextResponse.json(
      { error: "Faltan datos o son inválidos: revisa " + problemas.map((p) => `"${p}"`).join(", ") + "." },
      { status: 400 }
    );
  }

  const supabase = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await supabase.from("trial_requests").insert({
    full_name: fullName,
    email,
    church_name: churchName,
    message,
  });

  if (error) {
    return NextResponse.json({ error: "No pudimos registrar tu solicitud. Inténtalo de nuevo más tarde." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}