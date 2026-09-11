"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/context/OrganizationContext";
import { formatearFechaCulto, horaCulto, downloadCsv } from "@/lib/format";
import { moduloActivo } from "@/lib/plans";
import Link from "next/link";
import LandingPage from "@/components/LandingPage";

interface ServiceSchedule {
  id: string;
  service_date: string;
  title: string;
  description?: string;
  tipo_evento?: string;
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

interface AsistenciaRegistro {
  id: string;
  service_id: string;
  member_id: string | null;
  full_name: string;
  created_at: string;
}

interface MiembroAsistencia {
  id: string;
  full_name: string;
  email?: string | null;
  birth_date?: string | null;
  role?: string | null;
}

const TIPO_EVENTOS: Record<string, { label: string; emoji: string; cls: string }> = {
  culto: { label: "Culto", emoji: "⛪", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  retiro: { label: "Retiro", emoji: "🏕️", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  vigilia: { label: "Vigilia", emoji: "🌙", cls: "bg-purple-50 text-purple-700 border-purple-200" },
  celebracion: { label: "Celebración", emoji: "🎉", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  boda: { label: "Boda", emoji: "💍", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  funeral: { label: "Funeral", emoji: "🕊️", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  otro: { label: "Otro", emoji: "📌", cls: "bg-sky-50 text-sky-700 border-sky-200" },
};

function tipoBadge(tipo?: string) {
  return TIPO_EVENTOS[String(tipo || "culto")] || TIPO_EVENTOS.otro;
}

function santiagoDateKey(instant: string | Date): string {
  return new Date(instant).toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}

function daysUntil(dateKey: string): number {
  const today = new Date(santiagoDateKey(new Date()) + "T12:00:00");
  const target = new Date(dateKey + "T12:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function relativeChip(days: number) {
  if (days === 0) return { text: "Hoy", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" };
  if (days === 1) return { text: "Mañana", cls: "bg-amber-100 text-amber-800 border-amber-300" };
  if (days > 1) return { text: `En ${days} días`, cls: "bg-indigo-50 text-indigo-700 border-indigo-200" };
  return null;
}

function birthdayLabel(days: number) {
  if (days === 0) return { text: "🎉 Hoy", cls: "bg-rose-100 text-rose-800 border-rose-300" };
  if (days === 1) return { text: "Mañana", cls: "bg-amber-100 text-amber-800 border-amber-300" };
  return { text: `En ${days} días`, cls: "bg-sky-50 text-sky-700 border-sky-200" };
}

export default function HomePage() {
  const { org, userProfile, userRole, loading: orgLoading } = useOrganization();
  const [schedules, setSchedules] = useState<ServiceSchedule[]>([]);
  const [teams, setTeams] = useState<MinistryTeam[]>([]);
  const [assignments, setAssignments] = useState<ServiceAssignment[]>([]);
  const [birthdays, setBirthdays] = useState<{ id: string; full_name: string; days: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulario para crear un nuevo culto
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("Culto Dominical");
  const [serviceDate, setServiceDate] = useState("");
  const [serviceTime, setServiceTime] = useState("10:00");
  const [description, setDescription] = useState("");
  const [tipoEvento, setTipoEvento] = useState("culto");
  const [saving, setSaving] = useState(false);

  // Eliminar un culto (solo admin / pastor)
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Editar un culto (título, fecha, hora, descripción) incluido los pasados
  const [editando, setEditando] = useState<ServiceSchedule | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("10:00");
  const [editDescription, setEditDescription] = useState("");
  const [editTipo, setEditTipo] = useState("culto");
  const [savingEdit, setSavingEdit] = useState(false);

  // Asistencia por culto (solo liderazgo): registro de quién asistió
  const [asistenciaRegistros, setAsistenciaRegistros] = useState<AsistenciaRegistro[]>([]);
  const [asistenciaCulto, setAsistenciaCulto] = useState<ServiceSchedule | null>(null);
  const [miembrosAsistencia, setMiembrosAsistencia] = useState<MiembroAsistencia[]>([]);
  const [asistBusqueda, setAsistBusqueda] = useState("");
  const [nombreManual, setNombreManual] = useState("");
  const [cargandoAsist, setCargandoAsist] = useState(false);
  const [guardandoAsist, setGuardandoAsist] = useState(false);

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
  const [vista, setVista] = useState<"proximos" | "todos">("proximos");
  const [filtroTipo, setFiltroTipo] = useState("todos");

  // Si llegan con el enlace del correo al sitio por defecto (token en la URL),
  // se les reenvía a la página de creación de contraseña.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const th = params.get("token_hash") || params.get("token");
    if (th) {
      const tipo = params.get("type") || "recovery";
      window.location.replace(
        `/bienvenida?token_hash=${encodeURIComponent(th)}&type=${encodeURIComponent(tipo)}`
      );
    }
  }, []);

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

        const { data: asistData } = await supabase
          .from("asistencia")
          .select("id, service_id, member_id, full_name, created_at")
          .eq("organization_id", org.id);
        if (active) setAsistenciaRegistros(asistData || []);

        const { data: members } = await supabase
          .from("church_members")
          .select("id, full_name, birth_date")
          .eq("organization_id", org.id)
          .not("birth_date", "is", null);
        if (active) {
          const hoy = new Date();
          const proximos: { id: string; full_name: string; days: number }[] = [];
          for (let i = 0; i <= 7; i++) {
            const target = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i, 12);
            const mmdd = `${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
            (members || []).forEach((m) => {
              const b = String(m.birth_date || "").slice(5, 10);
              if (b === mmdd) proximos.push({ id: String(m.id), full_name: String(m.full_name), days: i });
            });
          }
          proximos.sort((a, b) => a.days - b.days || a.full_name.localeCompare(b.full_name));
          setBirthdays(proximos);
        }
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
          tipo_evento: tipoEvento,
          organization_id: org.id,
        },
      ]);

      if (error) throw error;

      setShowModal(false);
      setTitle("Culto Dominical");
      setServiceDate("");
      setServiceTime("10:00");
      setDescription("");
      setTipoEvento("culto");
      setReloadKey((k) => k + 1);
    } catch (err) {
      alert("Error al guardar culto: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  const isAdminOrLider =
    userRole === "admin" || userRole === "superadmin" || userRole === "lider" || userRole === "pastor";
  const puedeLiderar =
    userRole === "admin" || userRole === "superadmin" || userRole === "pastor" || userRole === "lider" || userRole === "coordinador";
  const canGenerateCultos =
    userRole === "admin" || userRole === "superadmin" || userRole === "pastor";
  const canDeleteCulto =
    userRole === "admin" || userRole === "superadmin" || userRole === "pastor";
  const orgName = org?.name || "tu iglesia";

  const schedulesVisibles = (vista === "proximos"
      ? schedules.filter((s) => daysUntil(santiagoDateKey(s.service_date)) >= 0)
      : schedules
    ).filter((s) => filtroTipo === "todos" || (s.tipo_evento || "culto") === filtroTipo);

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

  const openEdit = (schedule: ServiceSchedule) => {
    const d = new Date(schedule.service_date);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEditTitle(schedule.title);
    setEditDate(local.slice(0, 10));
    setEditTime(local.slice(11, 16));
    setEditDescription(schedule.description || "");
    setEditTipo(schedule.tipo_evento || "culto");
    setEditando(schedule);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org?.id || !editando || !editTitle.trim() || !editDate) return;
    setSavingEdit(true);
    const { error } = await supabase
      .from("service_schedules")
      .update({
        title: editTitle.trim(),
        service_date: new Date(`${editDate}T${editTime || "10:00"}:00`).toISOString(),
        description: editDescription.trim() || null,
        tipo_evento: editTipo,
      })
      .eq("id", editando.id)
      .eq("organization_id", org.id);
    setSavingEdit(false);
    if (error) {
      alert("No se pudo actualizar el culto: " + error.message);
      return;
    }
    setEditando(null);
    setReloadKey((k) => k + 1);
  };

  const abrirAsistencia = async (schedule: ServiceSchedule) => {
    if (!org?.id) return;
    setAsistenciaCulto(schedule);
    setAsistBusqueda("");
    setNombreManual("");
    setCargandoAsist(true);
    try {
      const [memRes, asisRes] = await Promise.all([
        supabase
          .from("church_members")
          .select("id, full_name, email, birth_date, role")
          .eq("organization_id", org.id)
          .order("full_name"),
        supabase
          .from("asistencia")
          .select("id, service_id, member_id, full_name, created_at")
          .eq("organization_id", org.id)
          .eq("service_id", schedule.id),
      ]);
      if (memRes.error) throw memRes.error;
      if (asisRes.error) throw asisRes.error;
      setMiembrosAsistencia((memRes.data || []).map((m) => ({ ...m, email: m.email ?? null, birth_date: m.birth_date ?? null, role: m.role ?? null })));
      setAsistenciaRegistros((prev) => {
        const otros = prev.filter((r) => r.service_id !== schedule.id);
        return [...otros, ...(asisRes.data || [])];
      });
    } catch (err) {
      alert("No se pudo cargar la asistencia: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setCargandoAsist(false);
    }
  };

  const agregarAsistencia = async (miembro: MiembroAsistencia) => {
    if (!org?.id || !asistenciaCulto) return;
    if (asistenciaRegistros.some((r) => r.service_id === asistenciaCulto.id && r.member_id === miembro.id)) return;
    setGuardandoAsist(true);
    try {
      const { error } = await supabase.from("asistencia").insert([
        {
          organization_id: org.id,
          service_id: asistenciaCulto.id,
          member_id: miembro.id,
          full_name: miembro.full_name,
        },
      ]);
      if (error) throw error;
      setAsistenciaRegistros((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          service_id: asistenciaCulto.id,
          member_id: miembro.id,
          full_name: miembro.full_name,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      alert("No se pudo registrar asistencia: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setGuardandoAsist(false);
    }
  };

  const registrarAsistenciaManual = async () => {
    const nombre = nombreManual.trim();
    if (!nombre || !org?.id || !asistenciaCulto) return;
    setGuardandoAsist(true);
    try {
      const { error } = await supabase.from("asistencia").insert([
        {
          organization_id: org.id,
          service_id: asistenciaCulto.id,
          member_id: null,
          full_name: nombre,
        },
      ]);
      if (error) throw error;
      setAsistenciaRegistros((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          service_id: asistenciaCulto.id,
          member_id: null,
          full_name: nombre,
          created_at: new Date().toISOString(),
        },
      ]);
      setNombreManual("");
    } catch (err) {
      alert("No se pudo registrar asistencia: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setGuardandoAsist(false);
    }
  };

  const quitarAsistencia = async (registro: AsistenciaRegistro) => {
    if (!org?.id) return;
    const ok = confirm(`¿Quitar a "${registro.full_name}" de la asistencia?`);
    if (!ok) return;
    const { error } = await supabase.from("asistencia").delete().eq("id", registro.id).eq("organization_id", org.id);
    if (error) {
      alert("No se pudo quitar la asistencia: " + error.message);
      return;
    }
    setAsistenciaRegistros((prev) => prev.filter((r) => r.id !== registro.id));
  };

  const exportarCronograma = () => {
    if (!org) return;
    downloadCsv(
      `cronograma-${org.slug || "iglesia"}.csv`,
      ["Fecha", "Culto", "Tipo", "Hora", "Total confirmados", "Predicador", "Alabanza", "Escuela", "Descripción"],
      schedulesVisibles.map((s) => [
        formatearFechaCulto(s.service_date),
        s.title,
        `${tipoBadge(s.tipo_evento).emoji} ${tipoBadge(s.tipo_evento).label}`,
        horaCulto(s.service_date),
        assignmentCounts(s.id).total,
        teamCountByKeyword(s.id, ["predic", "altar", "orador", "predica"]),
        teamCountByKeyword(s.id, ["adorac", "alabanz", "música", "banda", "sonido", "plataforma"]),
        teamCountByKeyword(s.id, ["escuela", "dominical", "infantil", "niño", "maestr", "profesor"]),
        s.description || "",
      ])
    );
  };

  const assignmentCounts = (serviceId: string) => {
    const grouped = assignments.filter((a) => a.service_id === serviceId);
    const perTeam = teams
      .map((t) => ({ team: t, count: grouped.filter((a) => a.team_id === t.id).length }))
      .filter((x) => x.count > 0);
    const missing = teams.filter((t) => !grouped.some((a) => a.team_id === t.id));
    return { total: grouped.length, perTeam, missing };
  };

  // Confirmados de un culto cuya área coincide con palabras clave (alabanza, escuela, predicación…)
  const teamCountByKeyword = (serviceId: string, keywords: string[]) =>
    assignments.filter(
      (a) =>
        a.service_id === serviceId &&
        a.team_id &&
        teams.some((t) => t.id === a.team_id && keywords.some((k) => t.name.toLowerCase().includes(k)))
    ).length;

  // Resumen para el equipo (KPIs)
  const upcomingSchedules = schedules.filter((s) => daysUntil(santiagoDateKey(s.service_date)) >= 0);
  const upcomingIdsSet = new Set(upcomingSchedules.map((s) => s.id));
  const upcomingAssignments = assignments.filter((a) => upcomingIdsSet.has(a.service_id)).length;
  const nextUpcoming = [...upcomingSchedules].sort((a, b) => a.service_date.localeCompare(b.service_date))[0] || null;

  // En el plan Básico la inscripción de servidores no está activa: las cards
  // muestran fechas y horarios con un bloque informativo en lugar de equipos.
  const esServidoresActivo = org ? moduloActivo(org.plan, "servidores") : false;

  if (orgLoading || (loading && org?.id)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-500">Cargando cronograma...</p>
      </div>
    );
  }

  // Portada pública: cuando se llega sin subdominio (miiglesia.cl) y no hay una
  // iglesia resuelta, se muestra la presentación del sistema en lugar del panel.
  if (!org) {
    return <LandingPage />;
  }

  return (
    <div className="space-y-8">

      {/* Portada pública: lo que ve un visitante sin sesión */}
      {!userProfile && org && (
        <section
          className="relative overflow-hidden rounded-3xl p-6 md:p-10 text-white shadow-xl"
          style={{
            background: `linear-gradient(135deg, ${org.primary_color || "#4F46E5"} 0%, ${org.secondary_color || "#0F172A"} 100%)`,
          }}
        >
          <div className="absolute -right-10 -top-10 w-56 h-56 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6">
            <div className="space-y-3 flex-1">
              <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                Bienvenidos a
              </span>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">{org.name}</h1>
              <p className="text-sm text-white/80 max-w-xl leading-relaxed">
                Organizamos los próximos servicios, los equipos de adoración, la escuela dominical y el
                servicio de cada semana. Consulta las fechas de abajo y anótate para servir.
              </p>
              {(org.address || org.service_times || org.contact_phone) && (
                <div className="flex flex-wrap gap-2 text-xs font-semibold text-white/90">
                  {org.address && (
                    <span className="bg-white/10 border border-white/20 rounded-full px-3 py-1">📍 {org.address}</span>
                  )}
                  {org.service_times && (
                    <span className="bg-white/10 border border-white/20 rounded-full px-3 py-1">🕐 {org.service_times}</span>
                  )}
                  {org.contact_phone && (
                    <span className="bg-white/10 border border-white/20 rounded-full px-3 py-1">📞 {org.contact_phone}</span>
                  )}
                </div>
              )}
              {schedules.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/70 mb-2">
                    Próximos cultos
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs font-bold text-white">
                    {schedules.slice(0, 3).map((schedule) => (
                      <span
                        key={schedule.id}
                        className="bg-white/10 border border-white/25 rounded-full px-3 py-1.5"
                      >
                        🗓️ {formatearFechaCulto(schedule.service_date)}
                        {horaCulto(schedule.service_date) && (
                          <span className="text-white/80"> · ⏰ {horaCulto(schedule.service_date)}</span>
                        )}
                      </span>
                    ))}
                    <a
                      href="#cronograma"
                      className="bg-white/20 hover:bg-white/30 border border-white/30 rounded-full px-3 py-1.5 transition-colors"
                    >
                      Ver cronograma ↓
                    </a>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href={`/login?org=${org.slug}&mode=login`}
                  className="bg-white text-slate-900 font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-slate-100 transition-colors"
                >
                  Ingresar
                </Link>
                <Link
                  href={`/login?org=${org.slug}&mode=register`}
                  className="bg-slate-900/40 hover:bg-slate-900/60 border border-white/50 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
                >
                  Crear cuenta
                </Link>
              </div>
            </div>
            <div className="shrink-0 mx-auto md:mx-0">
              <img
                src={org.logo_url || "/logo.png"}
                alt={`Logo de ${org.name}`}
                className="w-24 h-24 md:w-32 md:h-32 rounded-3xl border-4 border-white/30 object-cover bg-white/10"
              />
            </div>
          </div>
        </section>
      )}
      
      {/* Cumpleaños de la semana (miembros con sesión) */}
      {userProfile && birthdays.length > 0 && (
        <section className="rounded-3xl p-5 border border-rose-100 bg-gradient-to-r from-rose-50 to-pink-50 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-rose-900 mb-3">🎂 Cumpleaños esta semana</h2>
          <div className="flex flex-wrap gap-2">
            {birthdays.map((b) => {
              const label = birthdayLabel(b.days);
              return (
                <span
                  key={b.id}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border ${label.cls}`}
                >
                  {b.full_name}
                  <span className="opacity-80">{label.text}</span>
                </span>
              );
            })}
          </div>
        </section>
      )}

      {/* KPIs para el equipo */}
      {userProfile && schedules.length > 0 && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            href="#cronograma"
            className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 hover:shadow-md transition-shadow"
          >
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">🗓️ Próximos cultos</p>
            <p className="text-2xl font-extrabold text-indigo-700 mt-1">{upcomingSchedules.length}</p>
            {nextUpcoming && (
              <p className="text-[11px] text-slate-500 mt-0.5">Siguiente: {formatearFechaCulto(nextUpcoming.service_date)}</p>
            )}
          </Link>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">🎂 Cumpleaños</p>
            <p className="text-2xl font-extrabold text-rose-700 mt-1">{birthdays.length}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">esta semana</p>
          </div>
          {esServidoresActivo && (
            <>
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">👥 Confirmaciones</p>
                <p className="text-2xl font-extrabold text-slate-800 mt-1">{upcomingAssignments}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">servidores en cultos próximos</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">🎶 Alabanza en próximos</p>
                <p className="text-2xl font-extrabold text-purple-700 mt-1">
                  {upcomingSchedules.filter((s) => teamCountByKeyword(s.id, ["adorac", "alabanz", "música", "banda", "sonido", "plataforma"]) > 0).length}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">de {upcomingSchedules.length} cultos</p>
              </div>
            </>
          )}
        </section>
      )}

