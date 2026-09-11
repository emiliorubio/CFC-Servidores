"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/context/OrganizationContext";
import RestrictedAccess from "@/components/RestrictedAccess";
import { SuperadminNewOrg } from "@/app/configuracion/page";
import { useRouter } from "next/navigation";

interface PlatformOrg {
  id: string;
  name: string;
  slug: string;
  plan: string;
  signup_visible: boolean;
  public_adoracion: boolean;
  public_escuela: boolean;
primary_color?: string;
  secondary_color?: string;
  service_pattern?: { weekday: number; time: string }[];
  hidden_modules?: string[];
  counts: { cultos: number; miembros: number; asignaciones: number };
}

interface PlatformUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  organization_name: string | null;
}

interface TrialRequest {
  id: string;
  full_name: string;
  email: string;
  church_name: string;
  message: string | null;
  status: "pendiente" | "aprobado" | "rechazado";
  created_at: string;
}

interface AccessGrant {
  email: string;
  requestId: string;
  notified?: boolean;
}

interface DiagnosticCheck {
  key: string;
  label: string;
  applied: boolean;
  source: string;
}

const ROLE_LABELS: Record<string, string> = {
  servidor: "Servidor",
  lider: "Líder",
  admin: "Admin",
  coordinador: "Coordinador",
  pastor: "Pastor",
  tesorero: "Tesorero",
  superadmin: "Superadmin",
};

const SECCIONES_MENU = [
  { key: "servidores", label: "Servidores & Inscripción" },
  { key: "directorio", label: "Directorio" },
  { key: "consolidacion", label: "Consolidación" },
  { key: "grupos", label: "Grupos" },
  { key: "sermones", label: "Sermones" },
  { key: "adoracion", label: "Equipo de Adoración" },
  { key: "escuela", label: "Escuela Dominical" },
  { key: "finanzas", label: "Finanzas" },
  { key: "cafeteria", label: "Cafetería" },
  { key: "usuarios", label: "Usuarios" },
] as const;

export default function PlataformaPage() {
  const { userRole, loading: orgLoading, switchOrganization } = useOrganization();
  const router = useRouter();

const [orgs, setOrgs] = useState<PlatformOrg[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [tab, setTab] = useState<"iglesias" | "usuarios" | "nueva" | "diag" | "pruebas">("iglesias");
  const [diagnostics, setDiagnostics] = useState<DiagnosticCheck[] | null>(null);
  const [diagError, setDiagError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingOrg, setSavingOrg] = useState<string | null>(null);
  const [genOrg, setGenOrg] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "info" | "error"; text: string } | null>(null);
  const [editOrg, setEditOrg] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrimary, setEditPrimary] = useState("#4F46E5");
  const [editSecondary, setEditSecondary] = useState("#0F172A");
  const [userSearch, setUserSearch] = useState("");
  const [trialRequests, setTrialRequests] = useState<TrialRequest[]>([]);
  const [authTarget, setAuthTarget] = useState<string | null>(null);
  const [authOrgId, setAuthOrgId] = useState("");
  const [authSaving, setAuthSaving] = useState(false);
  const [granted, setGranted] = useState<AccessGrant | null>(null);
  const [notifySending, setNotifySending] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deletingOrg, setDeletingOrg] = useState(false);

  const loadTrials = useCallback(async () => {
    const { data, error } = await supabase
      .from("trial_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setTrialRequests(data as TrialRequest[]);
    }
  }, []);

  const loadAll = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    const [orgsRes, usersRes] = await Promise.all([
      fetch("/api/platform/orgs", { headers: { Authorization: `Bearer ${session.access_token}` } }),
      fetch("/api/platform/users", { headers: { Authorization: `Bearer ${session.access_token}` } }),
    ]);
    if (orgsRes.ok) {
      const { orgs: data } = await orgsRes.json();
      setOrgs(data || []);
    } else {
      const { error } = await orgsRes.json().catch(() => ({ error: "Error al cargar iglesias." }));
      setMessage({ type: "error", text: error });
    }
