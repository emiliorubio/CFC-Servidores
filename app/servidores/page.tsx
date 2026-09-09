"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/context/OrganizationContext";
import { formatearFechaCorta } from "@/lib/format";

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
  note?: string | null;
  profiles?: {
    full_name: string;
  } | null;
}

interface ChurchMember {
  id: string;
  full_name: string;
  phone: string | null;
  user_id: string | null;
}

interface MyAssignment {
  id: string;
  service_id: string;
  team_id: string | null;
  role_assigned: string;
}

export default function ServidoresPage() {
  const searchParams = useSearchParams();
  const selectedServiceId = searchParams.get("service_id");

  const { org, userProfile, userRole, loading: orgLoading } = useOrganization();

  const [schedules, setSchedules] = useState<ServiceSchedule[]>([]);
  const [activeServiceId, setActiveServiceId] = useState<string | null>(selectedServiceId);
  const [teams, setTeams] = useState<MinistryTeam[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [myAssignments, setMyAssignments] = useState<MyAssignment[]>([]);
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

  // Directorio (para recordatorios por WhatsApp)
  const [members, setMembers] = useState<ChurchMember[]>([]);
  const [recordatorioAbierto, setRecordatorioAbierto] = useState(false);
  const [copiandoRecordatorio, setCopiandoRecordatorio] = useState(false);

  const fetchSchedules = useCallback(async () => {
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
        // Preferir el próximo culto futuro; si no hay, el más reciente.
        const nowTs = Date.now();
        const upcoming = data.filter((s) => new Date(s.service_date).getTime() >= nowTs);
        const preferredId = upcoming[0]?.id || data[data.length - 1]?.id || data[0].id;
        setActiveServiceId((prev) => prev || preferredId);
        setManualServiceId(preferredId);
        setSelfServiceId(preferredId);
      }
    } catch (err) {
      console.error("Error al cargar servicios:", err);
    }
  }, [org]);

  const fetchTeams = useCallback(async () => {
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
  }, [org]);

  const fetchMembers = useCallback(async () => {
    if (!org?.id) return;
    try {
      const { data, error } = await supabase
        .from("church_members")
        .select("id, full_name, phone, user_id")
        .eq("organization_id", org.id);
      if (error) throw error;
      setMembers((data || []) as ChurchMember[]);
    } catch (err) {
      console.error("Error al cargar el directorio:", err);
    }
  }, [org]);

  const fetchDataForService = useCallback(async (serviceId: string) => {
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
  }, []);

  const fetchMyAssignments = useCallback(async () => {
    if (!org?.id || !userProfile?.id) return;
    const { data } = await supabase
      .from("service_assignments")
      .select("id, service_id, team_id, role_assigned")
      .eq("organization_id", org.id)
      .eq("user_id", userProfile.id)
      .order("created_at", { ascending: true });
    setMyAssignments(data || []);
  }, [org, userProfile]);

  useEffect(() => {
    if (org?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de cultos, equipos, directorio y confirmaciones al montar
      fetchSchedules();
      fetchTeams();
      fetchMembers();
      fetchMyAssignments();
    }
  }, [org?.id, fetchSchedules, fetchTeams, fetchMembers, fetchMyAssignments]);

  useEffect(() => {
    if (activeServiceId && org?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de asignaciones del culto seleccionado
      fetchDataForService(activeServiceId);
    }
  }, [activeServiceId, org?.id, fetchDataForService]);

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
    } catch (err) {
      alert("Error al anotar hermano: " + (err instanceof Error ? err.message : String(err)));
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
      // Evitar duplicados: un miembro no puede anotarse dos veces a la MISMA área
      // del mismo culto (sí puede ayudar en varias áreas del mismo culto).
      const { data: existing } = await supabase
        .from("service_assignments")
        .select("id")
        .eq("service_id", selfServiceId)
        .eq("user_id", userProfile.id)
        .eq("team_id", selfTeamId)
        .maybeSingle();
      if (existing) {
        alert("Ya confirmaste tu asistencia en esta área de este culto.");
        setProcessing(false);
        return;
      }

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
      await fetchMyAssignments();
    } catch (err) {
      alert("Error al inscribirse: " + (err instanceof Error ? err.message : String(err)));
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
      const { error } = await supabase.from("service_schedules").insert([
        {
          title: newCultoTitle,
          service_date: new Date(`${newCultoDate}T${newCultoTime || "10:00"}:00`).toISOString(),
          organization_id: org.id,
        },
      ]);

      if (error) throw error;
      setNewCultoTitle("");
      setNewCultoDate("");
      fetchSchedules();
    } catch (err) {
      alert("Error al crear culto: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelMyAssignment = async (assignment: MyAssignment) => {
    if (!userProfile?.id) return;
    if (!window.confirm("¿Te desinscribes de esta confirmación?")) return;
    setProcessing(true);
    const { error } = await supabase
      .from("service_assignments")
      .delete()
      .eq("id", assignment.id)
      .eq("user_id", userProfile.id);
    setProcessing(false);
    if (error) {
      alert("No se pudo cancelar: " + error.message);
      return;
    }
    await fetchMyAssignments();
    if (activeServiceId) await fetchDataForService(activeServiceId);
  };

  const handleRemoveAssignment = async (assignment: Assignment) => {
    const name = assignmentName(assignment);
    if (!window.confirm(`¿Quitar a "${name}" de la lista de este culto?`)) return;
    setProcessing(true);
    const { error } = await supabase
      .from("service_assignments")
      .delete()
      .eq("id", assignment.id)
      .eq("organization_id", org?.id);
    setProcessing(false);
    if (error) {
      alert("No se pudo quitar: " + error.message);
      return;
    }
    if (activeServiceId) await fetchDataForService(activeServiceId);
    await fetchMyAssignments();
  };

  const handleSetNote = async (assignment: Assignment) => {
    if (!org?.id) return;
    const actual = assignment.note || "";
    const valor = window.prompt(`Nota / indicación para ${assignmentName(assignment)}:`, actual);
    if (valor === null) return;
    const limpio = valor.trim();
    const { error } = await supabase
      .from("service_assignments")
      .update({ note: limpio || null })
      .eq("id", assignment.id)
      .eq("organization_id", org.id);
    if (error) {
      alert("No se pudo guardar la nota: " + error.message);
      return;
    }
    if (activeServiceId) await fetchDataForService(activeServiceId);
  };

  const waDigits = (phone: string) => {
    const d = phone.replace(/\D/g, "");
    if (d.length < 9) return null;
    if (d.startsWith("56")) return d;
    if (d.startsWith("0")) return "56" + d.slice(1);
    return "56" + d;
  };

  const recordatorioText = (nombre: string) => {
    const culto = schedules.find((s) => s.id === activeServiceId);
    const lines = [
      `Hola ${nombre}! 🙏`,
      `El culto "${culto?.title || "de esta semana"} se acerca"${culto ? ` (${formatearFechaCorta(culto.service_date)})` : ""} y aún no tienes tu confirmación en ${org?.name || "la iglesia"}.`,
      "¿Podrías confirmar si puedes servir? ¡Te esperamos! 🙌",
    ];
    return lines.join("\n");
  };

  const confirmedUserIds = new Set(
    assignments.filter((a) => a.user_id).map((a) => a.user_id as string)
  );
  const pendingMembers = members.filter((m) => !(m.user_id && confirmedUserIds.has(m.user_id)) && m.phone);
  const pendingWithWa = pendingMembers
    .map((m) => ({ ...m, wa: waDigits(m.phone || "") }))
    .filter((m) => m.wa);

  const copiarListaRecordatorio = async () => {
    if (pendingMembers.length === 0) return;
    const text = pendingMembers
      .map((m) => `${m.full_name}${m.phone ? ` — ${m.phone}` : ""}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiandoRecordatorio(true);
      setTimeout(() => setCopiandoRecordatorio(false), 2000);
    } catch {
      window.alert("No se pudo copiar la lista. Revisa los permisos del portapapeles.");
    }
  };

  const isLeaderOrAdmin =
    userRole === "admin" || userRole === "superadmin" || userRole === "lider" || userRole === "pastor";

  const visibleAssignments = selectedFilterArea === "all"
    ? assignments
    : assignments.filter((assignment) => assignment.team_id === selectedFilterArea);

  const assignmentName = (assignment: Assignment) =>
    assignment.manual_name || assignment.profiles?.full_name || "Servidor confirmado";

  const avisoText = () => {
    if (!activeServiceId) return null;
    const culto = schedules.find((s) => s.id === activeServiceId);
    const lines: string[] = [];
    lines.push(`⛪ SERVICIOS ${(org?.name || "IGLESIA").toUpperCase()}`);
    if (culto) lines.push(`📅 ${culto.title} — ${formatearFechaCorta(culto.service_date)}`);

    const cubiertas: string[] = [];
    const faltantes: string[] = [];
    teams.forEach((t) => {
      const teamAssigns = assignments.filter((a) => a.team_id === t.id);
      if (teamAssigns.length > 0) {
        cubiertas.push(`${t.name}: ${teamAssigns.map(assignmentName).join(", ")}`);
      } else {
        faltantes.push(t.name);
      }
    });

    if (cubiertas.length > 0) {
      lines.push("");
      lines.push("✅ ANOTADO:");
      lines.push(...cubiertas);
    }
    if (faltantes.length > 0) {
      lines.push("");
      lines.push(`⚠️ FALTAN SERVIR: ${faltantes.join(", ")}`);
    } else {
      lines.push("");
      lines.push("🎉 ¡Todas las áreas cubiertas!");
    }
    return lines.join("\n");
  };

  const compartirWhatsApp = () => {
    const text = avisoText();
    if (!text) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const copiarAviso = async () => {
    const text = avisoText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      window.alert("Aviso copiado. Pégalo en el grupo de WhatsApp para pedir los que faltan.");
    } catch {
      window.alert("No se pudo copiar el aviso. Revisa los permisos del portapapeles.");
    }
  };

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
            Registra a la persona y la asigna al culto seleccionado en{" "}
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
{s.title} ({formatearFechaCorta(s.service_date)})
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

      {/* 1.5 Mis confirmaciones */}
      {myAssignments.length > 0 && (
        <div className="bg-sky-50/50 border border-sky-100 rounded-2xl p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">✅</span>
            <div>
              <h2 className="font-bold text-slate-800 text-base">Mis confirmaciones</h2>
              <p className="text-xs text-slate-500">
                Los cultos en los que ya estás anotado/a en {org?.name || "tu sede"}.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {myAssignments.map((ma) => {
              const culto = schedules.find((s) => s.id === ma.service_id);
              const team = teams.find((t) => t.id === ma.team_id);
              const label = `${team?.name || ma.role_assigned}`;
              return (
                <div
                  key={ma.id}
                  className="flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2"
                >
                  <p className="text-xs font-bold text-slate-800">
                    {culto?.title || "Culto"}
                    <span className="text-slate-400 font-semibold">
                      {" "}
                      ({culto ? formatearFechaCorta(culto.service_date) : ""})
                    </span>
                  </p>
                  <span className="text-[10px] font-bold text-sky-700 bg-sky-100 border border-sky-200 px-2 py-0.5 rounded-md">
                    {label}
                  </span>
                  <button
                    onClick={() => handleCancelMyAssignment(ma)}
                    disabled={processing}
                    title="Desinscribirme de este culto"
                    className="text-xs text-slate-300 hover:text-red-500 transition-colors disabled:opacity-40"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
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
                    {s.title} ({formatearFechaCorta(s.service_date)})
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
            <div className="flex items-center gap-2">
              {activeServiceId && (
                <>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {visibleAssignments.length} confirmado(s)
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                      assignments.filter((a) => a.service_id === activeServiceId).length === 0
                        ? "bg-amber-50 text-amber-800 border-amber-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                  >
                    {teams.filter((t) => assignments.some((a) => a.team_id === t.id)).length}/
                    {teams.length} áreas cubiertas
                  </span>
                </>
              )}
              <button
                onClick={copiarAviso}
                disabled={!activeServiceId}
                className="text-[10px] font-bold px-2.5 py-1.5 rounded-xl bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-300 transition-colors"
              >
                📋 Copiar aviso
              </button>
              <button
                onClick={compartirWhatsApp}
                disabled={!activeServiceId}
                className="text-[10px] font-bold px-2.5 py-1.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
              >
                📱 Avisar por WhatsApp
              </button>
              <button
                onClick={() => setRecordatorioAbierto(true)}
                disabled={!activeServiceId}
                className="text-[10px] font-bold px-2.5 py-1.5 rounded-xl bg-sky-500 text-white hover:bg-sky-600 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
              >
                🔔 Recordar faltantes
              </button>
            </div>
          </div>

          {teams.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {teams.map((team) => {
                const count = assignments.filter((a) => a.team_id === team.id).length;
                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() =>
                      setSelectedFilterArea((prev) => (prev === team.id ? "all" : team.id))
                    }
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                      selectedFilterArea === team.id
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : count > 0
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          : "bg-amber-50 text-amber-700 border-dashed border-amber-300 hover:bg-amber-100"
                    }`}
                  >
                    {team.name.split("(")[0].trim()} {count > 0 ? `${count}` : "· falta"}
                  </button>
                );
              })}
            </div>
          )}

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
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="text-xs font-bold text-slate-800">👤 {assignmentName(assignment)}</p>
                        <p className="text-[11px] text-indigo-600 font-semibold mt-0.5">
                          {team?.name || assignment.role_assigned}
                        </p>
                        {assignment.note && (
                          <p className="text-[11px] text-slate-500 italic mt-0.5">🗒️ {assignment.note}</p>
                        )}
                      </div>
                      <span className="text-[10px] rounded-full bg-emerald-100 text-emerald-700 font-bold px-2 py-1">Confirmado</span>
                      {isLeaderOrAdmin && (
                        <>
                          <button
                            onClick={() => handleSetNote(assignment)}
                            title="Nota / indicación para este servidor"
                            className="text-xs text-slate-300 hover:text-indigo-500 transition-colors disabled:opacity-40"
                          >
                            🗒️
                          </button>
                          <button
                            onClick={() => handleRemoveAssignment(assignment)}
                            disabled={processing}
                            title="Quitar a este servidor de la lista"
                            className="text-xs text-slate-300 hover:text-red-500 transition-colors disabled:opacity-40"
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
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

      {/* Modal: recordar por WhatsApp a quienes faltan */}
      {recordatorioAbierto && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setRecordatorioAbierto(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-100 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-800">🔔 Recordar a quienes faltan</h3>
              <button
                onClick={() => setRecordatorioAbierto(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {(() => {
              const culto = schedules.find((s) => s.id === activeServiceId);
              return (
                <p className="text-xs text-slate-500">
                  {culto?.title || "Culto"}
                  {culto ? ` (${formatearFechaCorta(culto.service_date)})` : ""} · {pendingWithWa.length} miembro(s) del directorio con WhatsApp sin confirmar. Abre cada enlace para enviarle el recordatorio.
                </p>
              );
            })()}

            {pendingWithWa.length === 0 ? (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-6 text-center">
                <p className="text-3xl mb-2">🎉</p>
                <p className="text-xs text-emerald-800 font-bold">
                  ¡Todos los miembros con WhatsApp ya confirmaron en este culto!
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500">Lista del directorio sin confirmar</span>
                  <button
                    onClick={copiarListaRecordatorio}
                    disabled={pendingMembers.length === 0}
                    className="text-[10px] font-bold bg-slate-900 hover:bg-slate-700 text-white px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {copiandoRecordatorio ? "✓ Lista copiada" : "📋 Copiar lista"}
                  </button>
                </div>
                <div className="space-y-2">
                  {pendingWithWa.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">👤 {m.full_name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{m.phone}</p>
                      </div>
                      <a
                        href={`https://wa.me/${m.wa}?text=${encodeURIComponent(recordatorioText(m.full_name))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-xl transition-colors shrink-0"
                      >
                        📱 Recordar
                      </a>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
