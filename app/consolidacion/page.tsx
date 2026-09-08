"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useOrganization } from "@/context/OrganizationContext";
import type { Organization } from "@/context/OrganizationContext";
import { supabase } from "@/lib/supabase";
import { downloadCsv } from "@/lib/format";

interface ConsolidationRecord {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  event_name: string;
  note: string | null;
  created_at: string;
}

const EVENT_OPTIONS = ["Bautizos", "Culto General", "Visita", "Consolidación", "Otro"] as const;

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("56")) return digits;
  if (digits.startsWith("0")) return "56" + digits.slice(1);
  return "56" + digits;
}

function buildWelcomeMessage(org: Organization, name: string) {
  const lines = [
    `Hola ${name}! 🎉 Gracias por visitarnos hoy.`,
    `Te damos la bienvenida a ${org.name}.`,
    org.address ? `📍 Dirección: ${org.address}` : "",
    org.service_times ? `🕐 Horarios de culto: ${org.service_times}` : "",
    org.contact_phone ? `📱 Contacto: ${org.contact_phone}` : "",
    "¡Te esperamos este domingo!",
  ].filter(Boolean);
  return lines.join("\n");
}

function whatsappLink(org: Organization, name: string, phone: string) {
  const number = normalizePhone(phone);
  const text = buildWelcomeMessage(org, name);
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

function formatFullDate(raw: string) {
  const d = new Date(raw);
  return d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function ConsolidationForm({ org }: { org: Organization }) {
  const { userProfile } = useOrganization();
  const isMember = Boolean(userProfile);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [eventName, setEventName] = useState<string>("Bautizos");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedContact, setSavedContact] = useState<{ name: string; phone: string } | null>(null);

  // Historial completo (todo lo registrado en la iglesia)
  const [allRecords, setAllRecords] = useState<ConsolidationRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Filtros del historial
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterEvent, setFilterEvent] = useState("");

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const stats = {
    total: allRecords.length,
    hoy: allRecords.filter((r) => isSameDay(new Date(r.created_at), new Date())).length,
    mes: allRecords.filter((r) => {
      const d = new Date(r.created_at);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length,
  };

  const filteredHistory = allRecords.filter((record) => {
    if (filterEvent && record.event_name !== filterEvent) return false;
    if (fromDate) {
      const recDate = new Date(record.created_at);
      const from = new Date(fromDate + "T00:00:00");
      if (recDate < from) return false;
    }
    if (toDate) {
      const recDate = new Date(record.created_at);
      const to = new Date(toDate + "T23:59:59");
      if (recDate > to) return false;
    }
    return true;
  });

  const loadHistory = useCallback(async () => {
    if (!org?.id) return;
    setHistoryLoading(true);
    const { data, error } = await supabase
      .from("consolidations")
      .select("id, full_name, phone, email, event_name, note, created_at")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false });

    if (!error) {
      setAllRecords((data || []) as ConsolidationRecord[]);
    }
    setHistoryLoading(false);
  }, [org.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de registros al montar
    loadHistory();
  }, [loadHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || normalizePhone(phone).length < 11) {
      setError("Completa al menos el nombre y un WhatsApp válido (9 dígitos).");
      return;
    }

    setSaving(true);
    setError(null);
    const { error } = await supabase.from("consolidations").insert({
      organization_id: org.id,
      full_name: fullName.trim(),
      phone: normalizePhone(phone),
      email: email.trim() || null,
      event_name: eventName.trim() || "Bautizos",
      note: note.trim() || null,
      created_by: userProfile?.id || null,
    });

    if (error) {
      setError("No se pudo registrar: " + error.message);
      setSaving(false);
      return;
    }

    setSavedContact({ name: fullName.trim(), phone: phone });
    setFullName("");
    setPhone("");
    setEmail("");
    setNote("");
    setSaving(false);
    await loadHistory();
  };

  const handleExportCsv = () => {
    downloadCsv(
      `consolidacion_${org.slug || "iglesia"}_${new Date().toISOString().slice(0, 10)}.csv`,
      ["Nombre", "WhatsApp", "Correo", "Evento", "Nota", "Fecha"],
      filteredHistory.map((r) => [
        r.full_name,
        r.phone,
        r.email || "",
        r.event_name,
        r.note || "",
        new Date(r.created_at).toLocaleString("es-CL"),
      ])
    );
  };

  const primaryColor = org.primary_color || "#4F46E5";

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Encabezado */}
        <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-lg space-y-2">
          <span
            style={{ backgroundColor: `${primaryColor}33`, color: "#c7d2fe", borderColor: `${primaryColor}55` }}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider border px-3 py-1 rounded-full"
          >
            {org.logo_url ? (
              <Image src={org.logo_url} alt={org.name} width={18} height={18} unoptimized className="w-4 h-4 rounded-full object-cover bg-white" />
            ) : null}
            EQUIPO DE CONSOLIDACIÓN
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">💧 Registro de Nuevos</h1>
          <p className="text-sm text-slate-300">
            Anota los datos de quienes deciden hoy. Te generamos la bienvenida por WhatsApp
            y queda el registro para <strong>{org.name}</strong>.
          </p>
        </div>

        {/* Contadores */}
        {isMember && (
          <section className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 text-center">
              <p className="text-2xl font-extrabold text-slate-800">{stats.hoy}</p>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-1">Hoy</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 text-center">
              <p className="text-2xl font-extrabold text-slate-800">{stats.mes}</p>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-1">Este mes</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 text-center">
              <p className="text-2xl font-extrabold text-indigo-600">{stats.total}</p>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-1">Historial</p>
            </div>
          </section>
        )}

        {/* Mensajes de error */}
        {error && (
          <div className="p-4 rounded-2xl text-sm font-semibold bg-rose-50 border border-rose-200 text-rose-800">
            {error}
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-bold text-slate-700">Nombre completo del nuevo</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej.: María José Soto"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">WhatsApp / Teléfono</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej.: +56 9 1234 5678"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ej.: maria@correo.cl"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">Evento</label>
              <select
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800 bg-white"
              >
                {EVENT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">Nota (opcional)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ej.: Vino invitado por Carolina"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{ backgroundColor: primaryColor }}
            className="w-full text-white font-bold py-3.5 px-4 rounded-xl shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "Guardando registro..." : "Registrar nuevo"}
          </button>
        </form>

        {/* Confirmación + bienvenida por WhatsApp */}
        {savedContact && (
          <div className="p-6 rounded-3xl border border-emerald-200 bg-emerald-50 space-y-4">
            <p className="text-sm font-bold text-emerald-900">✅ {savedContact.name} quedó registrado/a.</p>
            <a
              href={whatsappLink(org, savedContact.name, savedContact.phone)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ backgroundColor: "#25D366" }}
              className="inline-flex items-center gap-2 text-white font-bold py-3 px-5 rounded-xl shadow-md hover:opacity-90 transition-opacity"
            >
              Enviar bienvenida por WhatsApp
            </a>
            <pre className="whitespace-pre-wrap text-xs text-slate-700 bg-white border border-slate-200 rounded-xl p-4">
              {buildWelcomeMessage(org, savedContact.name)}
            </pre>
            <button
              type="button"
              onClick={() => setSavedContact(null)}
              className="text-xs font-bold text-slate-600 hover:text-slate-800"
            >
              Registrar a otro nuevo →
            </button>
          </div>
        )}

        {/* Historial (visible para miembros con sesión) */}
        {isMember && (
          <section className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-800">📚 Historial de registros</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Toda la lista guardada en <strong>{org.name}</strong> desde el día uno. Así puedes revisar los bautizos del domingo cuando quieras.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={filteredHistory.length === 0}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
              >
                ⬇️ Exportar CSV ({filteredHistory.length})
              </button>
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Desde</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Hasta</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Evento</label>
                <select
                  value={filterEvent}
                  onChange={(e) => setFilterEvent(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Todos</option>
                  {EVENT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {historyLoading ? (
              <p className="text-xs text-slate-400 py-2">Cargando historial...</p>
            ) : filteredHistory.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  No hay registros que coincidan con los filtros{allRecords.length === 0 ? " todavía" : ""}.
                  {allRecords.length === 0 ? " Los nombres que anotes hoy aparecerán acá y podrás revisarlos cuando quieras." : " Prueba ampliar el rango de fechas o elegir otro evento."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3 font-bold">Nombre</th>
                      <th className="px-4 py-3 font-bold">WhatsApp</th>
                      <th className="px-4 py-3 font-bold">Correo</th>
                      <th className="px-4 py-3 font-bold">Evento</th>
                      <th className="px-4 py-3 font-bold">Nota</th>
                      <th className="px-4 py-3 font-bold">Fecha</th>
                      <th className="px-4 py-3 font-bold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((record) => (
                      <tr key={record.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-semibold text-slate-800">{record.full_name}</td>
                        <td className="px-4 py-3 text-slate-600">{record.phone}</td>
                        <td className="px-4 py-3 text-slate-600">{record.email || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{record.event_name}</td>
                        <td className="px-4 py-3 text-slate-500 max-w-[180px] truncate">{record.note || "—"}</td>
                        <td className="px-4 py-3 text-slate-500 capitalize">{formatFullDate(record.created_at)}</td>
                        <td className="px-4 py-3">
                          <a
                            href={whatsappLink(org, record.full_name, record.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                          >
                            WhatsApp →
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default function ConsolidacionPage() {
  const { org, loading: orgLoading } = useOrganization();

  if (orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600 font-medium">Cargando...</p>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600 font-medium">
          Abre el enlace de una iglesia válida para usar el registro de consolidación.
        </p>
      </div>
    );
  }

  return <ConsolidationForm key={org.id} org={org} />;
}