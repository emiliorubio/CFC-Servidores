import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;

/**
 * Valida que la petición venga de un superadmin autenticado. Devuelve su id o
 * null. La verificación se hace con el rol de profiles (service role), así un
 * usuario normal no puede suplantar permisos de plataforma aunque invente un
 * token.
 */
export async function getSuperadminUserId(request: NextRequest): Promise<string | null> {
  if (!url || !anonKey || !secret) return null;
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error,
  } = await anon.auth.getUser(token);
  if (error || !user) return null;

  const service = createClient(url, secret, { auth: { persistSession: false } });
  const { data } = await service
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .eq("role", "superadmin")
    .maybeSingle();
  return data?.id ?? null;
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}