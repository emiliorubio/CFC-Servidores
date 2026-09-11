"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/context/OrganizationContext";
import RestrictedAccess from "@/components/RestrictedAccess";

interface MiembroGrupo {
  id: string;
  full_name: string;
}

interface Grupo {
  id: string;
  name: string;
  leader_id?: string | null;
  leader?: { full_name: string } | null;
  meeting_weekday?: number | null;
  meeting_time?: string | null;
  address?: string | null;
  description?: string | null;
  miembro_ids: string[];
}

const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default function GruposPage() {
  const { org, userRole, loading: orgLoading } = useOrganization();
  const canManage =
    userRole === "admin" || userRole === "superadmin" || userRole === "pastor" || userRole === "lider" || userRole === "coordinador";

  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [miembros, setMiembros] = useState<MiembroGrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);

  // Formulario de alta / edición
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [liderId, setLiderId] = useState("");
  const [dia, setDia] = useState("0");
  const [hora, setHora] = useState("");
  const [direccion, setDireccion] = useState("");
  const [descripcion, setDescripcion] = useState("");

  // Miembros que se agregan desde un selector
  const [gestionando, setGestionando] = useState<Grupo | null>(null);
  const [miembroNuevo, setMiembroNuevo] = useState("");
  const [quitarId, setQuitarId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!org?.id) return;
    setLoading(true);
    const [gruposRes, miembrosRes] = await Promise.all([
      supabase
        .from("grupos")
        .select("id, name, leader_id, leader:church_members(full_name), meeting_weekday, meeting_time, address, description, grupo_miembros(member_id)")
        .eq("organization_id", org.id)
        .order("name"),
      supabase
        .from("church_members")
        .select("id, full_name")
        .eq("organization_id", org.id)
        .order("full_name"),
    ]);
    if (gruposRes.error) {
      alert("No se pudieron cargar los grupos: " + gruposRes.error.message);
    } else {
      setGrupos(
        (gruposRes.data || []).map((g) => ({
          id: g.id,
          name: g.name,
          leader_id: g.leader_id,
          leader: Array.isArray(g.leader) ? g.leader[0] : g.leader,
          meeting_weekday: g.meeting_weekday,
          meeting_time: g.meeting_time,
          address: g.address,
          description: g.description,
          miembro_ids: (g.grupo_miembros || []).map((m: { member_id: string }) => m.member_id),
        }))
      );
    }
    if (miembrosRes.error) {
      alert("No se pudieron cargar los miembros: " + miembrosRes.error.message);
    } else {
      setMiembros(miembrosRes.data || []);
    }
    setLoading(false);
  }, [org]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de grupos al montar
    loadAll();
  }, [loadAll, reloadKey]);

  const abrirNuevo = () => {
    setEditId(null);
    setNombre("");
    setLiderId("");
    setDia("0");
    setHora("");
    setDireccion("");
    setDescripcion("");
    setShowModal(true);
  };

  const abrirEdicion = (g: Grupo) => {
    setEditId(g.id);
    setNombre(g.name);
    setLiderId(g.leader_id || "");
    setDia(String(g.meeting_weekday ?? 0));
    setHora(g.meeting_time || "");
    setDireccion(g.address || "");
    setDescripcion(g.description || "");
    setShowModal(true);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org?.id || !nombre.trim()) return;
    setSaving(true);
    const payload = {
      name: nombre.trim(),
      leader_id: liderId || null,
      meeting_weekday: Number(dia),
      meeting_time: hora || null,
      address: direccion.trim() || null,
      description: descripcion.trim() || null,
    };
    const { error } = editId
      ? await supabase.from("grupos").update(payload).eq("id", editId).eq("organization_id", org.id)
      : await supabase.from("grupos").insert([{ ...payload, organization_id: org.id }]);
    setSaving(false);
    if (error) {
      alert("No se pudo guardar el grupo: " + error.message);
      return;
    }
    setShowModal(false);
    setReloadKey((k) => k + 1);
  };

  const handleEliminar = async (g: Grupo) => {
    const ok = confirm(`¿Eliminar el grupo "${g.name}"? Se quita a sus ${g.miembro_ids.length} miembros.`);
    if (!ok) return;
    const { error } = await supabase.from("grupos").delete().eq("id", g.id).eq("organization_id", org?.id);
    if (error) {
      alert("No se pudo eliminar el grupo: " + error.message);
      return;
    }
    setReloadKey((k) => k + 1);
  };

  const agregarMiembro = async () => {
    if (!gestionando || !miembroNuevo) return;
    const { error } = await supabase
      .from("grupo_miembros")
      .insert([{ grupo_id: gestionando.id, member_id: miembroNuevo }]);
    if (error) {
      alert("No se pudo agregar al miembro: " + error.message);
      return;
    }
    setMiembroNuevo("");
    setReloadKey((k) => k + 1);
  };

  const quitarMiembro = async (miembroId: string) => {
    if (!gestionando) return;
    setQuitarId(miembroId);
    const { error } = await supabase
      .from("grupo_miembros")
      .delete()
      .eq("grupo_id", gestionando.id)
      .eq("member_id", miembroId);
    setQuitarId(null);
    if (error) {
      alert("No se pudo quitar al miembro: " + error.message);
      return;
    }
    setReloadKey((k) => k + 1);
  };

  if (orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600 font-medium">Cargando grupos...</p>
      </div>
    );
  }

  if (!canManage || !org) {
    return (
      <RestrictedAccess message="La gestión de Grupos / Células está disponible únicamente para líderes, coordinadores, pastores y administradores de la iglesia." />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-lg space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">👥</span>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Grupos &amp; Células</h1>
              <p className="text-xs text-slate-300 mt-1">
                Organiza los grupos pequeños de {org.name}: líder, día de reunión, dirección e integrantes.
              </p>
            </div>
          </div>
          <button
            onClick={abrirNuevo}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-3 rounded-2xl text-xs md:text-sm transition-colors"
          >
            + Nuevo Grupo
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500 text-center py-10">Cargando...</p>
        ) : grupos.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-2 shadow-sm">
            <div className="text-4xl">🏠</div>
            <h3 className="text-base font-bold text-slate-800">Sin grupos aún</h3>
            <p className="text-xs text-slate-500">
              Crea el primer grupo pequeño y agrega miembros desde el directorio.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {grupos.map((g) => (
              <div key={g.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">{g.name}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
                      {g.meeting_weekday != null && (
                        <span>{DIAS_SEMANA[g.meeting_weekday]}</span>
                      )}
                      {g.meeting_time && <span>· ⏰ {g.meeting_time}</span>}
                      {g.address && <span>· 📍 {g.address}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => abrirEdicion(g)}
                      title="Editar grupo"
                      className="text-xs text-slate-300 hover:text-indigo-500 transition-colors"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleEliminar(g)}
                      title="Eliminar grupo"
                      className="text-xs text-slate-300 hover:text-red-500 transition-colors"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500">
                  Líder:{" "}
                  <span className="font-bold text-slate-700">{g.leader?.full_name || "Sin líder asignado"}</span>
                  <span className="mx-2">·</span>
                  <span className="font-bold text-indigo-700">{g.miembro_ids.length} integrante{g.miembro_ids.length !== 1 ? "s" : ""}</span>
                </p>

                {g.description && <p className="text-xs text-slate-500 line-clamp-2">{g.description}</p>}

                <div className="flex flex-wrap gap-1.5">
                  {g.miembro_ids.map((id) => {
                    const m = miembros.find((mm) => mm.id === id);
                    return m ? (
                      <span
                        key={id}
                        className="text-[10px] font-bold px-2 py-1 bg-purple-50 text-purple-700 rounded-full border border-purple-200"
                      >
                        {m.full_name}
                      </span>
                    ) : null;
                  })}
                </div>

                <button
                  onClick={() => setGestionando(g)}
                  className="w-full text-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 rounded-xl text-xs transition-colors"
                >
                  ➕ Gestionar integrantes
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-800">{editId ? "✏️ Editar grupo" : "+ Nuevo grupo"}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardar} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre del grupo</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Célula Jóvenes / Grupo de Damas"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Líder del grupo</label>
                <select
                  value={liderId}
                  onChange={(e) => setLiderId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                >
                  <option value="">Sin líder asignado</option>
                  {miembros.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Día de reunión</label>
                  <select
                    value={dia}
                    onChange={(e) => setDia(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                  >
                    {DIAS_SEMANA.map((d, i) => (
                      <option key={i} value={String(i)}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hora</label>
                  <input
                    type="time"
                    value={hora}
                    onChange={(e) => setHora(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Dirección (Opcional)</label>
                <input
                  type="text"
                  placeholder="¿Dónde se reúne?"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descripción (Opcional)</label>
                <textarea
                  rows={2}
                  placeholder="Breve descripción del grupo..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
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
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  {saving ? "Guardando..." : "Guardar grupo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {gestionando && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">👥 Integrantes · {gestionando.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{gestionando.miembro_ids.length} integrantes</p>
              </div>
              <button onClick={() => setGestionando(null)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Agregar miembro</label>
              <select
                value={miembroNuevo}
                onChange={(e) => setMiembroNuevo(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              >
                <option value="">Elige un miembro del directorio...</option>
                {miembros
                  .filter((m) => !gestionando.miembro_ids.includes(m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
              </select>
              <button
                onClick={agregarMiembro}
                disabled={!miembroNuevo || saving}
                className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-2.5 text-xs font-bold transition-colors disabled:opacity-50"
              >
                + Agregar al grupo
              </button>
            </div>

            <ul className="space-y-1.5">
              {gestionando.miembro_ids.length === 0 && (
                <li className="text-xs text-slate-400 text-center py-3">Aún no hay integrantes.</li>
              )}
              {gestionando.miembro_ids.map((id) => {
                const m = miembros.find((mm) => mm.id === id);
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2"
                  >
                    <span className="text-xs font-semibold text-slate-700">{m?.full_name || "—"}</span>
                    <button
                      onClick={() => quitarMiembro(id)}
                      disabled={quitarId === id}
                      className="text-xs text-slate-300 hover:text-red-500 transition-colors"
                      title="Quitar del grupo"
                    >
                      {quitarId === id ? "..." : "🗑️"}
                    </button>
                  </li>
                );
              })}
            </ul>

            <button
              onClick={() => setGestionando(null)}
              className="w-full py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}