"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/context/OrganizationContext";

export default function EscuelaDominicalPage() {
  const { org, loading: orgLoading } = useOrganization();
  const [cultos, setCultos] = useState<any[]>([]);
  const [selectedCulto, setSelectedCulto] = useState<string>("");
  const [groupName, setGroupName] = useState("Párvulos (3-6 años)");
  const [topic, setTopic] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [assignments, setAssignments] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (org?.id) fetchInitialData();
  }, [org?.id]);

  const fetchInitialData = async () => {
    if (!org?.id) return;
    setLoading(true);

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

    if (serviceData && serviceData.length > 0) {
      setCultos(serviceData);
      setSelectedCulto(serviceData[0].id);
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
      setAssignments(enrichedAssignments);
    }

    if (lessonData) setLessons(lessonData);

    setLoading(false);
  };

  // Formateador de Fecha limpia
  const formatCleanDate = (culto: any) => {
    const dateStr = culto.service_date || culto.date;
    if (!dateStr) return "Fecha por confirmar";

    const rawDate = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.split(" ")[0];
    const parts = rawDate.split("-");
    if (parts.length < 3) return dateStr;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    const dateObj = new Date(year, month, day);
    const formatted = dateObj.toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  // Formateador de Hora corregido
  const formatCleanTime = (culto: any) => {
    const explicitTime = culto.service_time || culto.time || culto.start_time || culto.hora;
    if (explicitTime) {
      const [hh, mm] = explicitTime.split(":");
      if (hh && mm) return `${hh}:${mm} hrs`;
    }

    const dateStr = culto.service_date || culto.date || "";
    if (dateStr.includes("T")) {
      const timePart = dateStr.split("T")[1];
      if (timePart && !timePart.startsWith("00:00")) {
        const [hh, mm] = timePart.split(":");
        if (hh && mm) return `${hh}:${mm} hrs`;
      }
    } else if (dateStr.includes(" ")) {
      const timePart = dateStr.split(" ")[1];
      if (timePart && !timePart.startsWith("00:00")) {
        const [hh, mm] = timePart.split(":");
        if (hh && mm) return `${hh}:${mm} hrs`;
      }
    }

    return "Por confirmar";
  };

  // Subir lección con PDF al bucket "materials"
  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    const organizationId = org?.id;
    if (!selectedCulto || !topic.trim() || !organizationId) return;

    setSaving(true);
    let uploadedPdfUrl = "";

    if (pdfFile) {
      const fileExt = pdfFile.name.split(".").pop();
      const fileName = `escuela_${Date.now()}.${fileExt}`;
      const filePath = `${organizationId}/lecciones/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("materials")
        .upload(filePath, pdfFile);

      if (uploadError) {
        console.error("Error al subir el archivo PDF:", uploadError);
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
      fetchInitialData();
    } else {
      console.error("Error al guardar lección:", error);
    }

    setSaving(false);
  };

  if (loading || orgLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600 font-medium">Cargando Escuela Dominical...</p>
      </div>
    );
  }

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

        <div className="grid gap-6 md:grid-cols-3">
          
          {/* FORMULARIO */}
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

          {/* LISTADO DE LECCIONES Y MAESTRAS CONFIRMADAS */}
          <div className="md:col-span-2 space-y-4">
            <h2 className="font-bold text-slate-800 text-lg">Programación de Clases</h2>

            {cultos.map((culto) => {
              const cultLessons = lessons.filter((l) => l.service_schedule_id === culto.id);
              
              // Filtro para obtener Maestras/Servidores confirmados para este culto
              const cultoAssignments = assignments.filter((a) => a.service_schedule_id === culto.id);
              const kidsTeachers = cultoAssignments.filter((a) =>
                a.resolvedArea.toLowerCase().includes("escuela") ||
                a.resolvedArea.toLowerCase().includes("dominical") ||
                a.resolvedArea.toLowerCase().includes("niño") ||
                a.resolvedArea.toLowerCase().includes("maestra") ||
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
                    <span className="text-[10px] font-bold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full">
                      {cultLessons.length} clase(s)
                    </span>
                  </div>

                  {/* BLOQUE MAESTRAS CONFIRMADAS */}
                  <div className="bg-amber-50/80 border border-amber-200/70 rounded-2xl p-3">
                    <span className="text-xs font-bold text-amber-950 block mb-0.5">
                      👩‍🏫 Maestra(s) / Encargado(s) Confirmados:
                    </span>
                    {kidsTeachers.length > 0 ? (
                      <p className="text-xs font-semibold text-amber-900">
                        👥 {kidsTeachers.map((t) => t.displayName).join(", ")}
                      </p>
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
                          className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex justify-between items-center"
                        >
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-amber-800 uppercase bg-amber-100 px-2 py-0.5 rounded-md">
                              {lesson.group_name}
                            </span>
                            <p className="text-xs font-bold text-slate-800">
                              📖 Tema: {lesson.topic}
                            </p>
                          </div>

                          {lesson.material_url && (
                            <a
                              href={lesson.material_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1 shadow-sm shrink-0"
                            >
                              📄 Abrir PDF
                            </a>
                          )}
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
