import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { apiError, getAuthUser } from "@/lib/platform-auth";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

interface KitItem {
  nombre: string;
  precio: number;
  cantidad: number;
}

function makeService() {
  return createClient(url || "", secret || "", { auth: { persistSession: false } });
}

/** Fecha local (YYYY-MM-DD) de hoy en Chile (America/Santiago), sin depender del huso del servidor. */
function fechaDeHoyEnChile(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Instante UTC (ISO) equivalente a las 00:00 de hoy en Chile. */
function inicioDeHoyEnChile(): string {
  const ahora = Date.now();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [fecha] = formatter.format(new Date(ahora)).split(", ");
  const [mes, dia, anio] = fecha.split("/").map(Number);
  const guess = Date.UTC(anio, mes - 1, dia, 0, 0);
  const [pFecha, pHora] = formatter.format(new Date(guess)).split(", ");
  const [pMes, pDia, pAnio] = pFecha.split("/").map(Number);
  let horaP = Number(pHora.slice(0, 2));
  if (horaP === 24) horaP = 0;
  const minP = Number(pHora.slice(3, 5));
  const targetMin = anio * 525600 + (mes - 1) * 43800 + dia * 1440;
  const santiagoMin = pAnio * 525600 + (pMes - 1) * 43800 + pDia * 1440 + horaP * 60 + minP;
  return new Date(guess - (santiagoMin - targetMin) * 60000).toISOString();
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!url || !secret) return apiError("Faltan credenciales del servidor.", 500);
  if (!user?.organization_id) return apiError("Tu cuenta no tiene iglesia asignada.", 403);

  const service = makeService();
  const startOfDay = inicioDeHoyEnChile();

  const { data, error } = await service
    .from("cafeteria_ventas")
    .select(
      "id, metodo, total, cliente, created_by, created_at, cafeteria_venta_items(id, venta_id, producto_id, nombre, precio, cantidad)"
    )
    .eq("organization_id", user.organization_id)
    .gte("created_at", startOfDay)
    .order("created_at", { ascending: false });

  if (error) return apiError("No se pudieron cargar las ventas: " + error.message, 500);
  const ventas = (data || []).map((v) => ({
    ...v,
    items: (v as unknown as { cafeteria_venta_items: KitItem[] }).cafeteria_venta_items || [],
  }));
  return NextResponse.json({ ventas });
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!url || !secret) return apiError("Faltan credenciales del servidor.", 500);
  if (!user?.organization_id) return apiError("Tu cuenta no tiene iglesia asignada.", 403);

  const body = await request.json().catch(() => null);
  const items: KitItem[] = Array.isArray(body?.items) ? body.items : [];
  const metodo = body?.metodo === "Tarjeta" ? "Tarjeta" : "Efectivo";
  const cliente = typeof body?.cliente === "string" ? body.cliente.trim() : "";

  if (items.length === 0) return apiError("La venta no tiene artículos.", 400);

  const total = items.reduce((acc, i) => acc + Number(i.precio) * Number(i.cantidad || 1), 0);
  if (total <= 0) return apiError("El total de la venta debe ser mayor a $0.", 400);

  const servicio = makeService();
  const detalle = items.map((i) => `${i.cantidad}x ${i.nombre}`).join(", ");

  const { data: mov, error: errMov } = await servicio
    .from("transacciones")
    .insert({
      organization_id: user.organization_id,
      tipo: "ingreso",
      categoria: "Cafetería",
      descripcion: `[Cafetería] ${detalle}${cliente ? ` · Cliente: ${cliente}` : ""} (Pago: ${metodo})`,
      monto: total,
      fecha: fechaDeHoyEnChile(),
      creado_por: user.id,
    })
    .select("id")
    .single();

  if (errMov) return apiError("No se pudo registrar el ingreso: " + errMov.message, 500);

  const { data: venta, error: errVenta } = await servicio
    .from("cafeteria_ventas")
    .insert({
      organization_id: user.organization_id,
      metodo,
      total,
      cliente: cliente || null,
      transaccion_id: mov.id,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (errVenta) return apiError("No se pudo guardar la venta: " + errVenta.message, 500);

  const rows = items.map((i) => ({
    venta_id: venta.id,
    organization_id: user.organization_id,
    nombre: i.nombre,
    precio: i.precio,
    cantidad: i.cantidad || 1,
  }));
  const { error: errItems } = await servicio.from("cafeteria_venta_items").insert(rows);
  if (errItems) return apiError("No se pudieron guardar los artículos: " + errItems.message, 500);

  return NextResponse.json({ ok: true, ventaId: venta.id, total });
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!url || !secret) return apiError("Faltan credenciales del servidor.", 500);
  if (!user?.organization_id) return apiError("Tu cuenta no tiene iglesia asignada.", 403);

  const body = await request.json().catch(() => null);
  const { action, ventaId } = body || {};
  if (typeof ventaId !== "string" || !ventaId) return apiError("Falta la venta.", 400);

  const servicio = makeService();

  if (action === "deleteItem") {
    const itemId = body.itemId;
    if (typeof itemId !== "string" || !itemId) return apiError("Falta el artículo.", 400);
    const { error } = await servicio
      .from("cafeteria_venta_items")
      .delete()
      .eq("id", itemId)
      .eq("venta_id", ventaId)
      .eq("organization_id", user.organization_id);
    if (error) return apiError("No se pudo eliminar el artículo: " + error.message, 500);
    return await recomputarVenta(servicio, ventaId, user.organization_id);
  }

  if (action === "deleteVenta") {
    const { data: venta, error: errVenta } = await servicio
      .from("cafeteria_ventas")
      .select("id, transaccion_id")
      .eq("id", ventaId)
      .eq("organization_id", user.organization_id)
      .maybeSingle();
    if (errVenta) return apiError("No se pudo leer la venta: " + errVenta.message, 500);
    if (!venta) return apiError("Venta no encontrada.", 404);

    const { error: errDel } = await servicio
      .from("cafeteria_ventas")
      .delete()
      .eq("id", ventaId)
      .eq("organization_id", user.organization_id);
    if (errDel) return apiError("No se pudo eliminar la venta: " + errDel.message, 500);

    if (venta.transaccion_id) {
      await servicio.from("transacciones").delete().eq("id", venta.transaccion_id);
    }
    return NextResponse.json({ ok: true });
  }

  return apiError("Acción no válida.", 400);
}

