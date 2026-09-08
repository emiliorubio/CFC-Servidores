"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useOrganization } from "@/context/OrganizationContext";
import { supabase } from "@/lib/supabase";
import { formatearPesos } from "@/lib/format";
import RestrictedAccess from "@/components/RestrictedAccess";

type TipoMov = "ingreso" | "gasto";

interface Movimiento {
  id: string;
  fecha: string;
  tipo: TipoMov;
  categoria: string | null;
  descripcion: string;
  monto: number;
  creado_por: string | null;
  created_at: string;
}

interface Producto {
  nombre: string;
  precio: number;
}

const PRODUCTOS_INICIALES: Producto[] = [
  { nombre: "Agua", precio: 1000 },
  { nombre: "Café", precio: 1000 },
  { nombre: "Alka", precio: 500 },
  { nombre: "Completo", precio: 2000 },
  { nombre: "Bebida", precio: 1000 },
  { nombre: "Chicle", precio: 500 },
];

const CAT_INGRESO = ["Diezmo", "Ofrenda", "Donación", "Cafetería", "Esponsor", "Otro"];
const CAT_GASTO = ["Arriendo", "Servicios básicos", "Música y Sonido", "Insumos", "Transporte", "Otro"];

function mesKey(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function mesLabel(key: string): string {
  const d = new Date(`${key}-01T12:00:00`);
  const nombre = new Intl.DateTimeFormat("es-ES", { month: "long" }).format(d);
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${d.getFullYear()}`;
}

export default function FinanzasPage() {
  const { org, userRole, userProfile, loading: orgLoading } = useOrganization();
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [creadores, setCreadores] = useState<Record<string, string>>({});
  const [mesActual, setMesActual] = useState<string>("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<"movimiento" | "cafe" | null>(null);
  const [loading, setLoading] = useState(true);
  const [resumenPorCategoria, setResumenPorCategoria] = useState(false);

  const isFinance = ["admin", "superadmin", "pastor", "tesorero"].includes(userRole);

  const cargarMovimientos = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("transacciones")
      .select("id, fecha, tipo, categoria, descripcion, monto, creado_por, created_at")
      .eq("organization_id", org.id)
      .order("fecha", { ascending: false });

    if (error) {
      setLoadError("No se pudieron cargar los movimientos: " + error.message);
      setLoading(false);
      return;
    }

    setMovimientos((data || []) as Movimiento[]);

    const ids = [...new Set((data || []).map((t) => (t as Movimiento).creado_por).filter(Boolean))] as string[];
    if (ids.length > 0) {
      const { data: perfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      const mapa: Record<string, string> = {};
      (perfiles || []).forEach((p) => {
        mapa[p.id as string] = (p.full_name as string) || "Sin nombre";
      });
      setCreadores(mapa);
    }
    setLoading(false);
  }, [org]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de movimientos al montar
    cargarMovimientos();
  }, [cargarMovimientos]);

  const mesesDisponibles = useMemo(() => {
    const set = new Set<string>();
    movimientos.forEach((m) => set.add(mesKey(m.fecha)));
    return [...set].sort((a, b) => (a < b ? 1 : -1));
  }, [movimientos]);

  useEffect(() => {
    if (!mesActual && mesesDisponibles.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- selecciona el mes más reciente con movimientos
      setMesActual(mesesDisponibles[0]);
    }
  }, [mesActual, mesesDisponibles]);

  const filtrados = useMemo(() => {
    if (mesActual === "todos") return movimientos;
    return movimientos.filter((m) => mesKey(m.fecha) === mesActual);
  }, [movimientos, mesActual]);

  const totalIngresos = useMemo(
    () => filtrados.filter((m) => m.tipo === "ingreso").reduce((acc, m) => acc + m.monto, 0),
    [filtrados]
  );
  const totalGastos = useMemo(
    () => filtrados.filter((m) => m.tipo === "gasto").reduce((acc, m) => acc + m.monto, 0),
    [filtrados]
  );
  const saldo = totalIngresos - totalGastos;

  const porCategoria = useMemo(() => {
    const mapa = new Map<string, { ingresos: number; gastos: number }>();
    filtrados.forEach((m) => {
      const clave = m.categoria || "Sin categoría";
      const entry = mapa.get(clave) || { ingresos: 0, gastos: 0 };
      if (m.tipo === "ingreso") entry.ingresos += m.monto;
      else entry.gastos += m.monto;
      mapa.set(clave, entry);
    });
    return [...mapa.entries()].sort(
      (a, b) => b[1].ingresos + b[1].gastos - (a[1].ingresos + a[1].gastos)
    );
  }, [filtrados]);

  const maxCategoria =
    porCategoria.reduce((acc, [, v]) => Math.max(acc, v.ingresos, v.gastos), 0) || 1;

  const eliminarMovimiento = async (mov: Movimiento) => {
    if (!org) return;
    if (!window.confirm(`¿Eliminar el movimiento "${mov.descripcion}" por ${formatearPesos(mov.monto)}?`)) return;
    const { error } = await supabase
      .from("transacciones")
      .delete()
      .eq("id", mov.id)
      .eq("organization_id", org.id);
    if (error) {
      window.alert("No se pudo eliminar el movimiento: " + error.message);
      return;
    }
    await cargarMovimientos();
  };

  const exportarCSV = () => {
    const filas: (string | number)[][] = [
      ["Fecha", "Tipo", "Categoría", "Descripción", "Monto (CLP)", "Registró"],
    ];
    filtrados.forEach((m) => {
      filas.push([
        m.fecha,
        m.tipo === "ingreso" ? "Ingreso" : "Gasto",
        m.categoria || "—",
        m.descripcion,
        m.monto,
        (m.creado_por && creadores[m.creado_por]) || "—",
      ]);
    });
    const csv =
      "\uFEFF" +
      filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finanzas-${org?.slug || "iglesia"}-${mesActual === "todos" ? "completo" : mesActual}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600 font-medium">Cargando finanzas...</p>
      </div>
    );
  }

  if (!isFinance || !org) {
    return (
      <RestrictedAccess message="El módulo de Finanzas está disponible únicamente para Tesoreros, Pastores y Administradores de la iglesia." />
    );
  }

  const primaryColor = org.primary_color || "#4F46E5";

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-2">
              <span className="inline-flex text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full">
                ACCESO RESTRINGIDO · TESORERÍA
              </span>
              <h1 className="text-3xl font-extrabold tracking-tight">💰 Finanzas de {org.name}</h1>
              <p className="text-sm text-slate-300">
                Registro de ingresos, gastos y saldo mensual. Visible solo para el equipo autorizado.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={mesActual || "todos"}
                onChange={(e) => setMesActual(e.target.value)}
                className="bg-slate-800 text-white text-sm font-semibold px-3 py-2 rounded-xl border border-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="todos">Todos los meses</option>
                {mesesDisponibles.map((m) => (
                  <option key={m} value={m}>
                    {mesLabel(m)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loadError && (
          <div className="p-4 rounded-2xl text-sm font-semibold bg-rose-50 border border-rose-200 text-rose-800">
            {loadError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">🟢 Ingresos</p>
            <p className="text-2xl font-extrabold text-emerald-700 mt-2">{formatearPesos(totalIngresos)}</p>
          </div>
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-rose-600">🔴 Gastos</p>
            <p className="text-2xl font-extrabold text-rose-700 mt-2">{formatearPesos(totalGastos)}</p>
          </div>
          <div className="rounded-3xl p-6 shadow-sm text-white" style={{ backgroundColor: primaryColor }}>
            <p className="text-xs font-bold uppercase tracking-wider opacity-90">Saldo del período</p>
            <p className="text-2xl font-extrabold mt-2">{formatearPesos(saldo)}</p>
          </div>
        </div>

        <section className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-800">📊 Detalle por categoría</h2>
              <p className="text-xs text-slate-500 mt-1">
                Cuánto entra y cuánto sale, agrupado por categoría en el período seleccionado.
              </p>
            </div>
            <button
              onClick={() => setResumenPorCategoria((v) => !v)}
              className="text-xs font-bold px-3 py-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors"
            >
              {resumenPorCategoria ? "🙈 Ocultar detalle" : "👀 Ver detalle"}
            </button>
          </div>

          {resumenPorCategoria && (
            porCategoria.length === 0 ? (
              <p className="rounded-xl bg-slate-50 border border-dashed border-slate-200 p-4 text-xs text-slate-500">
                Sin datos en el período seleccionado.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">🟢 Ingresos</p>
                  {porCategoria.filter(([, v]) => v.ingresos > 0).map(([cat, v]) => (
                    <div key={`i-${cat}`} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                        <span className="truncate">{cat}</span>
                        <span className="ml-2 shrink-0">{formatearPesos(v.ingresos)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.round((v.ingresos / maxCategoria) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {porCategoria.every(([, v]) => v.ingresos === 0) && (
                    <p className="text-xs text-slate-400">Sin ingresos en este período.</p>
                  )}
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-rose-600">🔴 Gastos</p>
                  {porCategoria.filter(([, v]) => v.gastos > 0).map(([cat, v]) => (
                    <div key={`g-${cat}`} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                        <span className="truncate">{cat}</span>
                        <span className="ml-2 shrink-0">{formatearPesos(v.gastos)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-rose-500"
                          style={{ width: `${Math.round((v.gastos / maxCategoria) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {porCategoria.every(([, v]) => v.gastos === 0) && (
                    <p className="text-xs text-slate-400">Sin gastos en este período.</p>
                  )}
                </div>
              </div>
            )
          )}
        </section>

        <section className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Movimientos</h2>
              <p className="text-xs text-slate-500 mt-1">
                {filtrados.length} registros{mesActual !== "todos" ? ` · ${mesLabel(mesActual)}` : " · histórico completo"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setModal("cafe")}
                className="text-xs font-bold px-3 py-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
              >
                ☕ Cafetería
              </button>
              <button
                onClick={exportarCSV}
                className="text-xs font-bold px-3 py-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors"
              >
                ⬇ Exportar CSV
              </button>
              <button
                onClick={() => setModal("movimiento")}
                style={{ backgroundColor: primaryColor }}
                className="text-xs font-bold px-3 py-2 rounded-xl text-white hover:opacity-90 transition-opacity"
              >
                + Nuevo movimiento
              </button>
            </div>
          </div>

          {loading ? (
            <p className="text-center text-slate-500 text-sm py-8">Cargando movimientos...</p>
          ) : filtrados.length === 0 ? (
            <p className="rounded-xl bg-slate-50 border border-dashed border-slate-200 p-4 text-xs text-slate-500">
              No hay movimientos registrados {mesActual !== "todos" ? "en este mes" : "aún"}. Agrega el primero con el
              botón &quot;+ Nuevo movimiento&quot;.
            </p>
          ) : (
            <div className="space-y-3">
              {filtrados.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-lg ${
                        m.tipo === "ingreso" ? "bg-emerald-100" : "bg-rose-100"
                      }`}
                    >
                      {m.tipo === "ingreso" ? "⬆️" : "⬇️"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">
                        {m.descripcion}
                        {m.categoria && (
                          <span className="ml-2 inline-block rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 text-[10px] font-bold uppercase">
                            {m.categoria}
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {m.fecha}
                        {m.creado_por && creadores[m.creado_por] ? ` · por ${creadores[m.creado_por]}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className={`font-extrabold text-sm ${m.tipo === "ingreso" ? "text-emerald-600" : "text-rose-600"}`}>
                      {m.tipo === "ingreso" ? "+" : "-"}
                      {formatearPesos(m.monto)}
                    </p>
                    <button
                      onClick={() => eliminarMovimiento(m)}
                      title="Eliminar movimiento"
                      className="text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Botón flotante */}
      <button
        onClick={() => setModal("movimiento")}
        style={{ backgroundColor: primaryColor }}
        className="fixed bottom-6 right-6 text-white p-4 rounded-full shadow-lg hover:opacity-90 transition-opacity active:scale-95 z-40 font-bold text-xl"
        title="Nuevo movimiento"
      >
        +
      </button>

      {modal === "movimiento" && (
        <ModalMovimiento
          orgId={org.id}
          creadoPor={userProfile?.id || null}
          primaryColor={primaryColor}
          onClose={() => setModal(null)}
          onGuardado={cargarMovimientos}
        />
      )}

      {modal === "cafe" && (
        <ModalCafeteria
          orgId={org.id}
          creadoPor={userProfile?.id || null}
          primaryColor={primaryColor}
          onClose={() => setModal(null)}
          onGuardado={cargarMovimientos}
        />
      )}
    </div>
  );
}

function ModalMovimiento({
  orgId,
  creadoPor,
  primaryColor,
  onClose,
  onGuardado,
}: {
  orgId: string;
  creadoPor: string | null;
  primaryColor: string;
  onClose: () => void;
  onGuardado: () => Promise<void>;
}) {
  const [tipo, setTipo] = useState<TipoMov>("ingreso");
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [guardando, setGuardando] = useState(false);

  const sugerencias = tipo === "ingreso" ? CAT_INGRESO : CAT_GASTO;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const montoNum = parseFloat(monto);
    if (!montoNum || montoNum <= 0 || !descripcion.trim()) return;

    setGuardando(true);
    const { error } = await supabase.from("transacciones").insert({
      organization_id: orgId,
      tipo,
      categoria: categoria.trim() || null,
      descripcion: descripcion.trim(),
      monto: montoNum,
      fecha,
      creado_por: creadoPor,
    });
    setGuardando(false);

    if (error) {
      window.alert("No se pudo guardar el movimiento: " + error.message);
      return;
    }
    await onGuardado();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors font-bold">
          ✕
        </button>
        <h2 className="text-xl font-bold text-slate-800 mb-5">Nuevo Movimiento</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setTipo("ingreso")}
              className={`py-2 rounded-xl font-semibold text-sm transition-colors ${
                tipo === "ingreso" ? "bg-emerald-600 text-white" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              + Ingreso
            </button>
            <button
              type="button"
              onClick={() => setTipo("gasto")}
              className={`py-2 rounded-xl font-semibold text-sm transition-colors ${
                tipo === "gasto" ? "bg-rose-600 text-white" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              - Gasto
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Monto ($)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="Ej. 15000"
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Categoría</label>
            <input
              type="text"
              list="categorias-finanzas"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder={tipo === "ingreso" ? "Ej. Diezmo" : "Ej. Arriendo"}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
            <datalist id="categorias-finanzas">
              {sugerencias.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Descripción</label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej. Diezmo y ofrenda domingo 10:30"
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={guardando}
            style={{ backgroundColor: primaryColor }}
            className="w-full text-white font-bold py-3 px-4 rounded-xl shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar Movimiento"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ModalCafeteria({
  orgId,
  creadoPor,
  primaryColor,
  onClose,
  onGuardado,
}: {
  orgId: string;
  creadoPor: string | null;
  primaryColor: string;
  onClose: () => void;
  onGuardado: () => Promise<void>;
}) {
  const [productos, setProductos] = useState<Producto[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem("cfc_productos_cafeteria");
        if (saved) return JSON.parse(saved) as Producto[];
      } catch {
        // se ignora y parte con el catálogo inicial
      }
    }
    return PRODUCTOS_INICIALES;
  });
  const [carrito, setCarrito] = useState<Record<string, number>>({});
  const [metodoPago, setMetodoPago] = useState<"Efectivo" | "Tarjeta">("Efectivo");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoPrecio, setNuevoPrecio] = useState("");
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    window.localStorage.setItem("cfc_productos_cafeteria", JSON.stringify(productos));
  }, [productos]);

  const totalVenta = Object.entries(carrito).reduce((acc, [nombre, cantidad]) => {
    const prod = productos.find((p) => p.nombre === nombre);
    return acc + (prod ? prod.precio * cantidad : 0);
  }, 0);

  const ajustar = (nombre: string, delta: number) => {
    setCarrito((prev) => {
      const actual = prev[nombre] || 0;
      const total = actual + delta;
      if (total <= 0) {
        const copia = { ...prev };
        delete copia[nombre];
        return copia;
      }
      return { ...prev, [nombre]: total };
    });
  };

  const registrarVenta = async () => {
    if (totalVenta === 0) return;
    const detalle = Object.entries(carrito)
      .map(([nombre, cant]) => `${cant}x ${nombre}`)
      .join(", ");
    setGuardando(true);
    const { error } = await supabase.from("transacciones").insert({
      organization_id: orgId,
      tipo: "ingreso",
      categoria: "Cafetería",
      descripcion: `[Cafetería] ${detalle} (Pago: ${metodoPago})`,
      monto: totalVenta,
      fecha: new Date().toISOString().split("T")[0],
      creado_por: creadoPor,
    });
    setGuardando(false);
    if (error) {
      window.alert("No se pudo registrar la venta: " + error.message);
      return;
    }
    setCarrito({});
    await onGuardado();
    onClose();
  };

  const agregarProducto = (e: React.FormEvent) => {
    e.preventDefault();
    const precio = parseFloat(nuevoPrecio);
    if (!nuevoNombre.trim() || !precio || precio <= 0) return;
    setProductos([...productos, { nombre: nuevoNombre.trim(), precio }]);
    setNuevoNombre("");
    setNuevoPrecio("");
    setMostrarNuevo(false);
  };

  const eliminarProducto = (nombre: string) => {
    if (window.confirm(`¿Eliminar "${nombre}" del menú de cafetería?`)) {
      setProductos(productos.filter((p) => p.nombre !== nombre));
      setCarrito((prev) => {
        const copia = { ...prev };
        delete copia[nombre];
        return copia;
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors font-bold">
          ✕
        </button>
        <h2 className="text-xl font-bold text-slate-800 mb-1">☕ Cafetería - Venta Rápida</h2>
        <p className="text-xs text-slate-500 mb-4">Cada venta se registra automáticamente como ingreso.</p>

        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600 uppercase">Productos:</span>
          <button
            onClick={() => setMostrarNuevo(!mostrarNuevo)}
            className="text-xs text-indigo-600 hover:text-indigo-500 font-bold"
          >
            {mostrarNuevo ? "Cancelar" : "+ Agregar producto"}
          </button>
        </div>

        {mostrarNuevo && (
          <form onSubmit={agregarProducto} className="bg-slate-50 p-3 rounded-2xl border border-slate-200 mb-4 flex gap-2">
            <input
              type="text"
              placeholder="Nombre (ej. Kuchen)"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              required
              className="bg-white border border-slate-200 text-sm rounded-xl px-3 py-2 flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="number"
              min="0"
              placeholder="Precio ($)"
              value={nuevoPrecio}
              onChange={(e) => setNuevoPrecio(e.target.value)}
              required
              className="bg-white border border-slate-200 text-sm rounded-xl px-3 py-2 w-28 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-xl text-sm font-bold">
              Crear
            </button>
          </form>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
          {productos.map((prod) => {
            const cantidad = carrito[prod.nombre] || 0;
            return (
              <div
                key={prod.nombre}
                className={`p-3 rounded-2xl border transition-colors flex flex-col justify-between relative ${
                  cantidad > 0 ? "bg-indigo-50 border-indigo-300" : "bg-slate-50 border-slate-200"
                }`}
              >
                <button
                  onClick={() => eliminarProducto(prod.nombre)}
                  title="Eliminar producto"
                  className="absolute top-2 right-2 text-slate-400 hover:text-rose-600 text-xs font-bold"
                >
                  🗑️
                </button>
                <div>
                  <p className="font-bold text-sm text-slate-800 pr-5">{prod.nombre}</p>
                  <p className="text-[11px] text-slate-500">{formatearPesos(prod.precio)}</p>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <button
                    onClick={() => ajustar(prod.nombre, -1)}
                    disabled={cantidad === 0}
                    className="w-7 h-7 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 rounded-lg flex items-center justify-center text-sm font-bold text-slate-700"
                  >
                    -
                  </button>
                  <span className="font-bold text-sm text-slate-800">{cantidad}</span>
                  <button
                    onClick={() => ajustar(prod.nombre, 1)}
                    style={{ backgroundColor: primaryColor }}
                    className="w-7 h-7 text-white rounded-lg flex items-center justify-center text-sm font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Método de pago</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMetodoPago("Efectivo")}
              className={`py-2 rounded-xl text-sm font-bold border transition-colors ${
                metodoPago === "Efectivo"
                  ? "bg-emerald-600 border-emerald-500 text-white"
                  : "bg-slate-50 border-slate-200 text-slate-500"
              }`}
            >
              💵 Efectivo
            </button>
            <button
              type="button"
              onClick={() => setMetodoPago("Tarjeta")}
              className={`py-2 rounded-xl text-sm font-bold border transition-colors ${
                metodoPago === "Tarjeta"
                  ? "bg-purple-600 border-purple-500 text-white"
                  : "bg-slate-50 border-slate-200 text-slate-500"
              }`}
            >
              💳 Tarjeta
            </button>
          </div>
        </div>

        <div className="bg-slate-900 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-400">Total a registrar</p>
            <p className="text-xl font-extrabold text-emerald-400">{formatearPesos(totalVenta)}</p>
          </div>
          <button
            onClick={registrarVenta}
            disabled={totalVenta === 0 || guardando}
            style={{ backgroundColor: primaryColor }}
            className="text-white px-5 py-3 rounded-xl font-bold text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {guardando ? "Registrando..." : "🛒 Registrar Venta"}
          </button>
        </div>
      </div>
    </div>
  );
}