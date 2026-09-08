import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { apiError, getSuperadminUserId } from "@/lib/platform-auth";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

export async function GET(request: NextRequest) {
  const superUserId = await getSuperadminUserId(request);
  if (!superUserId) return apiError("Solo el superadmin puede acceder a la plataforma.", 403);
  if (!url || !secret) return apiError("Faltan credenciales del servidor.", 500);

  const service = createClient(url, secret, { auth: { persistSession: false } });
  const { data, error } = await service.rpc("check_migrations");

  if (error) {
    const hint = error.message.includes("function") || error.message.includes("could not find")
      ? " Faltó aplicar la migración 20260922_migrations_diagnostics.sql en el SQL Editor."
      : "";
    return apiError("No se pudo ejecutar el diagnóstico: " + error.message + hint, 500);
  }
  return NextResponse.json({ checks: (data || []) as { key: string; label: string; applied: boolean; source: string }[] });
}