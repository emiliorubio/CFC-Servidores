"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/context/OrganizationContext";
import RestrictedAccess from "@/components/RestrictedAccess";

interface MemberRow {
  key: string;
  id: string;
  full_name: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  team_id?: string | null;
  user_id?: string | null;
  source: "member" | "profile";
}

interface Team {
  id: string;
  name: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-slate-900 text-white border-slate-900",
  superadmin: "bg-slate-900 text-white border-slate-900",
  pastor: "bg-indigo-600 text-white border-indigo-600",
  lider: "bg-amber-100 text-amber-900 border-amber-300",
  coordinador: "bg-sky-100 text-sky-900 border-sky-300",
  tesorero: "bg-teal-100 text-teal-900 border-teal-300",
  servidor: "bg-slate-100 text-slate-700 border-slate-300",
};

function roleLabel(role?: string | null) {
  const r = (role || "servidor").toLowerCase().trim();
  if (r === "admin" || r === "superadmin") return "Pastor / Admin";
  if (r === "pastor") return "Pastor";
  if (r === "tesorero") return "Tesorero";
  if (r === "lider" || r === "líder") return "Líder";
  if (r === "coordinador") return "Coordinador";
  return "Servidor";
}

function whatsappDigits(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9) return null;
  if (digits.startsWith("56")) return digits;
  if (digits.startsWith("0")) return "56" + digits.slice(1);
  return "56" + digits;
}

