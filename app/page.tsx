"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/context/OrganizationContext";
import { formatearFechaCulto, horaCulto } from "@/lib/format";
import Link from "next/link";

interface ServiceSchedule {
  id: string;
  service_date: string;
  title: string;
  description?: string;
  organization_id: string;
}

interface MinistryTeam {
  id: string;
  name: string;
}

interface ServiceAssignment {
  id: string;
  service_id: string;
  team_id: string | null;
}

export default function HomePage() {
  const { org, userRole, loading: orgLoading } = useOrganization();
  const [schedules, setSchedules] = useState<ServiceSchedule[]>([]);
  const [teams, setTeams] = useState<MinistryTeam[]>([]);
  const [assignments, setAssignments] = useState<ServiceAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulario para crear un nuevo culto
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("Culto Dominical");
  const [serviceDate, setServiceDate] = useState("");
  const [serviceTime, setServiceTime] = useState("10:00");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Eliminar un culto (solo admin / pastor)
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Generación automática de cultos según el horario de la iglesia
  const [generating, setGenerating] = useState<number | null>(null);
  const [genMessage, setGenMessage] = useState<{ type: "success" | "info" | "error"; text: string } | null>(null);

  const generateCultos = async (meses: number) => {
    if (!org?.id) return;
    setGenerating(meses);
    setGenMessage(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setGenMessage({ type: "error", text: "Inicia sesión para generar cultos." });
        return;
      }
      const res = await fetch("/api/cultos/generar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ orgId: org.id, meses }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "No se pudieron generar los cultos.");
      setGenMessage({
        type: result.creados > 0 ? "success" : "info",
        text: result.message,
      });
      setReloadKey((k) => k + 1);
    } catch (err) {
      setGenMessage({
        type: "error",
        text: "Error al generar cultos: " + (err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setGenerating(null);
    }
  };

  const [reloadKey, setReloadKey] = useState(0);

  // Cargar cultos filtrados por la iglesia activa (se recarga al cambiar de
  // iglesia o al generar/crear nuevos cultos).
  useEffect(() => {
    if (!org?.id) return;
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("service_schedules")
          .select("*")
          .eq("organization_id", org.id)
          .order("service_date", { ascending: true });

        if (error) throw error;
        if (active) setSchedules(data || []);

        // Datos vivos: áreas y confirmados por culto
        const { data: teamsData } = await supabase
          .from("ministry_teams")
          .select("id, name")
          .eq("organization_id", org.id);
        if (active) setTeams(teamsData || []);

        const { data: assignData } = await supabase
          .from("service_assignments")
          .select("id, service_id, team_id")
          .eq("organization_id", org.id);
        if (active) setAssignments(assignData || []);
      } catch (err) {
        console.error("Error al cargar los servicios:", err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [org?.id, reloadKey]);

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org?.id || !serviceDate) return;

    setSaving(true);
    try {
      // Guardar la hora como instante correcto en la zona local del usuario.
      const serviceDateInstant = new Date(`${serviceDate}T${serviceTime || "10:00"}:00`).toISOString();
      const { error } = await supabase.from("service_schedules").insert([
        {
          title,
          service_date: serviceDateInstant,
          description,
          organization_id: org.id,
        },
      ]);

      if (error) throw error;

      setShowModal(false);
      setTitle("Culto Dominical");
      setServiceDate("");
      setServiceTime("10:00");
      setDescription("");
      setReloadKey((k) => k + 1);
    } catch (err) {
      alert("Error al guardar culto: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  const isAdminOrLider =
    userRole === "admin" || userRole === "superadmin" || userRole === "lider" || userRole === "pastor";
  const canDeleteCulto =
    userRole === "admin" || userRole === "superadmin" || userRole === "pastor";
  const orgName = org?.name || "tu iglesia";

  const shortTeamName = (name: string) => name.split("(")[0].trim();

  const handleDeleteSchedule = async (schedule: ServiceSchedule) => {
    if (!org?.id || !canDeleteCulto) return;
    const ok = confirm(
      `¿Eliminar "${schedule.title}" de ${formatearFechaCulto(schedule.service_date)}? Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    setDeletingId(schedule.id);
    const { error } = await supabase
      .from("service_schedules")
      .delete()
      .eq("id", schedule.id)
      .eq("organization_id", org.id);
    setDeletingId(null);
    if (error) {
      alert("No se pudo eliminar el culto: " + error.message);
      return;
    }
    setReloadKey((k) => k + 1);
  };

  const assignmentCounts = (serviceId: string) => {
    const grouped = assignments.filter((a) => a.service_id === serviceId);
    const perTeam = teams
      .map((t) => ({ team: t, count: grouped.filter((a) => a.team_id === t.id).length }))
      .filter((x) => x.count > 0);
    const missing = teams.filter((t) => !grouped.some((a) => a.team_id === t.id));
    return { total: grouped.length, perTeam, missing };
  };

  if (orgLoading || (loading && org?.id)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-500">Cargando cronograma...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      
      {/* Resumen público de la agenda, conservando el diseño de la versión anterior. */}
      <div className="rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-slate-900 border border-slate-800">
        <div className="space-y-2 max-w-2xl relative z-10">
          <span className="bg-amber-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-amber-400 border border-amber-500/30">
            Cronograma oficial
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Próximos Servicios &amp; Cultos
          </h1>
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
            Consulta los cultos programados, revisa las asignaciones de alabanza, predicadores y escuela dominical, y anótate para servir en {orgName}.
          </p>
        </div>

        {isAdminOrLider && (
          <div className="relative z-10 flex flex-wrap items-center gap-2">
            <button
              onClick={() => generateCultos(1)}
              disabled={generating !== null}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-3 rounded-2xl shadow-lg transition-transform hover:scale-105 text-xs md:text-sm disabled:opacity-50"
            >
              {generating === 1 ? "Generando..." : "⚡ Gén. Cultos 1 mes"}
            </button>
            <button
              onClick={() => generateCultos(2)}
              disabled={generating !== null}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-3 rounded-2xl shadow-lg transition-transform hover:scale-105 text-xs md:text-sm disabled:opacity-50"
            >
              {generating === 2 ? "Generando..." : "⚡ Gén. Cultos 2 meses"}
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-3 rounded-2xl shadow-lg transition-transform hover:scale-105 text-xs md:text-sm whitespace-nowrap"
            >
              + Nuevo Culto / Servicio
            </button>
          </div>
        )}
      </div>

      {/* Resultado de la generación automática */}
      {genMessage && (
        <div
          className={`p-4 rounded-2xl text-sm font-semibold ${
            genMessage.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : genMessage.type === "info"
                ? "bg-sky-50 border border-sky-200 text-sky-800"
                : "bg-rose-50 border border-rose-200 text-rose-800"
          }`}
        >
          {genMessage.text}
        </div>
      )}

      {/* Lista de Cultos / Cronograma */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span>📅</span> Próximas Fechas
        </h2>

        {schedules.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-3 shadow-sm">
            <div className="text-4xl">⛪</div>
            <h3 className="text-base font-bold text-slate-800">Sin cultos registrados aún</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No hay reuniones agendadas para <strong>{orgName}</strong>. {isAdminOrLider ? "Haz clic en el botón de arriba para agregar la primera." : "Inicia sesión con tu cuenta de líder para agendar fechas."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="text-base font-bold text-slate-800">{schedule.title}</h3>
                    {canDeleteCulto && (
                      <button
                        onClick={() => handleDeleteSchedule(schedule)}
                        disabled={deletingId === schedule.id}
                        title="Eliminar culto"
                        className="text-xs text-slate-300 hover:text-red-500 transition-colors shrink-0"
                      >
                        {deletingId === schedule.id ? "..." : "🗑️"}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-indigo-600 font-semibold mt-1">
                    🗓️ {formatearFechaCulto(schedule.service_date)}
                    {horaCulto(schedule.service_date) && (
                      <span className="text-indigo-400"> — ⏰ {horaCulto(schedule.service_date)}</span>
                    )}
                  </p>

                  {schedule.description && (
                    <p className="text-xs text-slate-500 line-clamp-2">{schedule.description}</p>
                  )}

                  <div className="grid gap-2">
                    <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-2.5">
                      <p className="text-xs font-bold text-blue-900">📖 Predicador / Altar</p>
                      <p className="text-[11px] text-blue-400 italic mt-1">Información disponible en el módulo de servidores.</p>
                    </div>
                    <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-2.5">
                      <p className="text-xs font-bold text-purple-900">🎵 Equipo de Adoración</p>
                      <p className="text-[11px] text-purple-400 italic mt-1">Revisa y confirma a los músicos asignados.</p>
                    </div>
                    <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-2.5">
                      <p className="text-xs font-bold text-amber-950">👧 Escuela Dominical</p>
                      <p className="text-[11px] text-amber-600/70 italic mt-1">Lecciones y profesores por confirmar.</p>
                    </div>
                  </div>

                  {(() => {
                    const { total, perTeam, missing } = assignmentCounts(schedule.id);
                    return (
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-1 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                          👥 {total} confirmado{total !== 1 ? "s" : ""}
                        </span>
                        {perTeam.map(({ team, count }) => (
                          <span
                            key={team.id}
                            className="text-[10px] font-bold px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200"
                          >
                            {shortTeamName(team.name)} {count}
                          </span>
                        ))}
                        {isAdminOrLider &&
                          missing.slice(0, 3).map((t) => (
                            <span
                              key={t.id}
                              className="text-[10px] font-semibold px-2 py-1 bg-amber-50 text-amber-700 rounded-full border border-dashed border-amber-300"
                            >
                              Falta {shortTeamName(t.name)}
                            </span>
                          ))}
                      </div>
                    );
                  })()}
                </div>

                <Link
                  href={`/servidores?service_id=${schedule.id}`}
                  className="w-full text-center bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors block"
                >
                  Anotarme para Servir →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal para Crear Servicio */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-800">Agregar Nuevo Culto</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Título del Servicio</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Culto Dominical / Noche de Milagros"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Fecha del Servicio</label>
                <input
                  type="date"
                  required
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Hora del Servicio</label>
                <input
                  type="time"
                  value={serviceTime}
                  onChange={(e) => setServiceTime(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descripción / Notas (Opcional)</label>
                <textarea
                  rows={3}
                  placeholder="Información relevante para los servidores..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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
                  {saving ? "Guardando..." : "Crear Culto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
