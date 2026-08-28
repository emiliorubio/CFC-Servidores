"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function EscuelaDominicalPage() {
  const [loading, setLoading] = useState(true);
  const [assignedTeachers, setAssignedTeachers] = useState<any[]>([]);

  const [lessons] = useState([
    {
      id: 1,
      date: "Domingo 30 de Agosto",
      topic: "La Armadura de Dios (Efesios 6)",
      group: "Párvulos (4-7 años)",
      teacher: "Tía Andrea",
      material: "Guía_Colorear_Armadura.pdf",
    },
    {
      id: 2,
      date: "Domingo 30 de Agosto",
      topic: "David y Goliat: La Fe y la Confianza",
      group: "Juniors (8-12 años)",
      teacher: "Tía Maria",
      material: "Cuestionario_David.pdf",
    },
  ]);

  useEffect(() => {
    loadEscuelaDominicalData();
  }, []);

  const loadEscuelaDominicalData = async () => {
    setLoading(true);

    // 1. Obtener lista de equipos
    const { data: teamsData } = await supabase.from("teams").select("id, name");
    
    // 2. Obtener usuarios y miembros para el cruce de nombres
    const { data: profiles } = await supabase.from("profiles").select("id, full_name");
    const { data: members } = await supabase.from("church_members").select("id, full_name");

    // 3. Obtener asignaciones
    const { data: assignments } = await supabase.from("roster_assignments").select("*");

    if (assignments) {
      const filtered = assignments.filter((asgn) => {
        const teamObj = teamsData?.find(t => t.id === asgn.team_id);
        const teamName = (teamObj?.name || asgn.area || "").toLowerCase();
        
        return (
          teamName.includes("escuela") ||
          teamName.includes("dominical") ||
          teamName.includes("niño") ||
          teamName.includes("párvulo") ||
          teamName.includes("maestra")
        );
      }).map((asgn) => {
        let name = asgn.user_name || "";
        if (!name) {
          const prof = profiles?.find(p => p.id === asgn.profile_id);
          const mem = members?.find(m => m.id === asgn.member_id);
          name = prof?.full_name || mem?.full_name || "Servidor Confirmado";
        }

        return {
          ...asgn,
          displayName: name
        };
      });

      setAssignedTeachers(filtered);
    }

    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header del Área */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              Espacio Exclusivo Maestras
            </span>
            <span className="text-xs text-slate-500">Sede CFC Puente Alto</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mt-1">Escuela Dominical</h2>
          <p className="text-slate-600 text-sm">
            Planificación de clases, asignación de grupos y descarga de recursos educativos.
          </p>
        </div>
        <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors">
          + Subir Nuevo Material / Lección
        </button>
      </div>

      {/* SECCIÓN EN TIEMPO REAL */}
      <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-emerald-950 text-base flex items-center gap-2">
            👩‍🏫 Maestras / Servidores Confirmados para este Domingo
          </h3>
          <button 
            onClick={loadEscuelaDominicalData}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold underline"
          >
            Actualizar Lista
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-emerald-700">Cargando servidores confirmados...</p>
        ) : assignedTeachers.length === 0 ? (
          <p className="text-xs text-emerald-800 italic">
            Aún no hay maestras anotadas desde el panel de Servidores para Escuela Dominical.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
            {assignedTeachers.map((t) => (
              <div key={t.id} className="bg-white p-3 rounded-lg border border-emerald-200 shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 font-bold text-xs">
                  {t.displayName.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-xs">{t.displayName}</p>
                  <p className="text-[11px] text-emerald-700 font-medium">📍 Escuela Dominical</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cronograma de Clases */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3">
          Cronograma y Lecciones de la Semana
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lessons.map((lesson) => (
            <div key={lesson.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                  {lesson.group}
                </span>
                <span className="text-xs text-slate-500">{lesson.date}</span>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-base">{lesson.topic}</h4>
                <p className="text-xs text-slate-600 mt-1">
                  Maestra a Cargo: <span className="font-medium text-slate-800">{lesson.teacher}</span>
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                <span className="text-xs text-slate-500 truncate max-w-[180px]">📄 {lesson.material}</span>
                <button className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-white border border-emerald-300 px-3 py-1.5 rounded-md transition-colors">
                  Descargar Material
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}