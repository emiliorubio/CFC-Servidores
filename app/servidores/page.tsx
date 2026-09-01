"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/context/OrganizationContext";

interface ServiceSchedule {
  id: string;
  title: string;
  service_date: string;
  description?: string;
}

interface MinistryTeam {
  id: string;
  name: string;
  role_needed: string;
}

interface Assignment {
  id: string;
  service_id: string;
  team_id: string;
  user_id?: string;
  manual_name?: string | null;
  role_assigned: string;
  profiles?: {
    full_name: string;
  } | null;
}

export default function ServidoresPage() {
  const searchParams = useSearchParams();
  const selectedServiceId = searchParams.get("service_id");

  const { org, userProfile, userRole, loading: orgLoading } = useOrganization();

  const [schedules, setSchedules] = useState<ServiceSchedule[]>([]);
  const [activeServiceId, setActiveServiceId] = useState<string | null>(selectedServiceId);
  const [teams, setTeams] = useState<MinistryTeam[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Estados de formularios
  const [manualName, setManualName] = useState("");
  const [manualServiceId, setManualServiceId] = useState("");
  const [manualTeamId, setManualTeamId] = useState("");

  const [selfServiceId, setSelfServiceId] = useState("");
  const [selfTeamId, setSelfTeamId] = useState("");

  const [newCultoTitle, setNewCultoTitle] = useState("");
  const [newCultoDate, setNewCultoDate] = useState("");
  const [newCultoTime, setNewCultoTime] = useState("10:00");

  const [selectedFilterArea, setSelectedFilterArea] = useState("all");

  useEffect(() => {
    if (org?.id) {
      fetchSchedules();
      fetchTeams();
    }
  }, [org]);

  useEffect(() => {
    if (activeServiceId && org?.id) {
      fetchDataForService(activeServiceId);
    }
  }, [activeServiceId, org]);

  const fetchSchedules = async () => {
    if (!org?.id) return;
    try {
      const { data, error } = await supabase
        .from("service_schedules")
        .select("*")
        .eq("organization_id", org.id)
        .order("service_date", { ascending: true });

      if (error) throw error;
      setSchedules(data || []);

      if (data && data.length > 0) {
        if (!activeServiceId) setActiveServiceId(data[0].id);
        setManualServiceId(data[0].id);
        setSelfServiceId(data[0].id);
      }
    } catch (err) {
      console.error("Error al cargar servicios:", err);
    }
  };

  const fetchTeams = async () => {
    if (!org?.id) return;
    try {
      const { data, error } = await supabase
        .from("ministry_teams")
        .select("*")
        .eq("organization_id", org.id);

      if (error) throw error;
      const loadedTeams = data || [];
      setTeams(loadedTeams);
      if (loadedTeams.length > 0) {
        setManualTeamId(loadedTeams[0].id);
        setSelfTeamId(loadedTeams[0].id);
      }
    } catch (err) {
      console.error("Error al cargar equipos:", err);
    }
  };

  const fetchDataForService = async (serviceId: string) => {
    setLoading(true);
    try {
      const { data: assignData, error: assignError } = await supabase
        .from("service_assignments")
        .select("*, profiles(full_name)")
        .eq("service_id", serviceId);

      if (assignError) throw assignError;
      setAssignments(assignData || []);
    } catch (err) {
      console.error("Error cargando asignaciones:", err);
    } finally {
      setLoading(false);
    }
  };

  // Inscripción Manual (Líderes)
  const handleManualSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualServiceId || !manualTeamId || !org?.id) return;

    setProcessing(true);
    try {
      const selectedTeam = teams.find((t) => t.id === manualTeamId);
      const { error } = await supabase.from("service_assignments").insert([
        {
          service_id: manualServiceId,
          team_id: manualTeamId,
          manual_name: manualName.trim(),
          role_assigned: selectedTeam?.role_needed || "Servidor",
          organization_id: org.id,
        },
      ]);

      if (error) throw error;
      setManualName("");
      setActiveServiceId(manualServiceId);
      await fetchDataForService(manualServiceId);
    } catch (err: any) {
      alert("Error al anotar hermano: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Auto-Inscripción
  const handleSelfSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.id || !selfServiceId || !selfTeamId || !org?.id) {
      alert("Debes iniciar sesión para inscribirte.");
      return;
    }

    setProcessing(true);
    try {
      const selectedTeam = teams.find((t) => t.id === selfTeamId);
      const { error } = await supabase.from("service_assignments").insert([
        {
          service_id: selfServiceId,
          team_id: selfTeamId,
          user_id: userProfile.id,
          role_assigned: selectedTeam?.role_needed || "Servidor",
          organization_id: org.id,
        },
      ]);

      if (error) throw error;
      setActiveServiceId(selfServiceId);
      await fetchDataForService(selfServiceId);
    } catch (err: any) {
      alert("Error al inscribirse: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Programar Culto
  const handleCreateCulto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCultoTitle.trim() || !newCultoDate || !org?.id) return;

    setProcessing(true);
    try {
      const fullDate = `${newCultoDate}T${newCultoTime}:00`;
      const { error } = await supabase.from("service_schedules").insert([
        {
          title: newCultoTitle,
          service_date: fullDate,
          organization_id: org.id,
        },
      ]);

      if (error) throw error;
      setNewCultoTitle("");
      setNewCultoDate("");
      fetchSchedules();
    } catch (err: any) {
      alert("Error al crear culto: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const isLeaderOrAdmin =
    userRole === "admin" || userRole === "superadmin" || userRole === "lider";

  const visibleAssignments = selectedFilterArea === "all"
    ? assignments
    : assignments.filter((assignment) => assignment.team_id === selectedFilterArea);

  const assignmentName = (assignment: Assignment) =>
    assignment.manual_name || assignment.profiles?.full_name || "Servidor confirmado";

  if (orgLoading) {
    return (
      <div className="flex justify-center py-20 text-slate-500 text-sm">
        Cargando módulo de servidores...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4">
      {/* 1. Anotar Hermano Manual (Líder/Admin) */}
      {isLeaderOrAdmin && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-purple-700 text-lg">👤</span>
            <h2 className="font-bold text-slate-800 text-base">
              Anotar Hermano Manual (Sin App)
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Guarda al hermano en el directorio y lo asigna al culto seleccionado en{" "}
            <strong className="text-amber-800">{org?.name || "tu sede"}</strong>.
          </p>

          <form onSubmit={handleManualSignUp} className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Nombre Completo
              </label>
              <input
                type="text"
                placeholder="Ej: Emilio Rubio"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Culto / Fecha
              </label>
              <select
                value={manualServiceId}
                onChange={(e) => setManualServiceId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {schedules.length === 0 ? (
                  <option value="">Sin cultos en esta sede</option>
                ) : (
                  schedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({new Date(s.service_date).toLocaleDateString("es-CL")})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Área / Ministerio
              </label>
              <select
                value={manualTeamId}
                onChange={(e) => setManualTeamId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={processing || schedules.length === 0 || teams.length === 0}
                className="w-full bg-slate-300 hover:bg-slate-400 text-slate-700 font-bold text-xs py-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                + Guardar y Anotar al Culto
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. Anotarme para Servir */}
      <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">✋</span>
          <h2 className="font-bold text-slate-800 text-base">
            ¡Anotarme para Servir!
          </h2>
        </div>
        <p className="text-xs text-slate-500">
          Selecciona el culto en {org?.name || "tu sede"} y la función donde servirás.
        </p>

        <form onSubmit={handleSelfSignUp} className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Culto / Fecha
            </label>
            <select
              value={selfServiceId}
              onChange={(e) => setSelfServiceId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {schedules.length === 0 ? (
                <option value="">No hay cultos disponibles</option>
              ) : (
                schedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({new Date(s.service_date).toLocaleDateString("es-CL")})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Área / Ministerio
            </label>
            <select
              value={selfTeamId}
              onChange={(e) => setSelfTeamId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={processing || schedules.length === 0 || teams.length === 0}
              className="w-full bg-slate-300 hover:bg-slate-400 text-slate-700 font-bold text-xs py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              Confirmar mi Asistencia
            </button>
          </div>
        </form>
      </div>

      {/* 3. Cronograma de Servicios y Crear Culto */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">📅</span>
              <h2 className="font-bold text-slate-800 text-base">
                Cronograma de Servicios
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Mostrando cultos de {org?.name || "tu sede"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">
              Filtrar vista por área:
            </span>
            <select
              value={selectedFilterArea}
              onChange={(e) => setSelectedFilterArea(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-none"
            >
              <option value="all">Ver Todas las Áreas</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Formulario Programar Culto */}
        {isLeaderOrAdmin && (
          <form onSubmit={handleCreateCulto} className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Nuevo Culto
              </label>
              <input
                type="text"
                placeholder="Ej: Culto Dominical"
                value={newCultoTitle}
                onChange={(e) => setNewCultoTitle(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Fecha
              </label>
              <input
                type="date"
                value={newCultoDate}
                onChange={(e) => setNewCultoDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Hora
              </label>
              <input
                type="time"
                value={newCultoTime}
                onChange={(e) => setNewCultoTime(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={processing}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 rounded-xl transition-colors shadow-sm"
              >
                + Programar Culto
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-800">Servidores anotados</h3>
            {activeServiceId && (
              <span className="text-[11px] font-semibold text-slate-500">
                {visibleAssignments.length} confirmado(s)
              </span>
            )}
          </div>

          {!activeServiceId ? (
            <p className="text-xs text-slate-400 italic">Programa o selecciona un culto para ver sus asignaciones.</p>
          ) : loading ? (
            <p className="text-xs text-slate-400">Cargando asignaciones...</p>
          ) : visibleAssignments.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Aún no hay servidores anotados para este culto.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {visibleAssignments.map((assignment) => {
                const team = teams.find((item) => item.id === assignment.team_id);
                return (
                  <div key={assignment.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <div>
                      <p className="text-xs font-bold text-slate-800">👤 {assignmentName(assignment)}</p>
                      <p className="text-[11px] text-indigo-600 font-semibold mt-0.5">
                        {team?.name || assignment.role_assigned}
                      </p>
                    </div>
                    <span className="text-[10px] rounded-full bg-emerald-100 text-emerald-700 font-bold px-2 py-1">Confirmado</span>
                  </div>
                );
              })}
            </div>
          )}

          {teams.length === 0 && isLeaderOrAdmin && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Esta iglesia todavía no tiene áreas de servicio configuradas. Crea equipos en la base de datos antes de anotar servidores.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
