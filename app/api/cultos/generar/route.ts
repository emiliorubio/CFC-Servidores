import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

interface PatronSlot {
  weekday: number;
  time: string;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request: NextRequest) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || !url || !anonKey) {
    return NextResponse.json({ error: "Debes iniciar sesión para generar cultos." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { orgId, meses } = body || {};
  if (typeof orgId !== "string" || !orgId) {
    return NextResponse.json({ error: "Falta la iglesia." }, { status: 400 });
  }
  const cantidad = Number(meses);
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 3) {
    return NextResponse.json({ error: "Indica 1 o 2 meses a generar." }, { status: 400 });
  }

  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, service_pattern")
    .eq("id", orgId)
    .maybeSingle();

  if (orgError || !org) {
    return NextResponse.json({ error: "No se encontró la iglesia." }, { status: 404 });
  }

  const patron = (org.service_pattern || []) as PatronSlot[];
  if (patron.length === 0) {
    return NextResponse.json(
      { error: "Esta iglesia aún no tiene horarios de culto configurados." },
      { status: 400 }
    );
  }

  // Rango: desde hoy (local) hasta el último día del mes + cantidad.
  const hoy = new Date();
  const fin = new Date(hoy.getFullYear(), hoy.getMonth() + cantidad + 1, 0);

  const fechasAProgramar: string[] = [];
  for (let d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()); d <= fin; d.setDate(d.getDate() + 1)) {
    const slot = patron.find((p) => p.weekday === d.getDay());
    if (!slot || !slot.time) continue;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    fechasAProgramar.push(`${y}-${m}-${day}T${slot.time}:00`);
  }

  if (fechasAProgramar.length === 0) {
    return NextResponse.json({ error: "No hay fechas que programar en este período." }, { status: 400 });
  }

  // No duplicar: consultamos las fechas ya existentes en el rango.
  const rangoDesde = `${fechasAProgramar[0].split("T")[0]}`;
  const rangoHasta = `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, "0")}-${String(fin.getDate()).padStart(2, "0")}`;
  const { data: existentesData, error: existentesError } = await supabase
    .from("service_schedules")
    .select("service_date")
    .eq("organization_id", org.id)
    .gte("service_date", `${rangoDesde}T00:00:00`)
    .lte("service_date", `${rangoHasta}T23:59:59`);

  if (existentesError) {
    return NextResponse.json({ error: "No se pudo verificar los cultos existentes." }, { status: 500 });
  }

  const existentes = new Set((existentesData || []).map((s) => String(s.service_date).slice(0, 16)));
  const nuevos = fechasAProgramar.filter((f) => !existentes.has(f));

  if (nuevos.length === 0) {
    return NextResponse.json({
      creados: 0,
      yaExistentes: fechasAProgramar.length,
      message: "Todos los cultos de este período ya están programados.",
    });
  }

  const filas = nuevos.map((service_date) => ({
    title: "Culto General",
    service_date,
    description: `Culto general semanal de ${org.name}.`,
    organization_id: org.id,
  }));

  const { error: insertError } = await supabase.from("service_schedules").insert(filas);
  if (insertError) {
    return NextResponse.json({ error: "No se pudieron guardar los cultos: " + insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    creados: filas.length,
    yaExistentes: fechasAProgramar.length - filas.length,
    message: `Se programaron ${filas.length} cultos en ${org.name}.`,
  });
}