if (usersRes.ok) {
      const { users: data } = await usersRes.json();
      setUsers(data || []);
    }
    void loadTrials();
    setLoading(false);
  }, [loadTrials]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del panel
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (tab !== "diag" || diagnostics !== null) return;
    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      setDiagError(null);
      try {
        const res = await fetch("/api/platform/diagnostics", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "No se pudo ejecutar el diagnóstico.");
        setDiagnostics(result.checks || []);
      } catch (err) {
        setDiagnostics([]);
        setDiagError(err instanceof Error ? err.message : String(err));
      }
    };
    run();
  }, [tab, diagnostics]);

  if (orgLoading || (loading && orgs.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600 font-medium">Cargando plataforma...</p>
      </div>
    );
  }

  if (userRole !== "superadmin") {
    return (
      <RestrictedAccess message="El panel de plataforma está disponible únicamente para el superadmin." />
    );
  }

const updateOrg = async (orgId: string, changes: Partial<PlatformOrg>) => {
    setSavingOrg(orgId);
    setMessage(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    try {
      const res = await fetch("/api/platform/orgs", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ id: orgId, ...changes }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "No se pudo actualizar.");
      setOrgs((prev) => prev.map((o) => (o.id === orgId ? { ...o, ...changes } : o)));
    } catch (err) {
      setMessage({ type: "error", text: "Error: " + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setSavingOrg(null);
    }
  };

  const toggleSeccion = async (church: PlatformOrg, modulo: string) => {
    const actual = new Set(church.hidden_modules || []);
    if (actual.has(modulo)) actual.delete(modulo);
    else actual.add(modulo);
    await updateOrg(church.id, { hidden_modules: Array.from(actual) });
  };

  const regenCultos = async (target: PlatformOrg) => {
    setGenOrg(target.id);
    setMessage(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Inicia sesión para generar cultos.");
      const res = await fetch("/api/cultos/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ orgId: target.id, meses: 1 }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "No se pudieron generar los cultos.");
      setMessage({
        type: result.creados > 0 ? "success" : "info",
        text: result.message,
      });
      await loadAll();
    } catch (err) {
      setMessage({ type: "error", text: "Error: " + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setGenOrg(null);
    }
  };

const deleteOrg = async (orgId: string) => {
    setDeletingOrg(true);
    setMessage(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Inicia sesión para eliminar.");
      const res = await fetch("/api/platform/orgs?id=" + encodeURIComponent(orgId), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "No se pudo eliminar la iglesia.");
      setMessage({
        type: "success",
        text:
          "Iglesia eliminada. Se borraron " +
          result.cuentas_eliminadas +
          " cuenta(s) asociada(s).",
      });
      setConfirmDelete(null);
      await loadAll();
    } catch (err) {
      setMessage({ type: "error", text: "Error: " + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setDeletingOrg(false);
    }
  };

const changeRole = async (userId: string, role: string) => {
    setMessage(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    try {
      const res = await fetch("/api/platform/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ userId, role }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "No se pudo cambiar el rol.");
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
      setMessage({ type: "success", text: "Rol actualizado." });
    } catch (err) {
      setMessage({ type: "error", text: "Error: " + (err instanceof Error ? err.message : String(err)) });
    }
  };

  const autorizarTrial = async (id: string) => {
    if (!authOrgId) {
      setMessage({ type: "error", text: "Elige la iglesia en la que autorizarás el acceso." });
      return;
    }
    setAuthSaving(true);
    setMessage(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Inicia sesión como superadmin.");
      const res = await fetch("/api/trial-request/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ requestId: id, orgId: authOrgId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "No se pudo autorizar el acceso.");
      setGranted({ email: result.email, requestId: id });
      setAuthTarget(null);
      setAuthOrgId("");
      await loadTrials();
    } catch (err) {
      setMessage({ type: "error", text: "Error: " + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setAuthSaving(false);
    }
  };

  const notificarTrial = async () => {
    if (!granted) return;
    setNotifySending(true);
    setMessage(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Inicia sesión como superadmin.");
      const res = await fetch("/api/trial-request/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ requestId: granted.requestId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "No se pudo enviar el correo.");
      setGranted({ ...granted, notified: true });
      setMessage({
        type: "success",
        text: `Correo de bienvenida enviado a ${granted.email}. Revisa que llegue a la bandeja de entrada o de spam.`,
      });
    } catch (err) {
      setMessage({ type: "error", text: "Error: " + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setNotifySending(false);
    }
  };

  const rechazarTrial = async (id: string) => {
    setRejectingId(id);
    setMessage(null);
    try {
      const { error } = await supabase.from("trial_requests").update({ status: "rechazado" }).eq("id", id);
      if (error) throw error;
      await loadTrials();
      setMessage({ type: "info", text: "Solicitud rechazada." });
    } catch (err) {
      setMessage({ type: "error", text: "Error: " + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setRejectingId(null);
    }
  };

  const openChurch = (target: PlatformOrg) => {
    switchOrganization(target.id);
    router.push("/");
  };

  const startEdit = (church: PlatformOrg) => {
    setEditName(church.name);
    setEditPrimary(church.primary_color || "#4F46E5");
    setEditSecondary(church.secondary_color || "#0F172A");
    setEditOrg(church.id);
  };

const saveEdit = async (church: PlatformOrg) => {
    await updateOrg(church.id, {
      name: editName.trim() || church.name,
      primary_color: editPrimary,
      secondary_color: editSecondary,
    });
    setEditOrg(null);
  };

  const q = userSearch.trim().toLowerCase();
  const filteredUsers = q
    ? users.filter(
        (u) => u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
      )
    : users;
  const pendingTrials = trialRequests.filter((r) => r.status === "pendiente");

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ENCABEZADO */}
        <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider bg-white/10 px-3 py-1 rounded-full">
            SUPERADMIN
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">🛠 Panel de Plataforma</h1>
          <p className="text-sm text-slate-300 max-w-2xl">
            Administra iglesias y usuarios de toda la plataforma. Los cambios se guardan al
            instante, sin tocar la base de datos directamente.
          </p>
        </div>

        {message && (
          <div
            className={`p-4 rounded-2xl text-sm font-semibold ${
              message.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : message.type === "error"
                  ? "bg-rose-50 border border-rose-200 text-rose-800"
                  : "bg-sky-50 border border-sky-200 text-sky-800"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* TABS */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab("iglesias")}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              tab === "iglesias" ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200"
            }`}
          >
            🏫 Iglesias ({orgs.length})
          </button>
          <button
            onClick={() => setTab("usuarios")}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              tab === "usuarios" ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200"
            }`}
          >
            👥 Usuarios ({users.length})
          </button>
          <button
            onClick={() => setTab("nueva")}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              tab === "nueva" ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200"
            }`}
          >
            ➕ Nueva iglesia
          </button>
<button
            onClick={() => setTab("diag")}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              tab === "diag" ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200"
            }`}
          >
            🔍 Diagnóstico
          </button>
          <button
            onClick={() => setTab("pruebas")}
            className={`relative px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              tab === "pruebas" ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200"
            }`}
          >
            📬 Probar la plataforma
            {pendingTrials.length > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full bg-amber-400 text-slate-900 text-[10px] font-bold flex items-center justify-center">
                {pendingTrials.length}
              </span>
            )}
          </button>
        </div>

        {tab === "iglesias" && (
          <div className="grid gap-4">
            {orgs.map((church) => (
              <div key={church.id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">{church.name}</h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      {church.slug}.miiglesia.cl — Plan: {church.plan}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {church.counts.cultos} cultos · {church.counts.miembros} en directorio · {church.counts.asignaciones} asignaciones
                      {church.service_pattern && church.service_pattern.length > 0
                        ? ` · ${church.service_pattern.length} horario(s)`
                        : " · sin horarios configurados"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => (editOrg === church.id ? setEditOrg(null) : startEdit(church))}
                      className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold px-3 py-2 rounded-xl transition-colors"
                    >
                      {editOrg === church.id ? "Cancelar" : "✏️ Editar"}
                    </button>
                    <button
                      onClick={() => openChurch(church)}
                      className="text-xs bg-slate-900 text-white hover:bg-slate-800 font-bold px-3 py-2 rounded-xl transition-colors"
                    >
                      Abrir iglesia →
                    </button>
                    <button
                      onClick={() => regenCultos(church)}
                      disabled={genOrg === church.id}
                      className="text-xs bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold px-3 py-2 rounded-xl transition-colors"
                    >
{genOrg === church.id ? "Generando..." : "⚡ Gén. Cultos 1 mes"}
                    </button>
                    <button
                      onClick={() => (confirmDelete === church.id ? setConfirmDelete(null) : setConfirmDelete(church.id))}
                      className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold px-3 py-2 rounded-xl transition-colors"
                    >
                      {confirmDelete === church.id ? "Cancelar" : "🗑 Eliminar"}
                    </button>
                  </div>
                </div>

                {editOrg === church.id && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <p className="text-xs font-bold text-slate-700">Editar identidad de la iglesia</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Nombre</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Color primario</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editPrimary}
                            onChange={(e) => setEditPrimary(e.target.value)}
                            className="w-10 h-10 rounded-xl cursor-pointer border-0"
                          />
                          <input
                            type="text"
                            value={editPrimary}
                            onChange={(e) => setEditPrimary(e.target.value)}
                            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono uppercase focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Color secundario</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editSecondary}
                            onChange={(e) => setEditSecondary(e.target.value)}
                            className="w-10 h-10 rounded-xl cursor-pointer border-0"
                          />
                          <input
                            type="text"
                            value={editSecondary}
                            onChange={(e) => setEditSecondary(e.target.value)}
                            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono uppercase focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <button
                        onClick={() => saveEdit(church)}
                        disabled={savingOrg === church.id}
                        className="text-xs bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold px-4 py-2 rounded-xl transition-colors"
                      >
                        {savingOrg === church.id ? "Guardando..." : "Guardar cambios"}
                      </button>
</div>
                  </div>
                )}

                {confirmDelete === church.id && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 space-y-3">
                    <p className="text-sm font-bold text-rose-700">
                      ⚠️ ¿Eliminar la iglesia «{church.name}»?
                    </p>
                    <p className="text-[11px] text-rose-600">
                      Se borrarán su subdominio, cultos, miembros, equipos y las cuentas
                      asociadas. Esta acción no se puede deshacer.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={deletingOrg}
                        onClick={() => deleteOrg(church.id)}
                        className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-bold py-2 rounded-xl text-xs transition-colors"
                      >
                        {deletingOrg ? "Eliminando..." : "Sí, eliminar la iglesia"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(null)}
                        className="flex-1 border border-slate-200 bg-white text-slate-600 font-bold py-2 rounded-xl text-xs hover:bg-slate-50 transition-colors"
                      >
                        Conservar
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(
                    [
                      { key: "signup_visible", label: "Registro abierto", hint: "Los miembros se registran por el enlace (subdominio) de esta iglesia" },
                      { key: "public_adoracion", label: "Ver Adoración (todos)", hint: "Lectura pública del repertorio" },
                      { key: "public_escuela", label: "Ver Escuela Dominical (todos)", hint: "Lectura pública de clases" },
                    ] as const
                  ).map((toggle) => (
                    <div key={toggle.key} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{toggle.label}</p>
                        <p className="text-[11px] text-slate-500">{toggle.hint}</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(church[toggle.key])}
                        disabled={savingOrg === church.id}
                        onClick={() => updateOrg(church.id, { [toggle.key]: !church[toggle.key] })}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                          church[toggle.key] ? "bg-emerald-500" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            church[toggle.key] ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
))}
                </div>

                <div className="mt-5 border-t border-slate-100 pt-5">
                  <p className="text-xs font-bold text-slate-800">Secciones del menú de la iglesia</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 mb-2.5">
                    En rojo = oculta del menú de esa iglesia. Apaga la sección que la iglesia pidió quitar.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {SECCIONES_MENU.map((s) => {
                      const oculta = (church.hidden_modules || []).includes(s.key);
                      return (
                        <div
                          key={s.key}
                          className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 transition-colors ${
                            oculta ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"
                          }`}
                        >
                          <p className={`text-[11px] font-semibold ${oculta ? "text-rose-700" : "text-slate-700"}`}>{s.label}</p>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={!oculta}
                            disabled={savingOrg === church.id}
                            onClick={() => toggleSeccion(church, s.key)}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                              oculta ? "bg-rose-400" : "bg-emerald-500"
                            }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                oculta ? "translate-x-0.5" : "translate-x-5"
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "usuarios" && (
<div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-800 text-lg">Usuarios de la plataforma</h2>
            <p className="text-xs text-slate-500">
              Cambia el rol de cualquier persona. Hacer a alguien <b>superadmin</b> le da control total
              sobre todas las iglesias.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="search"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="🔎 Buscar por nombre o correo..."
                className="flex-1 min-w-[220px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              <span className="text-[11px] font-bold text-slate-500">
                {filteredUsers.length} de {users.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                    <th className="py-2 pr-3 font-bold">Persona</th>
                    <th className="py-2 pr-3 font-bold">Iglesia</th>
                    <th className="py-2 font-bold">Rol</th>
                  </tr>
                </thead>
<tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-3">
                        <p className="font-semibold text-slate-800">
                          {user.full_name || "Sin nombre"} {user.role === "superadmin" && "⭐"}
                        </p>
                        <p className="text-xs text-slate-400">{user.email}</p>
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-slate-600">{user.organization_name || "—"}</td>
                      <td className="py-2.5">
                        <select
                          value={user.role}
                          onChange={(e) => changeRole(user.id, e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
                        >
                          {Object.entries(ROLE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      {tab === "nueva" && (
          <SuperadminNewOrg onCreated={loadAll} />
        )}

        {tab === "diag" && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-800 text-lg">🔍 Diagnóstico de la base de datos</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Verifica en vivo qué capacidades están activas en Supabase. Si algo aparece en
                  rojo, copia el archivo indicado en el SQL Editor para aplicarlo.
                </p>
              </div>
              {diagnostics && diagnostics.length > 0 && (
                <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
                  {diagnostics.filter((d) => d.applied).length}/{diagnostics.length} aplicadas
                </span>
              )}
            </div>

            {diagError && (
              <div className="p-4 rounded-2xl text-sm font-semibold bg-rose-50 border border-rose-200 text-rose-800">
                {diagError}
              </div>
            )}

            {!diagnostics && !diagError ? (
              <p className="text-xs text-slate-400">Ejecutando diagnóstico...</p>
            ) : (
              <div className="space-y-2">
                {diagnostics?.map((d) => (
                  <div
                    key={d.key}
                    className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 ${
                      d.applied
                        ? "bg-emerald-50/60 border-emerald-200"
                        : "bg-rose-50/60 border-rose-200"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800">
                        {d.applied ? "✓" : "✗"} {d.label}
                      </p>
                      {!d.applied && (
                        <p className="text-[11px] text-rose-700 mt-0.5">
                          Aplicar en SQL Editor: supabase/migrations/{d.source}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-1 rounded-full border shrink-0 ${
                        d.applied
                          ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                          : "bg-rose-100 text-rose-700 border-rose-300"
                      }`}
                    >
                      {d.applied ? "Activo" : "Falta"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
)}

        {tab === "pruebas" && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-800 text-lg">📬 Solicitudes para probar la plataforma</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Quienes piden probar la plataforma desde la portada llegan aquí. Al autorizar,
                  se crea la cuenta con rol Admin en la iglesia que elijas y se envía por correo
                  un enlace para que la persona cree su propia contraseña.
                </p>
              </div>
              {pendingTrials.length > 0 && (
                <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-400 text-slate-900">
                  {pendingTrials.length} pendiente(s)
                </span>
              )}
            </div>

            {granted && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                <p className="text-sm font-bold text-emerald-900">✅ Acceso autorizado</p>
                <p className="text-xs text-emerald-800">
                  Cuenta creada para{" "}
                  <span className="font-mono font-bold bg-white border border-emerald-200 rounded-lg px-2 py-0.5">
                    {granted.email}
                  </span>
                  . Ahora envía el correo de bienvenida para que esa persona cree su propia contraseña.
                </p>
                {granted.notified && (
                  <p className="text-xs font-semibold text-emerald-700">
                    📨 Correo de bienvenida enviado a {granted.email}. Si no le llegó, puedes
                    reenviarlo aquí abajo.
                  </p>
                )}
                <button
                  type="button"
                  disabled={notifySending}
                  onClick={() => notificarTrial()}
                  className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold px-4 py-2.5 rounded-xl transition-colors"
                >
                  {notifySending
                    ? "Enviando..."
                    : granted.notified
                      ? "📨 Reenviar correo de bienvenida"
                      : "📨 Enviar correo de bienvenida"}
                </button>
              </div>
            )}

            {trialRequests.length === 0 ? (
              <p className="text-xs text-slate-400">Aún no hay solicitudes para probar la plataforma.</p>
            ) : (
              <div className="grid gap-3">
                {trialRequests.map((req) => (
                  <div key={req.id} className="rounded-2xl border border-slate-200 p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-slate-800">{req.full_name}</p>
                        <p className="text-xs text-slate-500">{req.email}</p>
                        <p className="text-[11px] text-slate-400">
                          🏫 {req.church_name} ·{" "}
                          {new Date(req.created_at).toLocaleDateString("es-CL", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                          req.status === "pendiente"
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : req.status === "aprobado"
                              ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {req.status === "pendiente" ? "Pendiente" : req.status === "aprobado" ? "Aprobado" : "Rechazado"}
                      </span>
                    </div>
                    {req.message && <p className="text-xs text-slate-500 italic">“{req.message}”</p>}

                    {req.status === "pendiente" && (
                      <div className="pt-1">
                        {authTarget === req.id ? (
                          <div className="space-y-2 rounded-2xl bg-slate-50 border border-slate-200 p-3">
                            <label className="block text-xs font-bold text-slate-700">
                              Iglesia en la que tendrá acceso
                            </label>
                            <select
                              value={authOrgId}
                              onChange={(e) => setAuthOrgId(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-400"
                            >
                              <option value="">Selecciona una iglesia…</option>
                              {orgs.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name}
                                </option>
                              ))}
                            </select>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={authSaving}
                                onClick={() => autorizarTrial(req.id)}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold py-2 rounded-xl text-xs transition-colors"
                              >
                                {authSaving ? "Creando cuenta..." : "Confirmar acceso"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAuthTarget(null);
                                  setAuthOrgId("");
                                }}
                                className="flex-1 border border-slate-200 text-slate-600 font-bold py-2 rounded-xl text-xs hover:bg-slate-50 transition-colors"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setAuthTarget(req.id);
                                setAuthOrgId("");
                                setGranted(null);
                              }}
                              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors"
                            >
                              Autorizar acceso
                            </button>
                            <button
                              type="button"
                              disabled={rejectingId === req.id}
                              onClick={() => rechazarTrial(req.id)}
                              className="border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold px-4 py-2 rounded-xl text-xs transition-colors disabled:opacity-50"
                            >
                              {rejectingId === req.id ? "Rechazando..." : "Rechazar"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
