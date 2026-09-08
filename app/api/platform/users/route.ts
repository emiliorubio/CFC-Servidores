import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { apiError, getSuperadminUserId } from "@/lib/platform-auth";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

const ALLOWED_ROLES = ["servidor", "lider", "admin", "coordinador", "pastor", "tesorero", "superadmin"];

export async function GET(request: NextRequest) {
  const superUserId = await getSuperadminUserId(request);
  if (!superUserId) return apiError("Solo el superadmin puede acceder a la plataforma.", 403);
  if (!url || !secret) return apiError("Faltan credenciales del servidor.", 500);

  const service = createClient(url, secret, { auth: { persistSession: false } });

  const [{ data: usersPage }, { data: profiles }, { data: orgs }] = await Promise.all([
    service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    service.from("profiles").select("id, full_name, role, organization_id"),
    service.from("organizations").select("id, name, slug"),
  ]);

  const orgNames = new Map((orgs || []).map((o) => [o.id, o.name]));
  const profileByUser = new Map((profiles || []).map((p) => [p.id, p]));

  const users = (usersPage?.users || []).map((u) => {
    const profile = profileByUser.get(u.id);
    return {
      id: u.id,
      email: u.email || "",
      full_name: profile?.full_name || u.user_metadata?.full_name || "",
      role: profile?.role || "servidor",
      organization_id: profile?.organization_id || null,
      organization_name: profile?.organization_id ? orgNames.get(profile.organization_id) || null : null,
    };
  });

  users.sort((a, b) => (a.organization_name || "").localeCompare(b.organization_name || "") || a.email.localeCompare(b.email));
  return NextResponse.json({ users });
}

export async function PATCH(request: NextRequest) {
  const superUserId = await getSuperadminUserId(request);
  if (!superUserId) return apiError("Solo el superadmin puede acceder a la plataforma.", 403);
  if (!url || !secret) return apiError("Faltan credenciales del servidor.", 500);

  const body = await request.json().catch(() => null);
  const userId = body?.userId;
  const role = body?.role;
  if (typeof userId !== "string" || !userId) return apiError("Falta el id del usuario.", 400);
  if (typeof role !== "string" || !ALLOWED_ROLES.includes(role)) {
    return apiError("Rol no válido.", 400);
  }
  if (userId === superUserId && role !== "superadmin") {
    return apiError("No puedes quitarte el rol de superadmin a ti mismo.", 400);
  }

  const service = createClient(url, secret, { auth: { persistSession: false } });

  const { data: existing } = await service
    .from("profiles")
    .select("id, full_name, organization_id")
    .eq("id", userId)
    .maybeSingle();

  const { error } = await service.from("profiles").upsert(
    {
      id: userId,
      full_name: existing?.full_name || null,
      organization_id: existing?.organization_id || null,
      role,
    },
    { onConflict: "id" }
  );

  if (error) return apiError("No se pudo actualizar el rol: " + error.message, 500);
  return NextResponse.json({ ok: true, role });
}