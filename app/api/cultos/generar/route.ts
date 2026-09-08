import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

interface PatronSlot {
  weekday: number;
  time: string;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Lee un instante y devuelve sus componentes en hora de Chile (America/Santiago). */
function parseEnSantiago(instant: number): {
  y: number;
  m: number;
  d: number;
  hh: number;
  mm: number;
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [fecha, hora] = fmt.format(new Date(instant)).split(", ");
  const [mes, dia, anio] = fecha.split("/").map(Number);
  let horaInt = Number(hora.slice(0, 2));
  const minuto = Number(hora.slice(3, 5));
  if (horaInt === 24) horaInt = 0;
  return { y: anio, m: mes - 1, d: dia, hh: horaInt, mm: minuto };
}

/**
 * Conversión de una hora LOCAL de Santiago a UTC. Como Chile usa horario de
 * verano (UTC-4/UTC-3), se calcula con Intl para que cada culto quede en el
 * instante correcto sin importar el huso horario del servidor (Vercel = UTC).
 *
 * Método: se parte del supuesto "UTC wall = local wall" y se corrige con el
 * desfase real de Santiago en ese instante: instant = guess - deltaMin*60000.
 */
function santiagoLocalToUtc(y: number, m: number, d: number, hh: number, mm: number): number {
  const guess = Date.UTC(y, m, d, hh, mm);
  const p = parseEnSantiago(guess);
  const targetMin = y * 525600 + m * 43800 + d * 1440 + hh * 60 + mm;
  const santiagoMin = p.y * 525600 + p.m * 43800 + p.d * 1440 + p.hh * 60 + p.mm;
  return guess - (santiagoMin - targetMin) * 60000;
}

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

  // Hoy y fin del período en hora de Chile.
  const hoyLocal = parseEnSantiago(Date.now());
  const fin = new Date(
    santiagoLocalToUtc(
      hoyLocal.y,
      hoyLocal.m + cantidad + 1,
      0,
      12,
      0
    )
  );

  const fechasAProgramar: string[] = [];
  for (let d = new Date(hoyLocal.y, hoyLocal.m, hoyLocal.d); d <= fin; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = d.getMonth();
    const day = d.getDate();
    const weekday = new Date(y, m, day).getDay();
    const slot = patron.find((p) => p.weekday === weekday);
    if (!slot || !slot.time) continue;
    const [hh, mm] = slot.time.split(":").map(Number);
    fechasAProgramar.push(new Date(santiagoLocalToUtc(y, m, day, hh, mm)).toISOString());
  }

  if (fechasAProgramar.length === 0) {
    return NextResponse.json({ error: "No hay fechas que programar en este período." }, { status: 400 });
  }

  // No duplicar: cargamos las fechas existentes de la iglesia y comparamos por
  // los primeros 16 caracteres del instante ("YYYY-MM-DDTHH:MM").
  const { data: existentesData, error: existentesError } = await supabase
    .from("service_schedules")
    .select("service_date")
    .eq("organization_id", org.id);

  if (existentesError) {
    return NextResponse.json({ error: "No se pudo verificar los cultos existentes." }, { status: 500 });
  }

  const existentes = new Set((existentesData || []).map((s) => String(s.service_date).slice(0, 16)));
  const nuevos = fechasAProgramar.filter((f) => !existentes.has(f.slice(0, 16)));

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