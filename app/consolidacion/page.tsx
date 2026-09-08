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
  person_id?: string | null;
  created_at: string;
}

interface Person {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  status: "nuevo" | "reiterado" | "integrado";
  created_at: string;
}

const STATUS_LABELS: Record<Person["status"], string> = {
  nuevo: "Nuevo",
  reiterado: "Reiterado",
  integrado: "Integrado",
};

const STATUS_COLORS: Record<Person["status"], string> = {
  nuevo: "bg-sky-100 text-sky-700 border-sky-300",
  reiterado: "bg-amber-100 text-amber-800 border-amber-300",
  integrado: "bg-emerald-100 text-emerald-700 border-emerald-300",
};

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

function followUpMessage(org: Organization, person: Person) {
  const lines =
    person.status === "integrado"
      ? [
          `Hola ${person.full_name}! 👋`,
          `Gracias por estar en ${org.name}.`,
          "Queremos que esta iglesia sea tu casa.",
          org.service_times ? `🕐 Te esperamos: ${org.service_times}` : "¡Te esperamos este domingo!",
        ]
      : [
          `Hola ${person.full_name}! 👋`,
          `¡Qué alegría verte de nuevo en ${org.name}!`,
          "Queremos acompañarte en este proceso.",
          org.service_times ? `🕐 Te esperamos: ${org.service_times}` : "¡Te esperamos este domingo!",
        ];
  return lines.filter(Boolean).join("\n");
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
  const { userProfile, userRole } = useOrganization();
  const isMember = Boolean(userProfile);
  const isLeader =
    userRole === "admin" ||
    userRole === "superadmin" ||
    userRole === "lider" ||
    userRole === "pastor" ||
    userRole === "coordinador";

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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filtros del historial
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterEvent, setFilterEvent] = useState("");

  // Seguimiento por persona
  const [people, setPeople] = useState<Person[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"todos" | Person["status"]>("todos");
  const [nameSearch, setNameSearch] = useState("");
  const [savingStatus, setSavingStatus] = useState<string | null>(null);

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
      .select("id, full_name, phone, email, event_name, note, person_id, created_at")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false });

    if (!error) {
      setAllRecords((data || []) as ConsolidationRecord[]);
    }
    setHistoryLoading(false);

    const { data: peopleData, error: peopleError } = await supabase
      .from("consolidation_people")
      .select("id, full_name, phone, email, status, created_at")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false });
    if (!peopleError) {
      setPeople((peopleData || []) as Person[]);
    }
    setPeopleLoading(false);
  }, [org.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de registros al montar
    loadHistory();
  }, [loadHistory]);

  const handleDeleteRecord = async (record: ConsolidationRecord) => {
    if (!org?.id) return;
    if (!window.confirm(`¿Eliminar el registro de "${record.full_name}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(record.id);
    const { error } = await supabase
      .from("consolidations")
      .delete()
      .eq("id", record.id)
      .eq("organization_id", org.id);
    setDeletingId(null);
    if (error) {
      window.alert("No se pudo eliminar el registro: " + error.message);
      return;
    }
    await loadHistory();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || normalizePhone(phone).length < 11) {
      setError("Completa al menos el nombre y un WhatsApp válido (9 dígitos).");
      return;
    }

    setSaving(true);
    setError(null);
    const {
      data: inserted,
      error,
    } = await supabase
      .from("consolidations")
      .insert({
        organization_id: org.id,
        full_name: fullName.trim(),
        phone: normalizePhone(phone),
        email: email.trim() || null,
        event_name: eventName.trim() || "Bautizos",
        note: note.trim() || null,
        created_by: userProfile?.id || null,
      })
      .select("id")
      .single();

    if (error) {
      setError("No se pudo registrar: " + error.message);
      setSaving(false);
      return;
    }

    // Vincular con su "persona" de seguimiento (por teléfono o nombre).
    const normalizedPhone = normalizePhone(phone);
    let personId: string | null = null;
    if (normalizedPhone) {
      const { data: byPhone } = await supabase
        .from("consolidation_people")
        .select("id")
        .eq("organization_id", org.id)
        .eq("phone", normalizedPhone)
        .maybeSingle();
      personId = byPhone?.id || null;
    }
    if (!personId && !normalizedPhone) {
      const { data: byName } = await supabase
        .from("consolidation_people")
        .select("id")
        .eq("organization_id", org.id)
        .eq("full_name", fullName.trim())
        .is("phone", null)
        .maybeSingle();
      personId = byName?.id || null;
    }
    if (!personId) {
      const { data: newPerson, error: personError } = await supabase
        .from("consolidation_people")
        .insert({
          organization_id: org.id,
          full_name: fullName.trim(),
          phone: normalizedPhone || null,
          email: email.trim() || null,
          status: "nuevo",
        })
        .select("id")
        .maybeSingle();
      if (!personError) personId = newPerson?.id || null;
    }
    if (personId) {
      await supabase.from("consolidations").update({ person_id: personId }).eq("id", inserted.id);
      const { count } = await supabase
        .from("consolidations")
        .select("id", { count: "exact", head: true })
        .eq("person_id", personId);
      if ((count || 0) >= 2) {
        await supabase
          .from("consolidation_people")
          .update({ status: "reiterado" })
          .eq("id", personId);
      }
    }

    setSavedContact({ name: fullName.trim(), phone: phone });
    setFullName("");
    setPhone("");
    setEmail("");
    setNote("");
    setSaving(false);
    await loadHistory();
  };

  const updatePersonStatus = async (person: Person, status: Person["status"]) => {
    if (!org?.id) return;
    setSavingStatus(person.id);
    const { error } = await supabase
      .from("consolidation_people")
      .update({ status })
      .eq("id", person.id)
      .eq("organization_id", org.id);
    setSavingStatus(null);
    if (!error) {
      setPeople((prev) => prev.map((p) => (p.id === person.id ? { ...p, status } : p)));
    } else {
      window.alert("No se pudo actualizar el estado: " + error.message);
    }
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

        {/* Seguimiento por persona (visible para miembros con sesión) */}
        {isMember && (
          <section className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-800">🗂️ Seguimiento de Contactos</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Cada persona tiene un estado: <b>Nuevo</b> → <b>Reiterado</b> → <b>Integrado</b>. Cuando
                  alguien vuelve, pasa automáticamente a Reiterado.
                </p>
              </div>
            </div>

            {/* Resumen por estado */}
            <div className="grid grid-cols-3 gap-3">
              {(["nuevo", "reiterado", "integrado"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter((prev) => (prev === status ? "todos" : status))}
                  className={`rounded-2xl border p-4 text-center transition-colors ${
                    statusFilter === status
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <p className="text-xl font-extrabold">{people.filter((p) => p.status === status).length}</p>
                  <p className="text-[11px] font-bold uppercase tracking-wider mt-0.5">{STATUS_LABELS[status]}</p>
                </button>
              ))}
            </div>

            {/* Buscador */}
            <div>
              <input
                type="text"
                value={nameSearch}
                onChange={(e) => setNameSearch(e.target.value)}
                placeholder="🔎 Buscar por nombre..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {peopleLoading ? (
              <p className="text-xs text-slate-400 py-2">Cargando seguimiento...</p>
            ) : people.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center">
                <p className="text-3xl mb-2">🕊️</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Aún no hay contactos en seguimiento. Cada vez que registres a alguien desde el
                  formulario de arriba, aparecerá aquí.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {people
                  .filter((p) => {
                    const matchesSearch = p.full_name.toLowerCase().includes(nameSearch.toLowerCase());
                    const matchesStatus = statusFilter === "todos" || p.status === statusFilter;
                    return matchesSearch && matchesStatus;
                  })
                  .map((person) => {
                    const visits = allRecords.filter(
                      (r) =>
                        r.person_id === person.id ||
                        (r.phone && person.phone && r.phone === person.phone)
                    );
                    const lastVisit = visits.reduce(
                      (latest, r) => (r.created_at > latest ? r.created_at : latest),
                      ""
                    );
                    const initials = person.full_name
                      .split(" ")
                      .slice(0, 2)
                      .map((w) => w.charAt(0).toUpperCase())
                      .join("");
                    return (
                      <div
                        key={person.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-extrabold text-sm shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{person.full_name}</p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {person.phone || "Sin WhatsApp"} · {visits.length} visita(s)
                              {lastVisit
                                ? ` · última ${new Date(lastVisit).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}`
                                : ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${STATUS_COLORS[person.status]}`}
                          >
                            {STATUS_LABELS[person.status]}
                          </span>

                          {person.phone && normalizePhone(person.phone).length >= 11 && (
                            <a
                              href={`https://wa.me/${normalizePhone(person.phone)}?text=${encodeURIComponent(followUpMessage(org, person))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Enviar mensaje de seguimiento"
                              className="text-[10px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white px-2.5 py-1 rounded-xl transition-colors"
                            >
                              📱 Seguimiento
                            </a>
                          )}

                          {isLeader && person.status !== "integrado" && (
                            <button
                              onClick={() =>
                                updatePersonStatus(person, person.status === "nuevo" ? "reiterado" : "integrado")
                              }
                              disabled={savingStatus === person.id}
                              className="text-[10px] font-bold bg-slate-900 hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-2.5 py-1 rounded-xl transition-colors"
                            >
                              {savingStatus === person.id
                                ? "..."
                                : person.status === "nuevo"
                                  ? "→ Reiterado"
                                  : "→ Integrado"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </section>
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
                          <div className="flex items-center gap-3">
                            <a
                              href={whatsappLink(org, record.full_name, record.phone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                            >
                              WhatsApp →
                            </a>
                            {isMember && (
                              <button
                                onClick={() => handleDeleteRecord(record)}
                                disabled={deletingId === record.id}
                                title="Eliminar registro (corregir error)"
                                className="text-xs text-slate-300 hover:text-red-500 transition-colors"
                              >
                                {deletingId === record.id ? "..." : "🗑️"}
                              </button>
                            )}
                          </div>
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