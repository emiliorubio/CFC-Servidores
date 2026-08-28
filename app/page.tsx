"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function InicioPage() {
  const [cultos, setCultos] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

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

  // Formateador de Hora dinámico
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

  const fetchDashboardData = async () => {
    setLoading(true);

    const { data: serviceData } = await supabase
      .from("service_schedules")
      .select("*")
      .order("service_date", { ascending: true });

    const { data: teamsData } = await supabase.from("teams").select("id, name");
    const { data: profiles } = await supabase.from("profiles").select("id, full_name");
    const { data: members } = await supabase.from("church_members").select("id, full_name");
    const { data: assignData } = await supabase.from("roster_assignments").select("*");
    const { data: lessonData } = await supabase.from("sunday_school_lessons").select("*");

    if (assignData) {
      const enrichedAssignments = assignData.map((asgn) => {
        let name = asgn.user_name || "";
        if (!name) {
          const prof = profiles?.find((p) => p.id === asgn.profile_id);
          const mem = members?.find((m) => m.id === asgn.member_id);
          name = prof?.full_name || mem?.full_name || "Servidor Confirmado";
        }
        const teamObj = teamsData?.find((t) => t.id === asgn.team_id);
        const areaName = teamObj?.name || asgn.area || "";

        return { ...asgn, displayName: name, resolvedArea: areaName };
      });
      setAssignments(enrichedAssignments);
    }

    if (serviceData) setCultos(serviceData);
    if (lessonData) setLessons(lessonData);

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600 font-medium">Cargando Agenda Congregacional...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ENCABEZADO */}
        <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-lg space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full">
            CRONOGRAMA OFICIAL
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">Próximos Servicios & Cultos</h1>
          <p className="text-sm text-slate-300 max-w-2xl">
            Consulta los cultos programados, revisa las asignaciones de alabanza, predicadores, profesores de escuela dominical y anótate para servir.
          </p>
        </div>

        {/* GRID DE CULTOS */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cultos.map((culto) => {
            const cultoAssignments = assignments.filter((a) => a.service_schedule_id === culto.id);

            // Filtro Altar / Predicador
            const preacherMembers = cultoAssignments.filter((a) =>
              a.resolvedArea.toLowerCase().includes("altar") ||
              a.resolvedArea.toLowerCase().includes("predic") ||
              a.resolvedArea.toLowerCase().includes("pastor") ||
              a.resolvedArea.toLowerCase().includes("palabra")
            );

            // Filtro Alabanza
            const alabanzaMembers = cultoAssignments.filter((a) =>
              a.resolvedArea.toLowerCase().includes("adorac") ||
              a.resolvedArea.toLowerCase().includes("alabanz") ||
              a.resolvedArea.toLowerCase().includes("músic")
            );

            // Filtro Escuela Dominical
            const kidsTeachers = cultoAssignments.filter((a) =>
              a.resolvedArea.toLowerCase().includes("escuela") ||
              a.resolvedArea.toLowerCase().includes("dominical") ||
              a.resolvedArea.toLowerCase().includes("niño") ||
              a.resolvedArea.toLowerCase().includes("maestra")
            );

            // Lecciones de este culto
            const cultoLessons = lessons.filter((l) => l.service_schedule_id === culto.id);

            return (
              <div key={culto.id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  
                  {/* CABECERA CULTO CON FECHA/HORA REAL */}
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">
                      {culto.title || culto.service_type || "Culto Dominical"}
                    </h3>
                    <p className="text-xs text-indigo-600 font-semibold mt-1">
                      🗓️ {formatCleanDate(culto)} — ⏰ {formatCleanTime(culto)}
                    </p>
                  </div>

                  <hr className="border-slate-100" />

                  {/* BLOQUE: PREDICADOR / ALTAR */}
                  <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-3 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-blue-900">📖 Predicador / Altar</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-200 text-blue-800 rounded-full">
                        {preacherMembers.length > 0 ? "Confirmado" : "Pendiente"}
                      </span>
                    </div>
                    {preacherMembers.length > 0 ? (
                      <p className="text-xs text-blue-950 font-semibold">
                        🎙️ {preacherMembers.map((m) => m.displayName).join(", ")}
                      </p>
                    ) : (
                      <p className="text-[11px] text-blue-400 italic">Sin predicador asignado aún.</p>
                    )}
                  </div>

                  {/* BLOQUE: ALABANZA */}
                  <div className="bg-purple-50/60 border border-purple-100 rounded-2xl p-3 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-purple-900">🎵 Equipo de Adoración</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-200 text-purple-800 rounded-full">
                        {alabanzaMembers.length} Confirmado(s)
                      </span>
                    </div>
                    {alabanzaMembers.length > 0 ? (
                      <p className="text-xs text-purple-950 font-medium">
                        👥 {alabanzaMembers.map((m) => m.displayName).join(", ")}
                      </p>
                    ) : (
                      <p className="text-[11px] text-purple-400 italic">Sin músicos asignados aún.</p>
                    )}
                  </div>

                  {/* BLOQUE: ESCUELA DOMINICAL */}
                  <div className="bg-amber-50/60 border border-amber-100 rounded-2xl p-3 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-amber-950">👧 Escuela Dominical</span>
                      {kidsTeachers.length > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full">
                          Asignado
                        </span>
                      )}
                    </div>

                    {kidsTeachers.length > 0 ? (
                      <p className="text-xs text-amber-950 font-semibold">
                        👩‍🏫 Profe: {kidsTeachers.map((t) => t.displayName).join(", ")}
                      </p>
                    ) : (
                      <p className="text-[11px] text-amber-600/70 italic">Profe por confirmar para este culto.</p>
                    )}

                    {cultoLessons.length > 0 && (
                      <div className="pt-2 border-t border-amber-200/60 text-[11px] text-amber-900 space-y-1">
                        {cultoLessons.map((l) => (
                          <div key={l.id} className="flex justify-between items-center">
                            <p>📖 <strong>{l.group_name}:</strong> {l.topic}</p>
                            {l.material_url && (
                              <a
                                href={l.material_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] bg-amber-200/80 hover:bg-amber-300 text-amber-950 font-bold px-1.5 py-0.5 rounded transition-colors ml-2"
                              >
                                PDF
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <Link
                  href="/servidores"
                  className="block text-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold py-2.5 px-3 rounded-xl border border-indigo-100 transition-colors mt-2"
                >
                  Anotarme para Servir →
                </Link>

              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}