function whatsappLink(phone?: string | null, name?: string) {
  const digits = whatsappDigits(phone);
  if (!digits) return null;
  const text = name ? `Hola ${name}! 👋` : "Hola! 👋";
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export default function DirectorioPage() {
  const { org, userProfile, userRole, loading: orgLoading } = useOrganization();
  const canManage = userRole === "admin" || userRole === "superadmin" || userRole === "lider" || userRole === "pastor" || userRole === "coordinador";

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filtros
  const [search, setSearch] = useState("");
  const [filterTeam, setFilterTeam] = useState("all");
  const [copied, setCopied] = useState(false);

  // Alta de miembro
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [teamId, setTeamId] = useState("");

  const loadAll = useCallback(async () => {
    if (!org?.id) return;

    const { data: membersData } = await supabase
      .from("church_members")
      .select("id, full_name, role, email, phone, team_id, user_id")
      .eq("organization_id", org.id)
      .order("full_name", { ascending: true });

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("organization_id", org.id)
      .order("full_name", { ascending: true });

    const { data: teamsData } = await supabase
      .from("ministry_teams")
      .select("id, name")
      .eq("organization_id", org.id)
      .order("name", { ascending: true });

    const rows: MemberRow[] = [];
    const linkedUsers = new Set<string>();
    (membersData || []).forEach((m) => {
      rows.push({
        key: m.id,
        id: m.id,
        full_name: m.full_name,
        role: m.role,
        email: m.email,
        phone: m.phone,
        team_id: m.team_id,
        user_id: m.user_id,
        source: "member",
      });
      if (m.user_id) linkedUsers.add(m.user_id);
    });
    (profiles || []).forEach((p) => {
      if (linkedUsers.has(p.id)) return;
      if (!p.full_name) return;
      rows.push({
        key: p.id,
        id: p.id,
        full_name: p.full_name,
        role: p.role,
        email: null,
        team_id: null,
        user_id: p.id,
        source: "profile",
      });
    });

    setMembers(rows);
    setTeams(teamsData || []);

    if ((teamsData || []).length > 0) {
      setTeamId((prev) => prev || teamsData![0].id);
    }

    setLoading(false);
  }, [org]);

  useEffect(() => {
    if (org?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del directorio
      loadAll();
    }
  }, [org?.id, loadAll]);

  const filteredMembers = members.filter((m) => {
    const matchesSearch = m.full_name.toLowerCase().includes(search.toLowerCase());
    const matchesTeam = filterTeam === "all" || m.team_id === filterTeam;
    return matchesSearch && matchesTeam;
  });

  const handleCopyList = async () => {
    if (filteredMembers.length === 0) return;
    const text = filteredMembers
      .map((m) => `${m.full_name}${m.phone ? ` — ${m.phone}` : ""}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert("No se pudo copiar la lista. Revisa los permisos del portapapeles.");
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org?.id || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("church_members").insert({
      organization_id: org.id,
      full_name: name.trim(),
      team_id: teamId || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      role: null,
    });
    if (error) {
      alert("No se pudo agregar al directorio: " + error.message);
    } else {
      setName("");
      setEmail("");
      setPhone("");
      await loadAll();
    }
    setSaving(false);
  };

  const handleChangeTeam = async (member: MemberRow, newTeamId: string) => {
    if (member.source === "profile") return; // los perfiles no son miembros editables por ahora
    const { error } = await supabase
      .from("church_members")
      .update({ team_id: newTeamId || null })
      .eq("id", member.id)
      .eq("organization_id", org?.id);
    if (error) {
      alert("Error al actualizar el área: " + error.message);
      return;
    }
    setMembers((prev) =>
      prev.map((m) => (m.key === member.key ? { ...m, team_id: newTeamId || null } : m))
    );
  };

  const handleRemoveMember = async (member: MemberRow) => {
    if (member.source === "profile") return;
    if (!confirm(`¿Quitar a ${member.full_name} del directorio?`)) return;
    const { error } = await supabase
      .from("church_members")
      .delete()
      .eq("id", member.id)
      .eq("organization_id", org?.id);
    if (error) {
      alert("Error al quitar miembro: " + error.message);
      return;
    }
    await loadAll();
  };

  if (orgLoading) {
    return (
      <div className="flex justify-center py-20 text-slate-500 text-sm">
        Cargando directorio...
      </div>
    );
  }

  if (!org || !userProfile) {
    return <RestrictedAccess message="El directorio de equipo está disponible para miembros con sesión en una iglesia asignada." />;
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="bg-gradient-to-r from-indigo-600 to-sky-600 text-white p-7 rounded-3xl shadow-lg space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full">
          EQUIPO {org.name.toUpperCase()}
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight">📇 Directorio de Servidores</h1>
        <p className="text-sm text-indigo-100 max-w-2xl">
          Todo el equipo y sus áreas en un solo lugar. Busca por nombre, cambia el área de un
          miembro o agrega a quienes aún no usan la app.
        </p>
      </div>

      {/* Alta de miembro (líderes / admin) */}
      {canManage && (
        <form
          onSubmit={handleAddMember}
          className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-3"
        >
          <h2 className="font-bold text-slate-800 text-base">➕ Agregar al Directorio</h2>
          <div className="grid gap-3 md:grid-cols-3 items-end">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Nombre completo</label>
              <input
                type="text"
                required
                placeholder="Ej: Fernanda Díaz"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Área / Ministerio</label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {teams.length === 0 ? (
                  <option value="">Sin áreas configuradas</option>
                ) : (
                  teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Correo (opcional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={saving || teams.length === 0}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
              >
                {saving ? "..." : "Agregar"}
              </button>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">WhatsApp (opcional)</label>
              <input
                type="tel"
                placeholder="Ej: +56 9 1234 5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </form>
      )}

      {/* Buscador y filtro */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="🔎 Buscar por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none"
          >
            <option value="all">Todas las áreas ({members.length})</option>
            {teams.map((t) => {
              const count = members.filter((m) => m.team_id === t.id).length;
              return (
                <option key={t.id} value={t.id}>
                  {t.name} ({count})
                </option>
              );
            })}
            <option value="none">Sin área asignada</option>
          </select>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-slate-500 font-medium">
            Mostrando {filteredMembers.length} persona(s)
          </p>
          <button
            onClick={handleCopyList}
            disabled={filteredMembers.length === 0}
            className="text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold px-3 py-2 rounded-xl transition-colors"
          >
            {copied ? "✓ Lista copiada" : "📋 Copiar lista"}
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-slate-400 py-2">Cargando equipo...</p>
        ) : filteredMembers.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-10 text-center">
            <p className="text-3xl mb-2">👥</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {members.length === 0
                ? "Aún no hay nadie en el directorio. Agrega al primer servidor para armar el equipo."
                : "No hay coincidencias con tu búsqueda o filtro."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredMembers.map((m) => {
              const team = teams.find((t) => t.id === m.team_id);
              return (
                <div
                  key={m.key}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{m.full_name}</p>
                      {m.email ? (
                        <p className="text-[11px] text-slate-500 truncate">{m.email}</p>
                      ) : (
                        <p className="text-[11px] text-slate-400">{m.source === "profile" ? "Cuenta de usuario" : "Miembro de la iglesia"}</p>
                      )}
                      {m.phone ? (
                        <p className="text-[11px] text-slate-500 truncate">📱 {m.phone}</p>
                      ) : m.source === "member" ? (
                        <p className="text-[11px] text-slate-400">WhatsApp: —</p>
                      ) : null}
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-1 rounded-full border shrink-0 ${
                        ROLE_COLORS[m.role?.toLowerCase() || "servidor"] || ROLE_COLORS.servidor
                      }`}
                    >
                      {roleLabel(m.role)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    {canManage && m.source === "member" ? (
                      <select
                        value={m.team_id || ""}
                        onChange={(e) => handleChangeTeam(m, e.target.value)}
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] font-semibold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        title="Cambiar área"
                      >
                        <option value="">Sin área</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1.5 rounded-xl">
                        {team?.name || "Sin área asignada"}
                      </span>
                    )}

                    {whatsappLink(m.phone) && (
                      <a
                        href={whatsappLink(m.phone, m.full_name)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Escribir por WhatsApp"
                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 shrink-0 border border-emerald-200 bg-emerald-50 rounded-lg px-2 py-1 transition-colors"
                      >
                        WhatsApp
                      </a>
                    )}

                    {canManage && m.source === "member" && (
                      <button
                        onClick={() => handleRemoveMember(m)}
                        className="text-[10px] text-red-400 hover:text-red-300 font-bold shrink-0"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}