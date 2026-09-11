"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/context/OrganizationContext";
import RestrictedAccess from "@/components/RestrictedAccess";
import PlanDisabled from "@/components/PlanDisabled";
import { moduloActivo } from "@/lib/plans";
import { formatearFechaCulto, horaCulto, downloadCsv } from "@/lib/format";

interface Sermon {
  id: string;
  title: string;
  speaker: string | null;
  bible_text: string | null;
  notes: string | null;
  service_id: string | null;
  created_at: string;
  vinculado?: { title: string; service_date: string } | null;
}

interface CultoOption {
  id: string;
  title: string;
  service_date: string;
}

export default function SermonesPage() {
  const { org, userRole, loading: orgLoading } = useOrganization();
  const canManage =
    userRole === "admin" || userRole === "superadmin" || userRole === "pastor" || userRole === "lider" || userRole === "coordinador";

  const [sermones, setSermones] = useState<Sermon[]>([]);
  const [cultos, setCultos] = useState<CultoOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [busqueda, setBusqueda] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [predicador, setPredicador] = useState("");
  const [textoBiblico, setTextoBiblico] = useState("");
  const [notas, setNotas] = useState("");
  const [cultoId, setCultoId] = useState("");
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    if (!org?.id) return;
    setLoading(true);
    const [sermRes, cultosRes] = await Promise.all([
      supabase
        .from("sermons")
        .select("id, title, speaker, bible_text, notes, service_id, created_at, vinculado:service_schedules(title, service_date)")
        .eq("organization_id", org.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("service_schedules")
        .select("id, title, service_date")
        .eq("organization_id", org.id)
        .order("service_date", { ascending: false }),
    ]);
    if (sermRes.error) {
      alert("No se pudieron cargar los sermones: " + sermRes.error.message);
    } else {
      setSermones(
        (sermRes.data || []).map((s) => ({
          id: s.id,
          title: s.title,
          speaker: s.speaker,
          bible_text: s.bible_text,
          notes: s.notes,
          service_id: s.service_id,
          created_at: s.created_at,
          vinculado: Array.isArray(s.vinculado) ? s.vinculado[0] : s.vinculado,
        }))
      );
    }
    if (cultosRes.error) {
      alert("No se pudieron cargar los cultos: " + cultosRes.error.message);
    } else {
      setCultos(cultosRes.data || []);
    }
    setLoading(false);
  }, [org]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de sermones al montar
    loadAll();
  }, [loadAll, reloadKey]);

  const abrirNuevo = () => {
    setEditId(null);
    setTitulo("");
    setPredicador("");
    setTextoBiblico("");
    setNotas("");
    setCultoId("");
    setShowModal(true);
  };

  const abrirEdicion = (s: Sermon) => {
    setEditId(s.id);
    setTitulo(s.title);
    setPredicador(s.speaker || "");
    setTextoBiblico(s.bible_text || "");
    setNotas(s.notes || "");
    setCultoId(s.service_id || "");
    setShowModal(true);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org?.id || !titulo.trim()) return;
    setSaving(true);
    const payload = {
      title: titulo.trim(),
      speaker: predicador.trim() || null,
      bible_text: textoBiblico.trim() || null,
      notes: notas.trim() || null,
      service_id: cultoId || null,
    };
    const { error } = editId
      ? await supabase.from("sermons").update(payload).eq("id", editId).eq("organization_id", org.id)
      : await supabase.from("sermons").insert([{ ...payload, organization_id: org.id }]);
    setSaving(false);
    if (error) {
      alert("No se pudo guardar el sermón: " + error.message);
      return;
    }
    setShowModal(false);
    setReloadKey((k) => k + 1);
  };

  const handleEliminar = async (s: Sermon) => {
    const ok = confirm(`¿Eliminar el sermón "${s.title}"?`);
    if (!ok) return;
    const { error } = await supabase.from("sermons").delete().eq("id", s.id).eq("organization_id", org?.id);
    if (error) {
      alert("No se pudo eliminar el sermón: " + error.message);
      return;
    }
    setReloadKey((k) => k + 1);
  };

  const exportar = () => {
    if (!org) return;
    downloadCsv(
      `sermones-${org.slug || "iglesia"}.csv`,
      ["Fecha", "Título", "Predicador", "Texto bíblico", "Notas"],
      sermones.map((s) => [
        s.vinculado?.service_date ? formatearFechaCulto(s.vinculado.service_date) : "—",
        s.title,
        s.speaker || "",
        s.bible_text || "",
        s.notes || "",
      ])
    );
  };

  if (orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600 font-medium">Cargando sermones...</p>
      </div>
    );
  }

  if (!org) {
    return <RestrictedAccess message="Debes iniciar sesión para ver el archivo de sermones de tu iglesia." />;
  }

  if (org && !moduloActivo(org.plan, "sermones")) {
    return <PlanDisabled modulo="Sermones" />;
  }

  const visibles = sermones.filter(
    (s) =>
      s.title.toLowerCase().includes(busqueda.trim().toLowerCase()) ||
      (s.speaker || "").toLowerCase().includes(busqueda.trim().toLowerCase()) ||
      (s.bible_text || "").toLowerCase().includes(busqueda.trim().toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-lg space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📖</span>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Predicaciones &amp; Sermones</h1>
              <p className="text-xs text-slate-300 mt-1">
                El archivo histórico de lo que se ha predicado en {org.name}. La fe viene por el oír.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Buscar por título, predicador o texto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="flex-1 min-w-[200px] bg-slate-800 text-white placeholder:text-slate-400 border border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-white/40"
            />
            <button
              onClick={exportar}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-colors"
            >
              ⬇️ CSV
            </button>
            {canManage && (
              <button
                onClick={abrirNuevo}
                className="bg-white text-slate-900 hover:bg-slate-100 font-bold px-4 py-2.5 rounded-xl text-xs transition-colors"
              >
                + Registrar sermón
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500 text-center py-10">Cargando...</p>
        ) : visibles.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-2 shadow-sm">
            <div className="text-4xl">📜</div>
            <h3 className="text-base font-bold text-slate-800">Sin predicaciones registradas</h3>
            <p className="text-xs text-slate-500">
              {canManage
                ? "Registra el primer sermón para ir construyendo el archivo."
                : "Pronto se publicarán aquí las predicaciones de la iglesia."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {visibles.map((s) => (
              <div key={s.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-100 text-slate-600 border-slate-200">
                    {s.vinculado?.service_date
                      ? `${formatearFechaCulto(s.vinculado.service_date)}${horaCulto(s.vinculado.service_date) ? ` · ${horaCulto(s.vinculado.service_date)}` : ""}`
                      : new Date(s.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => abrirEdicion(s)}
                        title="Editar sermón"
                        className="text-xs text-slate-300 hover:text-indigo-500 transition-colors"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleEliminar(s)}
                        title="Eliminar sermón"
                        className="text-xs text-slate-300 hover:text-red-500 transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>

                <h3 className="text-base font-bold text-slate-800 leading-snug">✝️ {s.title}</h3>

                <div className="flex flex-wrap gap-1.5">
                  {s.speaker && (
                    <span className="text-[10px] font-bold px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                      🎤 {s.speaker}
                    </span>
                  )}
                  {s.bible_text && (
                    <span className="text-[10px] font-bold px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                      📖 {s.bible_text}
                    </span>
                  )}
                </div>

                {s.notes && <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">{s.notes}</p>}
                {s.vinculado?.title && (
                  <p className="text-[11px] text-slate-400">
                    📅 Vinculado a: <span className="font-semibold text-slate-600">{s.vinculado.title}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && canManage && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-800">{editId ? "✏️ Editar sermón" : "+ Registrar sermón"}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardar} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Título del mensaje</label>
                <input
                  type="text"
                  required
                  placeholder="ej. La fe que mueve montañas"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Predicador</label>
                <input
                  type="text"
                  placeholder="¿Quién predicó?"
                  value={predicador}
                  onChange={(e) => setPredicador(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Texto bíblico</label>
                <input
                  type="text"
                  placeholder="ej. Romanos 10:17"
                  value={textoBiblico}
                  onChange={(e) => setTextoBiblico(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Vinculado a un culto (Opcional)</label>
                <select
                  value={cultoId}
                  onChange={(e) => setCultoId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                >
                  <option value="">Sin vincular a un culto</option>
                  {cultos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatearFechaCulto(c.service_date)} · {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notas / resumen (Opcional)</label>
                <textarea
                  rows={3}
                  placeholder="Un breve resumen del mensaje..."
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  {saving ? "Guardando..." : "Guardar sermón"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}