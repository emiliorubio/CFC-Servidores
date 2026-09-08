"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/context/OrganizationContext";
import { formatearPesos } from "@/lib/format";
import RestrictedAccess from "@/components/RestrictedAccess";

interface Producto {
  id: string;
  organization_id: string;
  nombre: string;
  precio: number;
  activo: boolean;
}

interface VentaItem {
  id: string;
  venta_id: string;
  producto_id: string | null;
  nombre: string;
  precio: number;
  cantidad: number;
}

interface Venta {
  id: string;
  metodo: string;
  total: number;
  cliente: string | null;
  created_by: string | null;
  created_at: string;
  items: VentaItem[];
}

const METODOS = ["Efectivo", "Tarjeta"];

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- instancia del escáner (introducida con import dinámico)
let scannerInstance: any = null;

export default function CafeteriaKiosco() {
  const { org, loading, userRole, userProfile } = useOrganization();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [productosOk, setProductosOk] = useState(false);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [ventasOk, setVentasOk] = useState(false);

  const [carrito, setCarrito] = useState<Record<string, number>>({});
  const [metodo, setMetodo] = useState("Efectivo");
  const [cliente, setCliente] = useState("");
  const [recibido, setRecibido] = useState("");
  const [registrando, setRegistrando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const [gestion, setGestion] = useState(false);
  const [editando, setEditando] = useState<Producto | "nuevo" | null>(null);
  const [borrandoProducto, setBorrandoProducto] = useState<Producto | null>(null);
  const [borrandoVenta, setBorrandoVenta] = useState<Venta | null>(null);

  const [scanAbierto, setScanAbierto] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const scanRef = useRef<HTMLDivElement>(null);

  const [menuAbierto, setMenuAbierto] = useState(false);
  const [qrs, setQrs] = useState<Record<string, string>>({});

  const canManageMenu = ["superadmin", "admin", "pastor", "lider", "coordinador"].includes(userRole);
  const primaryColor = org?.primary_color || "#0f172a";
  const inactive = productos.filter((p) => !p.activo);

  const cargarProductos = useCallback(async () => {
    if (!org) return;
    const { data } = await supabase
      .from("cafeteria_productos")
      .select("id, organization_id, nombre, precio, activo")
      .eq("organization_id", org.id)
      .order("nombre");
    setProductos(data || []);
    setProductosOk(true);
  }, [org]);

  const cargarVentas = useCallback(async () => {
    if (!org) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || "";
    try {
      const res = await fetch("/api/cafeteria", { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      setVentas(Array.isArray(json.ventas) ? json.ventas : []);
    } catch {
      setVentas([]);
    }
    setVentasOk(true);
  }, [org]);

  useEffect(() => {
    if (!org) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de menú y ventas
    cargarProductos();
    cargarVentas();
  }, [org, cargarProductos, cargarVentas]);

  const api = useCallback(async (method: string, body?: object) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || "";
    const res = await fetch("/api/cafeteria", {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, json };
  }, []);

  const totalVenta = Object.entries(carrito).reduce((acc, [id, cant]) => {
    const p = productos.find((x) => x.id === id);
    return acc + (cant || 0) * (p?.precio || 0);
  }, 0);
  const cantidadItems = Object.values(carrito).reduce((a, b) => a + b, 0);
  const efectivo = parseFloat(recibido);
  const vuelto = !isNaN(efectivo) && efectivo >= totalVenta ? efectivo - totalVenta : null;

  const agregar = (id: string) => setCarrito((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const quitar = (id: string) =>
    setCarrito((c) => {
      const q = (c[id] || 0) - 1;
      const n = { ...c };
      if (q <= 0) delete n[id];
      else n[id] = q;
      return n;
    });

  const registrarVenta = async () => {
    if (totalVenta <= 0) return;
    setRegistrando(true);
    setMensaje(null);
    const items = Object.entries(carrito)
      .map(([id, cant]) => {
        const p = productos.find((x) => x.id === id);
        return p ? { nombre: p.nombre, precio: p.precio, cantidad: cant } : null;
      })
      .filter(Boolean) as { nombre: string; precio: number; cantidad: number }[];

    const { ok, json } = await api("POST", { items, metodo, cliente });
    if (!ok) {
      setMensaje({ tipo: "error", texto: json.error || "No se pudo registrar la venta." });
      setRegistrando(false);
      return;
    }
    setMensaje({ tipo: "ok", texto: `✅ Venta registrada por ${formatearPesos(json.total)}` });
    setCarrito({});
    setCliente("");
    setRecibido("");
    setRegistrando(false);
    cargarVentas();
  };

  const borrarItem = async (venta: Venta, item: VentaItem) => {
    if (!window.confirm(`¿Eliminar "${item.cantidad}x ${item.nombre}" de la venta de las ${formatHora(venta.created_at)}?`)) return;
    const { ok, json } = await api("PATCH", { action: "deleteItem", ventaId: venta.id, itemId: item.id });
    if (!ok) {
      setMensaje({ tipo: "error", texto: json.error || "No se pudo corregir la venta." });
      return;
    }
    setMensaje({
      tipo: "ok",
      texto: json.anulada ? "ℹ️ La venta quedó vacía y fue anulada." : `✅ Artículo eliminado. Total corregido a ${formatearPesos(json.total)}`,
    });
    cargarVentas();
  };

  const borrarVenta = async () => {
    if (!borrandoVenta) return;
    setMensaje(null);
    const { ok, json } = await api("PATCH", { action: "deleteVenta", ventaId: borrandoVenta.id });
    if (!ok) {
      setMensaje({ tipo: "error", texto: json.error || "No se pudo eliminar la venta." });
      setBorrandoVenta(null);
      return;
    }
    setMensaje({ tipo: "ok", texto: "🗑️ Venta eliminada (su ingreso también se quitó de Finanzas)." });
    setBorrandoVenta(null);
    cargarVentas();
  };

  const guardarProducto = async () => {
    if (!editando || typeof editando === "string") return;
    if (!editando.nombre.trim() || editando.precio < 0) return;
    const payload = { nombre: editando.nombre.trim(), precio: editando.precio };
    if (editando.id) {
      await supabase.from("cafeteria_productos").update(payload).eq("id", editando.id).eq("organization_id", org!.id);
    } else {
      await supabase.from("cafeteria_productos").insert({ ...payload, organization_id: org!.id });
    }
    setEditando(null);
    cargarProductos();
  };

  const eliminarProducto = async () => {
    if (!borrandoProducto) return;
    await supabase.from("cafeteria_productos").delete().eq("id", borrandoProducto.id).eq("organization_id", org!.id);
    setBorrandoProducto(null);
    cargarProductos();
  };

  const toggleActivo = async (p: Producto) => {
    await supabase.from("cafeteria_productos").update({ activo: !p.activo }).eq("id", p.id).eq("organization_id", org!.id);
    cargarProductos();
  };

  const abrirScanner = async () => {
    setScanMsg(null);
    setScanAbierto(true);
  };

  const cerrarScanner = async () => {
    if (scannerInstance) {
      try {
        await scannerInstance.stop();
      } catch {
        // ya detenido
      }
      scannerInstance = null;
    }
    setScanAbierto(false);
    setScanMsg(null);
  };

  const iniciarScaner = async () => {
    if (!scanRef.current) return;
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (scannerInstance) {
        try {
          await scannerInstance.stop();
        } catch {
          // se ignora
        }
      }
      scannerInstance = new Html5Qrcode("lector-qr");
      await scannerInstance.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (txt: string) => {
          const p = productos.find((x) => x.id === txt.trim());
          if (p) {
            if (!p.activo) {
              setScanMsg(`⚠️ "${p.nombre}" está oculto del menú.`);
              return;
            }
            agregar(p.id);
            setScanMsg(`✅ Agregado: ${p.nombre}`);
            setTimeout(() => setScanMsg(null), 1500);
          } else {
            setScanMsg("❌ Código no corresponde a un producto de este menú.");
          }
        },
        () => {
          // cuadro no detectado aún
        }
      );
    } catch {
      setScanMsg("⚠️ No se pudo acceder a la cámara. Verifica los permisos del navegador.");
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- inicia el escáner solo al abrir el modal
    if (scanAbierto) iniciarScaner();
    return () => {
      if (scannerInstance) {
        try {
          scannerInstance.stop();
        } catch {
          // se ignora
        }
        scannerInstance = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanAbierto]);

  const abrirMenu = async () => {
    setMenuAbierto(true);
    const mapa: Record<string, string> = {};
    const { default: QRCode } = await import("qrcode");
    for (const p of productos.filter((x) => x.activo)) {
      try {
        mapa[p.id] = await QRCode.toDataURL(p.id, { width: 260, margin: 1 });
      } catch {
        // se deja sin QR
      }
    }
    setQrs(mapa);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm font-semibold text-slate-500">Cargando…</div>
      </div>
    );
  }
  if (!org) return <RestrictedAccess message="Debes tener una iglesia asignada para operar el kiosco de cafetería." />;

  const productosVisibles = productos.filter((p) => p.activo);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 px-4 py-3 text-white shadow-md" style={{ backgroundColor: primaryColor }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <Link href="/finanzas" className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold transition-colors hover:bg-white/30">
            ← Finanzas
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold leading-tight">☕ Cafetería</h1>
            <p className="truncate text-[10px] text-white/80">
              {org.name} · {new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={abrirMenu} className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold transition-colors hover:bg-white/30">
              🖨️ Menú QR
            </button>
            <button onClick={abrirScanner} className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold transition-colors hover:bg-white/30">
              📷 Escáner
            </button>
            {canManageMenu && (
              <button onClick={() => setGestion((g) => !g)} className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold transition-colors hover:bg-white/30">
                {gestion ? "✅ Listo" : "⚙️ Menú"}
              </button>
            )}
          </div>
        </div>
      </header>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #menu-imprimir, #menu-imprimir * { visibility: visible; }
          #menu-imprimir { position: absolute; inset: 0; display: block !important; }
        }
      `}</style>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_360px]">
        {/* Columna principal */}
        <section>
          {mensaje && (
            <div
              className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                mensaje.tipo === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {mensaje.texto}
            </div>
          )}

          {!productosOk ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Cargando menú…</div>
          ) : productosVisibles.length === 0 && !gestion ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
              <div className="text-3xl">🍵</div>
              <p className="mt-2 text-sm font-semibold text-slate-700">Aún no hay productos en el menú.</p>
              {canManageMenu && (
                <button
                  onClick={() => setEditando("nuevo")}
                  style={{ backgroundColor: primaryColor }}
                  className="mt-4 rounded-xl px-4 py-2 text-xs font-bold text-white"
                >
                  ➕ Agregar producto
                </button>
              )}
            </div>
          ) : (gestion ? productos : productosVisibles).length > 0 ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Productos</h2>
                {gestion && canManageMenu && (
                  <button onClick={() => setEditando("nuevo")} style={{ backgroundColor: primaryColor }} className="rounded-lg px-3 py-1.5 text-xs font-bold text-white">
                    ➕ Agregar
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {(gestion ? productos : productosVisibles).map((p) => {
                  const cant = carrito[p.id] || 0;
                  return (
                    <div
                      key={p.id}
                      className={`flex flex-col rounded-2xl border bg-white p-3 shadow-sm ${
                        !p.activo ? "border-slate-200 opacity-55" : "border-slate-200"
                      }`}
                    >
                      <button onClick={() => (gestion ? setEditando(p) : agregar(p.id))} className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl p-2 text-center">
                        <span className="text-lg font-bold text-slate-800">{p.nombre}</span>
                        <span className="text-sm font-semibold" style={{ color: primaryColor }}>
                          {formatearPesos(p.precio)}
                        </span>
                        {!p.activo && <span className="text-[10px] font-bold text-slate-400">Oculto</span>}
                        {!gestion && cant > 0 && (
                          <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ backgroundColor: primaryColor }}>
                            {cant} en carrito
                          </span>
                        )}
                      </button>
                      {gestion && (
                        <div className="mt-1 flex items-center justify-between border-t border-slate-100 pt-1.5">
                          <button onClick={() => toggleActivo(p)} title={p.activo ? "Ocultar del menú" : "Mostrar en el menú"} className="rounded-md px-1.5 py-1 text-xs text-slate-500 hover:bg-slate-100">
                            {p.activo ? "🙈 Ocultar" : "👁️ Mostrar"}
                          </button>
                          <button onClick={() => setBorrandoProducto(p)} title="Eliminar" className="rounded-md px-1.5 py-1 text-xs text-rose-500 hover:bg-rose-50">
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {inactive.length > 0 && !gestion && (
                <p className="mt-2 text-[11px] text-slate-400">{inactive.length} producto(s) ocultos. Actívalos desde ⚙️ Menú.</p>
              )}
            </>
          ) : (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              No hay productos visibles en el menú.
            </div>
          )}

          {/* Ventas del día */}
          <div className="mt-8">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Ventas de hoy</h2>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm">
                {ventasOk ? `${ventas.length} ventas · $${ventas.reduce((a, v) => a + Number(v.total), 0).toLocaleString("es-CL")}` : "…"}
              </span>
            </div>
            {ventas.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
                Aún no hay ventas registradas hoy.
              </div>
            ) : (
              <div className="space-y-3">
                {ventas.map((v) => (
                  <VentaCard key={v.id} venta={v} primaryColor={primaryColor} onBorrarItem={borrarItem} onBorrarVenta={() => setBorrandoVenta(v)} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Panel de cobro */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-slate-700">🧾 Venta actual</h2>

            {cantidadItems === 0 ? (
              <p className="mb-4 rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">Toca un producto para agregarlo al carrito.</p>
            ) : (
              <ul className="mb-4 max-h-56 space-y-2 overflow-y-auto pr-1">
                {Object.entries(carrito).map(([id, cant]) => {
                  const p = productos.find((x) => x.id === id);
                  if (!p) return null;
                  return (
                    <li key={id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-2.5 py-1.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-700">{p.nombre}</p>
                        <p className="text-[10px] text-slate-400">{formatearPesos(p.precio)} c/u</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => quitar(id)} className="h-6 w-6 rounded-md bg-slate-100 text-xs font-bold text-slate-600 hover:bg-slate-200">
                          −
                        </button>
                        <span className="w-5 text-center text-xs font-bold text-slate-700">{cant}</span>
                        <button onClick={() => agregar(id)} className="h-6 w-6 rounded-md text-xs font-bold text-white hover:opacity-90" style={{ backgroundColor: primaryColor }}>
                          +
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <input
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Nombre del cliente (opcional)"
              className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-slate-400"
            />

            <div className="mb-3 grid grid-cols-2 gap-2">
              {METODOS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMetodo(m)}
                  className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                    metodo === m ? "border-transparent text-white" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                  style={metodo === m ? { backgroundColor: primaryColor } : undefined}
                >
                  {m === "Efectivo" ? "💵 Efectivo" : "💳 Tarjeta"}
                </button>
              ))}
            </div>

            {metodo === "Efectivo" && (
              <div className="mb-3">
                <input
                  value={recibido}
                  onChange={(e) => setRecibido(e.target.value.replace(/\D/g, ""))}
                  placeholder="Monto recibido (opcional)"
                  inputMode="numeric"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-slate-400"
                />
                {vuelto !== null && (
                  <p className="mt-1 text-right text-[11px] font-bold text-emerald-600">Vuelto: {formatearPesos(vuelto)}</p>
                )}
                {efectivo > 0 && efectivo < totalVenta && (
                  <p className="mt-1 text-right text-[11px] font-bold text-rose-500">Faltan {formatearPesos(totalVenta - efectivo)}</p>
                )}
              </div>
            )}

            <div className="mb-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs font-bold text-slate-500">{cantidadItems} artículo(s)</span>
              <span className="text-lg font-extrabold" style={{ color: primaryColor }}>
                {formatearPesos(totalVenta)}
              </span>
            </div>

            <button
              onClick={registrarVenta}
              disabled={registrando || totalVenta <= 0}
              style={{ backgroundColor: totalVenta > 0 ? primaryColor : "#cbd5e1" }}
              className="w-full rounded-xl py-3 text-sm font-bold text-white transition-opacity disabled:opacity-60"
            >
              {registrando ? "Registrando…" : "💾 Registrar venta"}
            </button>
            {cantidadItems > 0 && (
              <button onClick={() => setCarrito({})} className="mt-1.5 w-full rounded-xl py-2 text-xs font-bold text-slate-400 transition-colors hover:bg-slate-50">
                Limpiar carrito
              </button>
            )}
          </div>
        </aside>
      </main>

      {/* Modal nuevo/editar producto */}
      {editando && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setEditando(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-sm font-bold text-slate-700">{editando === "nuevo" ? "➕ Nuevo producto" : `✏️ ${editando.nombre}`}</h3>
            <label className="mb-1 block text-[11px] font-bold text-slate-500">Nombre</label>
            <input
              value={editando === "nuevo" ? "" : editando.nombre}
              onChange={(e) =>
                setEditando(
                  editando === "nuevo"
                    ? { id: "", organization_id: org!.id, nombre: e.target.value, precio: 0, activo: true }
                    : { ...editando, nombre: e.target.value }
                )
              }
              autoFocus
              placeholder="Ej: Café con leche"
              className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
            <label className="mb-1 block text-[11px] font-bold text-slate-500">Precio ($)</label>
            <input
              value={editando === "nuevo" ? "" : String(editando.precio)}
              onChange={(e) =>
                setEditando(
                  editando === "nuevo"
                    ? { id: "", organization_id: org!.id, nombre: "", precio: Number(e.target.value.replace(/\D/g, "")), activo: true }
                    : { ...editando, precio: Number(e.target.value.replace(/\D/g, "")) }
                )
              }
              inputMode="numeric"
              placeholder="Ej: 500"
              className="mb-5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
            <div className="flex gap-2">
              <button onClick={() => setEditando(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-500">
                Cancelar
              </button>
              <button
                onClick={guardarProducto}
                disabled={typeof editando !== "object" || !editando.nombre.trim() || editando.precio < 0}
                style={{ backgroundColor: primaryColor }}
                className="flex-1 rounded-xl py-2.5 text-xs font-bold text-white disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar eliminar producto */}
      {borrandoProducto && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setBorrandoProducto(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-sm font-bold text-slate-700">¿Eliminar &quot;{borrandoProducto.nombre}&quot;?</h3>
            <p className="mb-5 text-xs leading-relaxed text-slate-500">Las ventas ya registradas conservan su nombre y precio.</p>
            <div className="flex gap-2">
              <button onClick={() => setBorrandoProducto(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-500">
                Cancelar
              </button>
              <button onClick={eliminarProducto} style={{ backgroundColor: primaryColor }} className="flex-1 rounded-xl py-2.5 text-xs font-bold text-white">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar eliminar venta */}
      {borrandoVenta && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setBorrandoVenta(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-sm font-bold text-slate-700">¿Eliminar la venta completa?</h3>
            <p className="mb-2 text-xs leading-relaxed text-slate-500">
              Venta de las {formatHora(borrandoVenta.created_at)} por {formatearPesos(borrandoVenta.total)} ({borrandoVenta.metodo}).
            </p>
            <p className="mb-5 text-[11px] text-slate-400">Su ingreso también se eliminará de Finanzas.</p>
            <div className="flex gap-2">
              <button onClick={() => setBorrandoVenta(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-500">
                Cancelar
              </button>
              <button onClick={borrarVenta} style={{ backgroundColor: primaryColor }} className="flex-1 rounded-xl py-2.5 text-xs font-bold text-white">
                Eliminar venta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Escáner */}
      {scanAbierto && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/80 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700">📷 Escanear código de producto</h3>
              <button onClick={cerrarScanner} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                ✕ Cerrar
              </button>
            </div>
            <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
              Escanea el QR del producto (aparecen en &quot;🖨️ Menú QR&quot;). El producto se sumará al carrito automáticamente.
            </p>
            <div ref={scanRef} id="lector-qr" className="overflow-hidden rounded-2xl bg-slate-100" />
            {scanMsg && <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-center text-xs font-bold text-slate-600">{scanMsg}</p>}
          </div>
        </div>
      )}

      {/* Menú QR imprimible */}
      {menuAbierto && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-900/60 p-4">
          <div className="mx-auto max-w-3xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-white">
                <h3 className="text-sm font-bold">🖨️ Menú con códigos QR</h3>
                <p className="text-[10px] text-white/80">Escanea con el kiosco para sumar productos rápidamente.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setMenuAbierto(false)} className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/30">
                  Cerrar
                </button>
                <button onClick={() => window.print()} className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-slate-100">
                  🖨️ Imprimir
                </button>
              </div>
            </div>
            <div id="menu-imprimir" className="rounded-3xl bg-white p-6 shadow-xl">
              <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
                {org.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={org.logo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full text-white text-sm font-bold" style={{ backgroundColor: primaryColor }}>
                    {org.name.charAt(0)}
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-extrabold" style={{ color: primaryColor }}>
                    ☕ Menú — {org.name}
                  </h2>
                  <p className="text-[10px] text-slate-400">Escanéa el QR del producto con el kiosco para sumarlo a la venta.</p>
                </div>
              </div>
              {productos.filter((p) => p.activo).length === 0 ? (
                <p className="text-center text-sm text-slate-400">Sin productos activos.</p>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {productos
                    .filter((p) => p.activo)
                    .map((p) => (
                      <div key={p.id} className="rounded-2xl border border-slate-200 p-3 text-center">
                        {qrs[p.id] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={qrs[p.id]} alt={`QR ${p.nombre}`} className="mx-auto h-24 w-24" />
                        ) : (
                          <div className="mx-auto flex h-24 w-24 items-center justify-center text-[10px] text-slate-300">QR</div>
                        )}
                        <p className="mt-2 text-sm font-bold text-slate-800">{p.nombre}</p>
                        <p className="text-xs font-semibold" style={{ color: primaryColor }}>
                          {formatearPesos(p.precio)}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VentaCard({
  venta,
  primaryColor,
  onBorrarItem,
  onBorrarVenta,
}: {
  venta: Venta;
  primaryColor: string;
  onBorrarItem: (venta: Venta, item: VentaItem) => void;
  onBorrarVenta: () => void;
}) {
  const [abierta, setAbierta] = useState(false);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button onClick={() => setAbierta((a) => !a)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: venta.metodo === "Tarjeta" ? "#64748b" : primaryColor }}>
          {venta.metodo}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-700">
          {formatHora(venta.created_at)}
          {venta.cliente ? ` · ${venta.cliente}` : ""}
        </span>
        <span className="w-20 text-right text-sm font-extrabold" style={{ color: primaryColor }}>
          {formatearPesos(venta.total)}
        </span>
        <span className="text-xs text-slate-300">{abierta ? "▲" : "▼"}</span>
      </button>
      {abierta && (
        <div className="border-t border-slate-100 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Artículos ({venta.items.length})</p>
            <button onClick={onBorrarVenta} className="rounded-md px-2 py-1 text-[11px] font-bold text-rose-500 hover:bg-rose-50">
              🗑️ Eliminar venta
            </button>
          </div>
          {venta.items.length === 0 ? (
            <p className="py-1 text-xs text-slate-400">Sin artículos.</p>
          ) : (
            <ul className="space-y-1.5">
              {venta.items.map((it) => (
                <li key={it.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-700">
                    {it.cantidad}x {it.nombre}
                  </span>
                  <span className="text-xs font-bold text-slate-600">{formatearPesos(Number(it.precio) * it.cantidad)}</span>
                  <button
                    onClick={() => onBorrarItem(venta, it)}
                    title="Quitar este artículo (corrige el total y Finanzas)"
                    className="rounded-md px-1.5 py-1 text-xs text-rose-500 hover:bg-rose-100"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}