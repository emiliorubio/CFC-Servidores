import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { apiError, getSuperadminUserId } from "@/lib/platform-auth";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

const UPDATEABLE = [
  "name",
  "primary_color",
  "secondary_color",
  "signup_visible",
  "public_adoracion",
  "public_escuela",
  "plan",
] as const;

export async function GET(request: NextRequest) {
  const superUserId = await getSuperadminUserId(request);
  if (!superUserId) return apiError("Solo el superadmin puede acceder a la plataforma.", 403);
  if (!url || !secret) return apiError("Faltan credenciales del servidor.", 500);

  const service = createClient(url, secret, { auth: { persistSession: false } });
  const { data: orgs, error } = await service.from("organizations").select("*").order("name");
  if (error) return apiError("No se pudieron cargar las iglesias: " + error.message, 500);

  const withCounts = await Promise.all(
    (orgs || []).map(async (org) => {
      const countOf = async (table: string) => {
        const { count } = await service
          .from(table as "service_schedules")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org.id);
        return count ?? 0;
      };
      const [cultos, miembros, asignaciones] = await Promise.all([
        countOf("service_schedules"),
        countOf("church_members"),
        countOf("service_assignments"),
      ]);
      return { ...org, counts: { cultos, miembros, asignaciones } };
    })
  );

  return NextResponse.json({ orgs: withCounts });
}

export async function PATCH(request: NextRequest) {
  const superUserId = await getSuperadminUserId(request);
  if (!superUserId) return apiError("Solo el superadmin puede acceder a la plataforma.", 403);
  if (!url || !secret) return apiError("Faltan credenciales del servidor.", 500);

  const body = await request.json().catch(() => null);
  const orgId = body?.id;
  if (typeof orgId !== "string" || !orgId) return apiError("Falta el id de la iglesia.", 400);

  const changes: Record<string, unknown> = {};
  for (const key of UPDATEABLE) {
    if (body[key] !== undefined) changes[key] = body[key];
  }
  if (Object.keys(changes).length === 0) return apiError("No hay cambios que aplicar.", 400);

  const service = createClient(url, secret, { auth: { persistSession: false } });
  const { data, error } = await service
    .from("organizations")
    .update(changes)
    .eq("id", orgId)
    .select("id, name, slug, signup_visible, public_adoracion, public_escuela, plan")
    .maybeSingle();

  if (error) return apiError("No se pudo actualizar la iglesia: " + error.message, 500);
  return NextResponse.json({ org: data });
}

export async function DELETE(request: NextRequest) {
  const superUserId = await getSuperadminUserId(request);
  if (!superUserId) return apiError("Solo el superadmin puede acceder a la plataforma.", 403);
  if (!url || !secret) return apiError("Faltan credenciales del servidor.", 500);

  const orgId = new URL(request.url).searchParams.get("id");
  if (!orgId) return apiError("Falta el id de la iglesia.", 400);

  const service = createClient(url, secret, { auth: { persistSession: false } });

  const { data: org } = await service.from("organizations").select("id, name").eq("id", orgId).maybeSingle();
  if (!org) return apiError("No encontramos la iglesia.", 404);

  // Eliminar primero las cuentas de esa iglesia (nunca al superadmin).
  const { data: perfiles } = await service.from("profiles").select("id, role").eq("organization_id", orgId);
  let cuentas = 0;
  for (const p of perfiles || []) {
    if (p.role === "superadmin") continue;
    const { error } = await service.auth.admin.deleteUser(p.id);
    if (!error) cuentas += 1;
  }

  const { error } = await service.from("organizations").delete().eq("id", orgId);
  if (error) return apiError("No se pudo eliminar la iglesia: " + error.message, 500);

  return NextResponse.json({ ok: true, cuentas_eliminadas: cuentas });
}