"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/context/OrganizationContext";
import Link from "next/link";

interface ServiceSchedule {
  id: string;
  service_date: string;
  title: string;
  description?: string;
  organization_id: string;
}

export default function HomePage() {
  const { org, userRole, loading: orgLoading } = useOrganization();
  const [schedules, setSchedules] = useState<ServiceSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulario para crear un nuevo culto
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("Culto Dominical");
  const [serviceDate, setServiceDate] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (org?.id) {
      fetchSchedules();
    } else {
      setLoading(false);
    }
  }, [org, orgLoading]);

  // Cargar cultos filtrados por la iglesia activa
  const fetchSchedules = async () => {
    if (!org?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("service_schedules")
        .select("*")
        .eq("organization_id", org.id)
        .order("service_date", { ascending: true });

      if (error) throw error;
      setSchedules(data || []);
    } catch (err) {
      console.error("Error al cargar los servicios:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org?.id || !serviceDate) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("service_schedules").insert([
        {
          title,
          service_date: serviceDate,
          description,
          organization_id: org.id,
        },
      ]);

      if (error) throw error;

      setShowModal(false);
      setTitle("Culto Dominical");
      setServiceDate("");
      setDescription("");
      fetchSchedules();
    } catch (err: any) {
      alert("Error al guardar culto: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const isAdminOrLider = userRole === "admin" || userRole === "superadmin" || userRole === "lider";
  const orgName = org?.name || "tu iglesia";

  if (loading || orgLoading) {
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
          <button
            onClick={() => setShowModal(true)}
            className="relative z-10 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-3 rounded-2xl shadow-lg transition-transform hover:scale-105 text-xs md:text-sm whitespace-nowrap"
          >
            + Nuevo Culto / Servicio
          </button>
        )}
      </div>

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
                  <div>
                    <h3 className="text-base font-bold text-slate-800">{schedule.title}</h3>
                    <p className="text-xs text-indigo-600 font-semibold mt-1">
                      🗓️ {new Date(schedule.service_date).toLocaleDateString("es-CL", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </p>
                  </div>
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