async function recomputarVenta(servicio: ReturnType<typeof makeService>, ventaId: string, orgId: string) {
  const { data: items } = await servicio
    .from("cafeteria_venta_items")
    .select("id, nombre, precio, cantidad")
    .eq("venta_id", ventaId)
    .eq("organization_id", orgId);

  const rest = items || [];
  const total = rest.reduce((acc, i) => acc + Number(i.precio) * Number(i.cantidad), 0);

  if (rest.length === 0) {
    const { data: venta } = await servicio
      .from("cafeteria_ventas")
      .select("transaccion_id")
      .eq("id", ventaId)
      .eq("organization_id", orgId)
      .maybeSingle();
    await servicio.from("cafeteria_ventas").delete().eq("id", ventaId).eq("organization_id", orgId);
    if (venta?.transaccion_id) {
      await servicio.from("transacciones").delete().eq("id", venta.transaccion_id);
    }
    return NextResponse.json({ ok: true, anulada: true });
  }

  const { data: venta } = await servicio
    .from("cafeteria_ventas")
    .select("metodo, transaccion_id")
    .eq("id", ventaId)
    .eq("organization_id", orgId)
    .maybeSingle();
  await servicio.from("cafeteria_ventas").update({ total }).eq("id", ventaId).eq("organization_id", orgId);

  if (venta?.transaccion_id) {
    const detalle = rest.map((i) => `${i.cantidad}x ${i.nombre}`).join(", ");
    await servicio
      .from("transacciones")
      .update({
        monto: total,
        descripcion: `[Cafetería] ${detalle} (Pago: ${venta.metodo})`,
      })
      .eq("id", venta.transaccion_id);
  }

  return NextResponse.json({ ok: true, total });
}