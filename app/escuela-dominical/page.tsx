"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/context/OrganizationContext";
import { formatearFechaCulto, horaCulto, downloadCsv } from "@/lib/format";
import RestrictedAccess from "@/components/RestrictedAccess";
import PlanDisabled from "@/components/PlanDisabled";
import { moduloActivo } from "@/lib/plans";

interface EscuelaCulto {
  id: string;
  title?: string | null;
  service_type?: string | null;
  service_date?: string | null;
  date?: string | null;
  time?: string | null;
  start_time?: string | null;
  service_time?: string | null;
  hora?: string | null;
}

interface EscuelaAssignment {
  id: string;
  service_id: string;
  team_id?: string | null;
  user_id?: string | null;
  manual_name?: string | null;
  role_assigned?: string | null;
  organization_id: string;
  profiles?: { full_name: string } | null;
  service_schedule_id?: string | null;
  displayName: string;
  resolvedArea: string;
}

interface EscuelaLesson {
  id: string;
  service_schedule_id: string;
  organization_id: string;
  group_name: string;
  topic: string;
  material_url?: string | null;
}

interface AttendanceRow {
  id: string;
  lesson_id: string;
  full_name: string;
  present: boolean;
}

export default function EscuelaDominicalPage() {
  const { org, loading: orgLoading, canSeeEscuela, canManageEscuela } = useOrganization();
  const [cultos, setCultos] = useState<EscuelaCulto[]>([]);
  const [selectedCulto, setSelectedCulto] = useState<string>("");
  const [groupName, setGroupName] = useState("Párvulos (3-6 años)");
  const [topic, setTopic] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [assignments, setAssignments] = useState<EscuelaAssignment[]>([]);
  const [lessons, setLessons] = useState<EscuelaLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [attendanceInput, setAttendanceInput] = useState<Record<string, string>>({});
  const [attendanceSaving, setAttendanceSaving] = useState<Record<string, boolean>>({});
  const [copySourceCulto, setCopySourceCulto] = useState("");
  const [nextCultoCulto, setNextCultoCulto] = useState<EscuelaCulto | null>(null);

  const fetchInitialData = useCallback(async () => {
    if (!org?.id) return;

    // 1. Cultos
    const { data: serviceData } = await supabase
      .from("service_schedules")
      .select("*")
      .eq("organization_id", org.id)
      .order("service_date", { ascending: true });

    // 2. Datos para cruce de nombres y equipos
    const { data: teamsData } = await supabase.from("ministry_teams").select("id, name").eq("organization_id", org.id);
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").eq("organization_id", org.id);
    const { data: members } = await supabase.from("church_members").select("id, full_name").eq("organization_id", org.id);
    const { data: assignData } = await supabase
      .from("service_assignments")
      .select("*, profiles(full_name)")
      .eq("organization_id", org.id);
    const { data: lessonData } = await supabase
      .from("sunday_school_lessons")
      .select("*")
      .eq("organization_id", org.id);
    const { data: attendanceData } = await supabase
      .from("sunday_school_attendance")
      .select("id, lesson_id, full_name, present")
      .eq("organization_id", org.id);

    if (serviceData && serviceData.length > 0) {
      setCultos(serviceData as EscuelaCulto[]);
      setSelectedCulto(serviceData[0].id);
      const nowTime = Date.now();
      const upcoming =
        serviceData.filter((c) => new Date(c.service_date || c.date || "").getTime() >= nowTime);
      setNextCultoCulto((upcoming[0] as EscuelaCulto) || null);
    }

    if (assignData) {
      const enrichedAssignments = assignData.map((asgn) => {
        let name = asgn.manual_name || asgn.profiles?.full_name || "";
        if (!name) {
          const prof = profiles?.find((p) => p.id === asgn.user_id);
          const mem = members?.find((m) => m.id === asgn.user_id);
          name = prof?.full_name || mem?.full_name || "Maestra Confirmada";
        }
        const teamObj = teamsData?.find((t) => t.id === asgn.team_id);
        const areaName = teamObj?.name || asgn.role_assigned || "";

        return { ...asgn, service_schedule_id: asgn.service_id, displayName: name, resolvedArea: areaName };
      });
      setAssignments(enrichedAssignments as EscuelaAssignment[]);
    }

    if (lessonData) setLessons(lessonData as EscuelaLesson[]);
    if (attendanceData) setAttendance(attendanceData as AttendanceRow[]);

    setLoading(false);
  }, [org]);

  useEffect(() => {
    if (org?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de clases y lecciones
      fetchInitialData();
    }
  }, [org?.id, fetchInitialData]);

  // Formateador de Fecha (compartido con el Inicio para que SIEMPRE coincidan)
  const formatCleanDate = (culto: EscuelaCulto) =>
    formatearFechaCulto(culto.service_date || culto.date);

  // Formateador de Hora (compartido con el Inicio)
  const formatCleanTime = (culto: EscuelaCulto) => {
    const hora = horaCulto(culto.service_date || culto.date);
    if (hora) return hora;
    const explicitTime = culto.service_time || culto.time || culto.start_time || culto.hora;
    if (explicitTime) {
      const [hh, mm] = explicitTime.split(":");
      if (hh && mm) return `${hh}:${mm} hrs`;
    }
    return "Por confirmar";
  };

  // Subir lección con PDF al bucket "materials"
  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    const organizationId = org?.id;
    if (!selectedCulto || !topic.trim() || !organizationId) return;

    setSaving(true);
    setMessage(null);
    let uploadedPdfUrl = "";

    if (pdfFile) {
      const fileExt = pdfFile.name.split(".").pop();
      const fileName = `escuela_${Date.now()}.${fileExt}`;
      const filePath = `${organizationId}/lecciones/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("materials")
        .upload(filePath, pdfFile);

      if (uploadError) {
        setMessage({ type: "error", text: "El PDF se guardará pero no se pudo subir: " + uploadError.message });
      } else if (uploadData) {
        const { data: publicUrlData } = supabase.storage
          .from("materials")
          .getPublicUrl(filePath);

        uploadedPdfUrl = publicUrlData.publicUrl;
      }
    }

    const { error } = await supabase.from("sunday_school_lessons").insert([
      {
        service_schedule_id: selectedCulto,
        organization_id: organizationId,
        group_name: groupName,
        topic: topic.trim(),
        material_url: uploadedPdfUrl || null,
      },
    ]);

    if (!error) {
      setTopic("");
      setPdfFile(null);
      const fileInput = document.getElementById("pdf-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      setMessage({ type: "success", text: "Lección guardada correctamente." });
      fetchInitialData();
    } else {
      setMessage({ type: "error", text: "No se pudo guardar la lección: " + error.message });
    }

    setSaving(false);
  };

  const handleDeleteLesson = async (lesson: EscuelaLesson) => {
    if (!window.confirm(`¿Eliminar la lección "${lesson.topic}" del grupo "${lesson.group_name}"?`)) return;
    setDeletingId(lesson.id);
    setMessage(null);
    const { error } = await supabase.from("sunday_school_lessons").delete().eq("id", lesson.id);
    setDeletingId(null);
    if (error) {
      setMessage({ type: "error", text: "No se pudo eliminar la lección: " + error.message });
      return;
    }
    setMessage({ type: "success", text: "Lección eliminada." });
    await fetchInitialData();
  };

  const reloadAttendance = async () => {
    if (!org?.id) return;
    const { data } = await supabase
      .from("sunday_school_attendance")
      .select("id, lesson_id, full_name, present")
      .eq("organization_id", org.id);
    if (data) setAttendance(data as AttendanceRow[]);
  };

  const handleAddAttendance = async (lesson: EscuelaLesson) => {
    const name = (attendanceInput[lesson.id] || "").trim();
    if (!name || !org?.id) return;
    setAttendanceSaving((prev) => ({ ...prev, [lesson.id]: true }));
    const { error } = await supabase.from("sunday_school_attendance").insert({
      lesson_id: lesson.id,
      organization_id: org.id,
      full_name: name,
    });
    setAttendanceSaving((prev) => ({ ...prev, [lesson.id]: false }));
    if (error) {
      setMessage({ type: "error", text: "No se pudo registrar la asistencia: " + error.message });
      return;
    }
    setAttendanceInput((prev) => ({ ...prev, [lesson.id]: "" }));
    await reloadAttendance();
  };

  const handleTogglePresent = async (row: AttendanceRow) => {
    const { error } = await supabase
      .from("sunday_school_attendance")
      .update({ present: !row.present })
      .eq("id", row.id);
    if (!error) {
      setAttendance((prev) => prev.map((a) => (a.id === row.id ? { ...a, present: !row.present } : a)));
    }
  };

  const handleRemoveAttendance = async (row: AttendanceRow) => {
    if (!window.confirm(`¿Quitar a "${row.full_name}" de la asistencia?`)) return;
    const { error } = await supabase.from("sunday_school_attendance").delete().eq("id", row.id);
    if (!error) {
      setAttendance((prev) => prev.filter((a) => a.id !== row.id));
    }
  };

  const handleExportAttendance = (culto: EscuelaCulto) => {
    const cultLessons = lessons.filter((l) => l.service_schedule_id === culto.id);
    const filas: (string | number)[][] = [
      ["Fecha", "Culto", "Grupo", "Tema", "Niño/a", "Presente"],
    ];
    cultLessons.forEach((lesson) => {
      const rows = attendance.filter((a) => a.lesson_id === lesson.id);
      if (rows.length === 0) {
        filas.push([formatCleanDate(culto), culto.title || "Culto", lesson.group_name, lesson.topic, "—", "—"]);
      } else {
        rows.forEach((a) => {
          filas.push([
            formatCleanDate(culto),
            culto.title || "Culto",
            lesson.group_name,
            lesson.topic,
            a.full_name,
            a.present ? "Presente" : "Ausente",
          ]);
        });
      }
    });
    downloadCsv(
      `asistencia_${culto.id.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.csv`,
      filas[0] as string[],
      filas.slice(1) as (string | number)[][]
    );
  };

  // Copiar el plan de clases de un culto al siguiente culto futuro
  const handleCopyLessons = async () => {
    if (!org?.id) return;
    const source = cultos.find((c) => c.id === copySourceCulto);
    if (!source || !nextCulto || nextCulto.id === source.id) {
      setMessage({ type: "error", text: "No hay otro culto futuro al que copiar las lecciones." });
      return;
    }
    const sourceLessons = lessons.filter((l) => l.service_schedule_id === source.id);
    if (sourceLessons.length === 0) {
      setMessage({ type: "error", text: `El culto "${source.title || "seleccionado"}" no tiene lecciones para copiar.` });
      return;
    }
    if (
      !window.confirm(
        `¿Copiar ${sourceLessons.length} lección(es) de "${source.title || "este culto"}" a "${nextCulto.title || "el próximo culto"}"?`
      )
    )
      return;
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from("sunday_school_lessons").insert(
      sourceLessons.map((l) => ({
        service_schedule_id: nextCulto.id,
        organization_id: org.id,
        group_name: l.group_name,
        topic: l.topic,
        material_url: l.material_url,
      }))
    );
    setSaving(false);
    if (error) {
      setMessage({ type: "error", text: "No se pudo copiar las lecciones: " + error.message });
      return;
    }
    setMessage({ type: "success", text: `Lecciones copiadas a "${nextCulto.title || "el próximo culto"}" (duplicadas sin marcar).` });
    setCopySourceCulto("");
    await fetchInitialData();
  };

  if (!orgLoading && org && !moduloActivo(org.plan, "escuela")) {
    return <PlanDisabled modulo="Escuela Dominical" />;
  }

  if (!orgLoading && (!canSeeEscuela || !org)) {
    return (
      <RestrictedAccess message="La programación de Escuela Dominical está disponible para el equipo de este ministerio (líderes, administradores y maestros/as con iglesia asignada)." />
    );
  }

  if (loading || orgLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600 font-medium">Cargando Escuela Dominical...</p>
      </div>
    );
  }

  // Próximo culto futuro (para copiar clases) y nombres conocidos para autocompletar
  const nextCulto = nextCultoCulto;
  const knownKids = [...new Set(attendance.map((a) => a.full_name))];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* ENCABEZADO */}
        <div className="bg-amber-600 text-white p-8 rounded-3xl shadow-lg space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full">
            MINISTERIO INFANTIL
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">Escuela Dominical</h1>
          <p className="text-sm text-amber-100 max-w-2xl">
            Gestiona los temas, lecciones y materiales en PDF para las distintas clases del domingo.
          </p>
        </div>

        {message && (
          <div
            className={`p-4 rounded-2xl text-sm font-semibold ${
              message.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-rose-50 border border-rose-200 text-rose-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          
          {/* FORMULARIO */}
          {canManageEscuela && (
          <div className="md:col-span-1 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4 h-fit">
            <h2 className="font-bold text-slate-800 text-lg">Nueva Lección</h2>

            <form onSubmit={handleCreateLesson} className="space-y-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Culto / Servicio
                </label>
                <select
                  value={selectedCulto}
                  onChange={(e) => setSelectedCulto(e.target.value)}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {cultos.map((culto) => (
                    <option key={culto.id} value={culto.id}>
                      {culto.title || "Culto"} — {formatCleanDate(culto)} ({formatCleanTime(culto)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Grupo / Edad
                </label>
                <select
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Párvulos (3-6 años)">Párvulos (3-6 años)</option>
                  <option value="Intermedios (7-10 años)">Intermedios (7-10 años)</option>
                  <option value="Pre-Adolescentes (11-13 años)">Pre-Adolescentes (11-13 años)</option>
                  <option value="General Infantil">General Infantil</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Tema o Pasaje Bíblico
                </label>
                <input
                  type="text"
                  placeholder="Ej: David y Goliat (1 Samuel 17)"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  required
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Material Adjunto (PDF opcional)
                </label>
                <input
                  id="pdf-input"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-3 px-4 rounded-xl transition-colors disabled:opacity-50"
              >
                {saving ? "Subiendo material..." : "Guardar Lección"}
              </button>
            </form>
          </div>
          )}

          {/* LISTADO DE LECCIONES Y MAESTRAS CONFIRMADAS */}
          <div className={`${canManageEscuela ? "md:col-span-2" : "md:col-span-3"} space-y-4`}>
            <h2 className="font-bold text-slate-800 text-lg">Programación de Clases</h2>

            {/* COPIAR PLAN DE CLASES AL PRÓXIMO CULTO */}
            {canManageEscuela && cultos.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl p-3">
                <span className="text-xs font-bold text-amber-900">📋 Reutilizar plan de clases:</span>
                <select
                  value={copySourceCulto}
                  onChange={(e) => setCopySourceCulto(e.target.value)}
                  className="text-xs font-medium bg-white border border-amber-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">— Elige el culto origen —</option>
                  {cultos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title || "Culto"} — {formatCleanDate(c)}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleCopyLessons}
                  disabled={!copySourceCulto || !nextCulto || saving}
                  title={nextCulto ? `Copiar al próximo culto: ${nextCulto.title || "sin título"}` : "No hay un culto futuro para copiar"}
                  className="text-xs font-bold px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl transition-colors"
                >
                  {saving ? "Copiando..." : `➡️ Copiar a ${nextCulto ? `"${nextCulto.title || "próximo culto"}"` : "próximo culto"}`}
                </button>
              </div>
            )}

            {cultos.map((culto) => {
              const cultLessons = lessons.filter((l) => l.service_schedule_id === culto.id);
              
              // Filtro para obtener Maestras/Servidores confirmados para este culto
              const cultoAssignments = assignments.filter((a) => a.service_schedule_id === culto.id);
              const kidsTeachers = cultoAssignments.filter((a) =>
                a.resolvedArea.toLowerCase().includes("escuela") ||
                a.resolvedArea.toLowerCase().includes("dominical") ||
                a.resolvedArea.toLowerCase().includes("niño") ||
                a.resolvedArea.toLowerCase().includes("maestr") ||
                a.resolvedArea.toLowerCase().includes("profesor")
              );

              return (
                <div key={culto.id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
                  
                  {/* CABECERA CULTO */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-800 text-base">
                        {culto.title || culto.service_type || "Culto Dominical"}
                      </h3>
                      <p className="text-xs text-amber-700 font-semibold mt-0.5">
                        🗓️ {formatCleanDate(culto)} — ⏰ {formatCleanTime(culto)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canManageEscuela && (
                        <button
                          onClick={() => handleExportAttendance(culto)}
                          title="Exportar asistencia a CSV"
                          className="text-[10px] font-bold px-2.5 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors rounded-full"
                        >
                          ⬇ CSV
                        </button>
                      )}
                      <span className="text-[10px] font-bold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full">
                        {cultLessons.length} clase(s)
                      </span>
                      {(() => {
                        const kidCount = new Set(
                          cultLessons.flatMap((l) => attendance.filter((a) => a.lesson_id === l.id).map((a) => a.full_name))
                        ).size;
                        return kidCount > 0 ? (
                          <span className="text-[10px] font-bold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full">
                            😄 {kidCount} niño(s)
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </div>

                  {/* BLOQUE MAESTRAS CONFIRMADAS */}
                  <div className="bg-amber-50/80 border border-amber-200/70 rounded-2xl p-3">
                    <span className="text-xs font-bold text-amber-950 block mb-0.5">
                      👩‍🏫 Maestra(s) / Encargado(s) Confirmados:
                    </span>
                    {kidsTeachers.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {kidsTeachers.map((t) => (
                          <span
                            key={t.id}
                            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-900 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5"
                          >
                            👥 {t.displayName}
                            {t.resolvedArea && (
                              <span className="font-mono text-[10px] text-amber-700 bg-white border border-amber-200 rounded-md px-1.5 py-px">
                                {t.resolvedArea.replace("Escuela Dominical: ", "").trim()}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-amber-700/80 italic">
                        Sin maestras asignadas aún en el cronograma.
                      </p>
                    )}
                  </div>

                  <hr className="border-slate-100" />

                  {/* LISTADO DE LECCIONES DEL CULTO */}
                  {cultLessons.length > 0 ? (
                    <div className="grid gap-3">
                      {cultLessons.map((lesson) => (
                        <div
                          key={lesson.id}
                          className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex flex-col gap-3"
                        >
                          <div className="flex justify-between items-center gap-3">
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-amber-800 uppercase bg-amber-100 px-2 py-0.5 rounded-md">
                                {lesson.group_name}
                              </span>
                              <p className="text-xs font-bold text-slate-800">
                                📖 Tema: {lesson.topic}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {lesson.material_url && (
                                <a
                                  href={lesson.material_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1 shadow-sm"
                                >
                                  📄 Abrir PDF
                                </a>
                              )}
                              {canManageEscuela && (
                                <button
                                  onClick={() => handleDeleteLesson(lesson)}
                                  disabled={deletingId === lesson.id}
                                  title="Eliminar lección"
                                  className="text-xs text-slate-300 hover:text-red-500 transition-colors shrink-0"
                                >
                                  {deletingId === lesson.id ? "..." : "🗑️"}
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="pt-2.5 border-t border-slate-200">
                            <p className="text-[11px] font-bold text-slate-600 mb-2">
                              👧 Asistencia ({attendance.filter((a) => a.lesson_id === lesson.id).length})
                            </p>
                            {canManageEscuela && (
                              <div className="flex gap-2 mb-2">
                                <input
                                  value={attendanceInput[lesson.id] || ""}
                                  onChange={(e) => setAttendanceInput((prev) => ({ ...prev, [lesson.id]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleAddAttendance(lesson);
                                    }
                                  }}
                                  list="nombres-conocidos"
                                  placeholder="Nombre del niño/niña"
                                  className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                                <button
                                  onClick={() => handleAddAttendance(lesson)}
                                  disabled={attendanceSaving[lesson.id] || !(attendanceInput[lesson.id] || "").trim()}
                                  className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition-colors shrink-0"
                                >
                                  {attendanceSaving[lesson.id] ? "..." : "+ Añadir"}
                                </button>
                              </div>
                            )}
                            <datalist id="nombres-conocidos">
                              {knownKids.map((n) => (
                                <option key={n} value={n} />
                              ))}
                            </datalist>
                            {(() => {
                              const rows = attendance.filter((a) => a.lesson_id === lesson.id);
                              return rows.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {rows.map((row) => (
                                    <span
                                      key={row.id}
                                      className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-full border ${
                                        row.present
                                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                          : "bg-slate-100 border-slate-200 text-slate-500 line-through"
                                      }`}
                                    >
                                      {row.full_name}
                                      {canManageEscuela && (
                                        <>
                                          <button
                                            onClick={() => handleTogglePresent(row)}
                                            title={row.present ? "Marcar ausente" : "Marcar presente"}
                                            className={row.present ? "text-emerald-600" : "text-slate-400"}
                                          >
                                            {row.present ? "✓" : "●"}
                                          </button>
                                          <button
                                            onClick={() => handleRemoveAttendance(row)}
                                            title="Quitar"
                                            className="text-slate-300 hover:text-red-500"
                                          >
                                            ✕
                                          </button>
                                        </>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-slate-400 italic">
                                  Aún no hay asistencia registrada para esta clase.
                                </p>
                              );
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No hay temas ni lecciones cargadas para este culto.</p>
                  )}

                </div>
              );
            })}
          </div>

        </div>

      </div>
    </div>
  );
}