      {/* Resumen público de la agenda, conservando el diseño de la versión anterior. */}
      <div id="cronograma" className="rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-slate-900 border border-slate-800">
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
            {canGenerateCultos && (
              <>
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
              </>
            )}
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span>📅</span> Próximas Fechas
            <span className="text-xs font-semibold text-slate-400">
              ({schedulesVisibles.length})
            </span>
          </h2>

          <div className="flex items-center gap-2">
            <button
              onClick={exportarCronograma}
              disabled={schedulesVisibles.length === 0}
              className="text-xs font-bold px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white transition-colors"
            >
              ⬇️ CSV
            </button>
            <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-xl p-1">
            <button
              onClick={() => setVista("proximos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                vista === "proximos" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Próximos
            </button>
            <button
              onClick={() => setVista("todos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                vista === "todos" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Todos
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFiltroTipo("todos")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              filtroTipo === "todos"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
            }`}
          >
            Todos los tipos
          </button>
          {Object.entries(TIPO_EVENTOS).map(([clave, t]) => (
            <button
              key={clave}
              onClick={() => setFiltroTipo(clave)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                filtroTipo === clave
                  ? "bg-slate-900 text-white border-slate-900"
                  : `${t.cls} border-transparent hover:opacity-80`
              }`}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </div>

        {schedulesVisibles.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-3 shadow-sm">
            <div className="text-4xl">⛪</div>
            <h3 className="text-base font-bold text-slate-800">Sin cultos registrados aún</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {vista === "proximos" && schedules.length > 0 ? (
                "No hay cultos próximos, pero sí en el historial. Cambia a “Todos” para verlos."
              ) : (
                <>
                  No hay reuniones agendadas para <strong>{orgName}</strong>.{" "}
                  {canGenerateCultos
                    ? "Haz clic en el botón de arriba para agregar la primera."
                    : "Un pastor o administrador debe agendar las fechas."}
                </>
              )}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {schedulesVisibles.map((schedule) => (
              <div
                key={schedule.id}
                className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-slate-800 break-words">{schedule.title}</h3>
                      {(() => {
                        const tb = tipoBadge(schedule.tipo_evento);
                        return (
                          <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${tb.cls}`}>
                            {tb.emoji} {tb.label}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {puedeLiderar && (
                        <button
                          onClick={() => abrirAsistencia(schedule)}
                          title="Registrar asistencia"
                          className="text-xs text-slate-300 hover:text-emerald-500 transition-colors"
                        >
                          ✅
                        </button>
                      )}
                      {isAdminOrLider && (
                        <button
                          onClick={() => openEdit(schedule)}
                          title="Editar culto"
                          className="text-xs text-slate-300 hover:text-indigo-500 transition-colors"
                        >
                          ✏️
                        </button>
                      )}
                      {canDeleteCulto && (
                        <button
                          onClick={() => handleDeleteSchedule(schedule)}
                          disabled={deletingId === schedule.id}
                          title="Eliminar culto"
                          className="text-xs text-slate-300 hover:text-red-500 transition-colors"
                        >
                          {deletingId === schedule.id ? "..." : "🗑️"}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-indigo-600 font-semibold mt-1 flex flex-wrap items-center gap-x-2">
                    <span>🗓️ {formatearFechaCulto(schedule.service_date)}</span>
                    {horaCulto(schedule.service_date) && (
                      <span className="text-indigo-400">— ⏰ {horaCulto(schedule.service_date)}</span>
                    )}
                    {(() => {
                      const chip = relativeChip(daysUntil(santiagoDateKey(schedule.service_date)));
                      return chip ? (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${chip.cls}`}>
                          {chip.text}
                        </span>
                      ) : null;
                    })()}
                    {(() => {
                      const n = asistenciaRegistros.filter((r) => r.service_id === schedule.id).length;
                      return n > 0 ? (
                        <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200">
                          ✅ {n} asistente{n !== 1 ? "s" : ""}
                        </span>
                      ) : null;
                    })()}
                  </p>

{schedule.description && (
                    <p className="text-xs text-slate-500 line-clamp-2">{schedule.description}</p>
                  )}

                  {esServidoresActivo ? (
                    <>
                      <div className="grid gap-2">
                    {(() => {
                      const n = teamCountByKeyword(schedule.id, ["predic", "altar", "orador", "predica"]);
                      return (
                        <Link
                          href={`/servidores?service_id=${schedule.id}`}
                          className="bg-blue-50/60 border border-blue-100 rounded-xl p-2.5 hover:bg-blue-50 transition-colors"
                        >
                          <p className="text-xs font-bold text-blue-900">
                            📖 Predicador / Altar
                            <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${n > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white text-blue-400 border-blue-200"}`}>
                              {n > 0 ? `${n} confirmado${n !== 1 ? "s" : ""}` : "sin confirmar"}
                            </span>
                          </p>
                          <p className="text-[11px] text-blue-400 italic mt-1">Coordinar predicador y altar en Servidores.</p>
                        </Link>
                      );
                    })()}
                    {(() => {
                      const n = teamCountByKeyword(schedule.id, ["adorac", "alabanz", "música", "banda", "sonido", "plataforma"]);
                      return (
                        <Link
                          href="/adoracion"
                          className="bg-purple-50/60 border border-purple-100 rounded-xl p-2.5 hover:bg-purple-50 transition-colors"
                        >
                          <p className="text-xs font-bold text-purple-900">
                            🎵 Equipo de Adoración
                            <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${n > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white text-purple-400 border-purple-200"}`}>
                              {n > 0 ? `${n} músico${n !== 1 ? "s" : ""}` : "sin músicos"}
                            </span>
                          </p>
                          <p className="text-[11px] text-purple-400 italic mt-1">Bandas, setlist y roles en Adoración.</p>
                        </Link>
                      );
                    })()}
                    {(() => {
                      const n = teamCountByKeyword(schedule.id, ["escuela", "dominical", "infantil", "niño", "maestr", "profesor"]);
                      return (
                        <Link
                          href="/escuela-dominical"
                          className="bg-amber-50/60 border border-amber-100 rounded-xl p-2.5 hover:bg-amber-50 transition-colors"
                        >
                          <p className="text-xs font-bold text-amber-950">
                            👧 Escuela Dominical
                            <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${n > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white text-amber-500 border-amber-200"}`}>
                              {n > 0 ? `${n} maestra${n !== 1 ? "s" : ""}` : "sin maestras"}
                            </span>
                          </p>
                          <p className="text-[11px] text-amber-600/70 italic mt-1">Lecciones y maestras en Escuela Dominical.</p>
                        </Link>
                      );
                    })()}
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
                      </>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 text-center">
                        <p className="text-2xl mb-1">🌱</p>
                        <p className="text-xs font-bold text-slate-700">Plan Básico</p>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                          Este culto está agendado con su fecha y horario. Las áreas de servicio
                          (adoración, escuela, ujieres) se habilitan al subir de plan.
                        </p>
                        {isAdminOrLider && (
                          <Link
                            href="/configuracion"
                            className="mt-2 inline-block text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                          >
                            ⚙️ Configuración →
                          </Link>
                        )}
                      </div>
                    )}
                </div>

                {esServidoresActivo && (
                <Link
                  href={`/servidores?service_id=${schedule.id}`}
                  className="w-full text-center bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors block"
                >
                  Anotarme para Servir →
                </Link>
                )}
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de evento</label>
                <select
                  value={tipoEvento}
                  onChange={(e) => setTipoEvento(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                >
                  {Object.entries(TIPO_EVENTOS).map(([clave, t]) => (
                    <option key={clave} value={clave}>
                      {t.emoji} {t.label}
                    </option>
                  ))}
                </select>
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

    {/* Modal para Editar Servicio */}
      {editando && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-800">✏️ Editar Culto</h3>
              <button
                onClick={() => setEditando(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Título del Servicio</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Culto Dominical / Noche de Milagros"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Fecha del Servicio</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hora del Servicio</label>
                  <input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de evento</label>
                <select
                  value={editTipo}
                  onChange={(e) => setEditTipo(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                >
                  {Object.entries(TIPO_EVENTOS).map(([clave, t]) => (
                    <option key={clave} value={clave}>
                      {t.emoji} {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descripción / Notas (Opcional)</label>
                <textarea
                  rows={3}
                  placeholder="Información relevante para los servidores..."
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditando(null)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  {savingEdit ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    {/* Modal de Asistencia por Culto (solo liderazgo) */}
      {asistenciaCulto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">✅ Asistencia · {asistenciaCulto.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  🗓️ {formatearFechaCulto(asistenciaCulto.service_date)}
                  {horaCulto(asistenciaCulto.service_date) && ` · ⏰ ${horaCulto(asistenciaCulto.service_date)}`}
                </p>
              </div>
              <button
                onClick={() => setAsistenciaCulto(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-700 mb-2">
                Asistentes registrados{" "}
                <span className="text-emerald-700">
                  ({asistenciaRegistros.filter((r) => r.service_id === asistenciaCulto.id).length})
                </span>
              </p>
              {cargandoAsist ? (
                <p className="text-xs text-slate-400 py-4 text-center">Cargando...</p>
              ) : (
                <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {asistenciaRegistros.filter((r) => r.service_id === asistenciaCulto.id).length === 0 && (
                    <li className="text-xs text-slate-400 text-center py-3">Aún no hay asistentes registrados.</li>
                  )}
                  {asistenciaRegistros
                    .filter((r) => r.service_id === asistenciaCulto.id)
                    .map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2"
                      >
                        <span className="text-xs font-semibold text-slate-700">{r.full_name}</span>
                        <button
                          onClick={() => quitarAsistencia(r)}
                          className="text-xs text-slate-300 hover:text-red-500 transition-colors"
                          title="Quitar"
                        >
                          🗑️
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Buscar miembro del directorio</label>
              <input
                type="text"
                placeholder="Escribe un nombre..."
                value={asistBusqueda}
                onChange={(e) => setAsistBusqueda(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto pr-1">
                {miembrosAsistencia
                  .filter((m) => m.full_name.toLowerCase().includes(asistBusqueda.trim().toLowerCase()))
                  .filter(
                    (m) =>
                      !asistenciaRegistros.some(
                        (r) => r.service_id === asistenciaCulto.id && r.member_id === m.id
                      )
                  )
                  .slice(0, 12)
                  .map((m) => (
                    <li key={m.id}>
                      <button
                        onClick={() => agregarAsistencia(m)}
                        disabled={guardandoAsist}
                        className="w-full text-left bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition-colors disabled:opacity-50"
                      >
                        {m.full_name}
                        {m.email ? <span className="text-slate-400 font-normal"> · {m.email}</span> : null}
                      </button>
                    </li>
                  ))}
              </ul>
              <p className="text-[11px] text-slate-400 mt-1">
                💡 Elige a alguien del directorio o registra un nombre libre abajo.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                registrarAsistenciaManual();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="Nombre del visitante (no está en el directorio)"
                value={nombreManual}
                onChange={(e) => setNombreManual(e.target.value)}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <button
                type="submit"
                disabled={guardandoAsist || !nombreManual.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-4 py-2.5 text-xs font-bold transition-colors disabled:opacity-50"
              >
                {guardandoAsist ? "..." : "+ Registrar"}
              </button>
            </form>

            <button
              onClick={() => setAsistenciaCulto(null)}
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
