"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdoracionPage() {
  const [loading, setLoading] = useState(true);
  const [assignedMusicians, setAssignedMusicians] = useState<any[]>([]);

  const [songs] = useState([
    { id: 1, title: "La Bondad de Dios", key: "G (Sol)", link: "https://youtube.com", notes: "Entrada suave con piano" },
    { id: 2, title: "Tumbas a Huertos", key: "B (Si)", link: "https://youtube.com", notes: "Subir intensidad en puente 2" },
    { id: 3, title: "Acuérdate", key: "D (Re)", link: "https://youtube.com", notes: "Canción de ministración" },
  ]);

  useEffect(() => {
    loadAdoracionData();
  }, []);

  const loadAdoracionData = async () => {
    setLoading(true);

    // 1. Obtener lista de equipos/áreas
    const { data: teamsData } = await supabase.from("teams").select("id, name");

    // 2. Obtener perfiles y miembros
    const { data: profiles } = await supabase.from("profiles").select("id, full_name");
    const { data: members } = await supabase.from("church_members").select("id, full_name");

    // 3. Obtener asignaciones
    const { data: assignments } = await supabase.from("roster_assignments").select("*");

    if (assignments) {
      const filtered = assignments
        .filter((asgn) => {
          const teamObj = teamsData?.find((t) => t.id === asgn.team_id);
          const teamName = (teamObj?.name || asgn.area || "").toLowerCase();

          return (
            teamName.includes("adoraci") ||
            teamName.includes("alabanza") ||
            teamName.includes("musi") ||
            teamName.includes("banda") ||
            teamName.includes("coro")
          );
        })
        .map((asgn) => {
          let name = asgn.user_name || "";
          if (!name) {
            const prof = profiles?.find((p) => p.id === asgn.profile_id);
            const mem = members?.find((m) => m.id === asgn.member_id);
            name = prof?.full_name || mem?.full_name || "Servidor Confirmado";
          }

          const teamObj = teamsData?.find((t) => t.id === asgn.team_id);

          return {
            ...asgn,
            displayName: name,
            areaName: asgn.area || teamObj?.name || "Adoración",
          };
        });

      setAssignedMusicians(filtered);
    }

    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header del Área */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              Espacio Exclusivo
            </span>
            <span className="text-xs text-slate-500">Sede CFC Puente Alto</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mt-1">Ministerio de Adoración</h2>
          <p className="text-slate-600 text-sm">
            Repertorio, horarios de ensayo y pauta para el próximo servicio.
          </p>
        </div>
        <button className="bg-purple-700 hover:bg-purple-800 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors">
          + Agregar Canción al Pautero
        </button>
      </div>

      {/* SECCIÓN EN TIEMPO REAL: MÚSICOS Y CANTANTES ANOTADOS */}
      <div className="bg-purple-50 border border-purple-200 p-5 rounded-xl shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-purple-950 text-base flex items-center gap-2">
            🎵 Músicos y Levitas Confirmados para este Domingo
          </h3>
          <button
            onClick={loadAdoracionData}
            className="text-xs text-purple-700 hover:text-purple-900 font-semibold underline"
          >
            Actualizar Lista
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-purple-700">Cargando equipo de adoración...</p>
        ) : assignedMusicians.length === 0 ? (
          <p className="text-xs text-purple-800 italic">
            Aún no hay integrantes anotados desde el panel de Servidores para Adoración.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
            {assignedMusicians.map((m) => (
              <div key={m.id} className="bg-white p-3 rounded-lg border border-purple-200 shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-800 font-bold text-xs">
                  {m.displayName.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-xs">{m.displayName}</p>
                  <p className="text-[11px] text-purple-700 font-medium">📍 {m.areaName}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Información del Ensayos y Citación */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 space-y-2">
          <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider">Próximo Ensayo</h4>
          <p className="text-lg font-bold text-purple-950">Sábado 18:30 PM</p>
          <p className="text-xs text-purple-700">Prueba de sonido general y repaso de voces.</p>
        </div>

        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 space-y-2">
          <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Citación Domingo</h4>
          <p className="text-lg font-bold text-indigo-950">09:15 AM (Puntual)</p>
          <p className="text-xs text-indigo-700">Alineación de instrumentos y oración.</p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-2">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Director de Alabanza</h4>
          <p className="text-lg font-bold text-slate-900">David / Equipo A</p>
          <p className="text-xs text-slate-600">Servicio Dominical 10:30 AM.</p>
        </div>
      </div>

      {/* Listado del Pautero */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3">
          Pautero Dominical
        </h3>

        <div className="space-y-3">
          {songs.map((song, index) => (
            <div
              key={song.id}
              className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-50 border border-slate-200 rounded-lg gap-3"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold text-sm flex items-center justify-center">
                  0{index + 1}
                </span>
                <div>
                  <h4 className="font-bold text-slate-800">{song.title}</h4>
                  <p className="text-xs text-slate-500">
                    Tono: <span className="font-semibold text-slate-700">{song.key}</span> | Nota: {song.notes}
                  </p>
                </div>
              </div>

              <a
                href={song.link}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-purple-700 hover:text-purple-900 bg-purple-50 px-3 py-1.5 rounded-md border border-purple-200"
              >
                Ver Ensayo / Link
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}