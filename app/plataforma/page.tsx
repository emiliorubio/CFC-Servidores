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
  counts: { cultos: number; miembros: number; asignaciones: number };
}

interface PlatformUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  organization_name: string | null;
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

export default function PlataformaPage() {
  const { userRole, loading: orgLoading, switchOrganization } = useOrganization();
  const router = useRouter();

  const [orgs, setOrgs] = useState<PlatformOrg[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [tab, setTab] = useState<"iglesias" | "usuarios" | "nueva" | "diag">("iglesias");
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
    setLoading(false);
  }, []);

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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(
                    [
                      { key: "signup_visible", label: "Registro abierto", hint: "Permite crear cuentas desde /login" },
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
                  {users.map((user) => (
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
                  {diagnostics.filter((d) => d.applied).length}/{diagnostics.length} aplicaradas
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
      </div>
    </div>
  );
}