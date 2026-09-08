"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrganization } from "@/context/OrganizationContext";
import type { Organization } from "@/context/OrganizationContext";
import { supabase } from "@/lib/supabase";
import RestrictedAccess from "@/components/RestrictedAccess";

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  requested_role: string | null;
  organization_id: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  servidor: "Servidor",
  lider: "Líder",
  coordinador: "Coordinador",
  pastor: "Pastor",
  tesorero: "Tesorero",
  admin: "Administrador",
  superadmin: "Superadministrador",
};

const ROLE_OPTIONS = ["servidor", "lider", "coordinador", "pastor", "tesorero", "admin"] as const;

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin: "bg-amber-50 border-amber-300 text-amber-800",
    superadmin: "bg-rose-50 border-rose-300 text-rose-800",
    pastor: "bg-indigo-50 border-indigo-300 text-indigo-800",
    tesorero: "bg-teal-50 border-teal-300 text-teal-800",
    coordinador: "bg-sky-50 border-sky-300 text-sky-800",
    lider: "bg-violet-50 border-violet-300 text-violet-800",
    servidor: "bg-slate-100 border-slate-300 text-slate-700",
  };
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${colors[role] || colors.servidor}`}>
      {ROLE_LABELS[role] || role}
    </span>
  );
}

function UsersPanel({ org }: { org: Organization }) {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, requested_role, organization_id")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage({ type: "error", text: "No se pudieron cargar los usuarios: " + error.message });
      return;
    }
    setProfiles((data || []) as ProfileRow[]);
  }, [org.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de usuarios al montar
    loadUsers();
  }, [loadUsers]);

  const handleRoleChange = async (profileId: string, newRole: string) => {
    setSavingId(profileId);
    setMessage(null);
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", profileId);

    if (error) {
      setMessage({ type: "error", text: "No se pudo actualizar el rol: " + error.message });
    } else {
      setMessage({ type: "success", text: "Rol actualizado correctamente." });
      await loadUsers();
    }
    setSavingId(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Encabezado */}
        <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-lg space-y-2">
          <span className="inline-flex text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full">
            ADMINISTRACIÓN DE PERSONAS
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">👥 Usuarios de {org.name}</h1>
          <p className="text-sm text-slate-300">
            Ve tu equipo y confirma el rol de cada persona (Servidor, Líder, Coordinador, Pastor o Administrador).
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

        <section className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Equipo registrado</h2>
              <p className="text-xs text-slate-500 mt-1">{profiles.length} personas con cuenta en esta iglesia.</p>
            </div>
          </div>

          {profiles.length === 0 ? (
            <p className="rounded-xl bg-slate-50 border border-dashed border-slate-200 p-4 text-xs text-slate-500">
              Aún no hay usuarios registrados. Pide que se registren desde el enlace de la iglesia (Registrarse).
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3 font-bold">Persona</th>
                    <th className="px-4 py-3 font-bold">Contacto</th>
                    <th className="px-4 py-3 font-bold">Rol actual</th>
                    <th className="px-4 py-3 font-bold">Asignar rol</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((profile) => (
                    <tr key={profile.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{profile.full_name || "Sin nombre"}</p>
                        {profile.requested_role && profile.requested_role !== profile.role && (
                          <p className="text-[11px] text-sky-700 font-bold mt-0.5">
                            Solicita: {ROLE_LABELS[profile.requested_role] || profile.requested_role}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{profile.email || "—"}</td>
                      <td className="px-4 py-3">
                        <RoleBadge role={profile.role} />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={profile.role}
                          disabled={savingId === profile.id}
                          onChange={(e) => handleRoleChange(profile.id, e.target.value)}
                          className="text-xs font-semibold py-1.5 px-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                          {ROLE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {ROLE_LABELS[option]}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function UsuariosPage() {
  const { org, userRole, loading: orgLoading } = useOrganization();

  if (orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600 font-medium">Cargando usuarios...</p>
      </div>
    );
  }

  const isAdmin = userRole === "admin" || userRole === "superadmin";
  if (!isAdmin || !org) {
    return (
      <RestrictedAccess message="La gestión de usuarios está disponible únicamente para administradores con una iglesia asignada." />
    );
  }

  return <UsersPanel key={org.id} org={org} />;
}