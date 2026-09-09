"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  plan: string;
  active_modules: Record<string, boolean>;
  address?: string | null;
  service_times?: string | null;
  contact_phone?: string | null;
  signup_visible?: boolean;
  service_pattern?: { weekday: number; time: string }[];
  public_adoracion?: boolean;
  public_escuela?: boolean;
}

export type UserRole = "superadmin" | "admin" | "pastor" | "tesorero" | "coordinador" | "lider" | "servidor";

export interface UserProfile {
  id: string;
  full_name?: string | null;
  role: UserRole;
  organization_id?: string | null;
}

interface OrgContextType {
  org: Organization | null;
  allOrgs: Organization[];
  userRole: UserRole;
  userProfile: UserProfile | null;
  loading: boolean;
  canSeeAdoracion: boolean;
  canSeeEscuela: boolean;
  canManageEscuela: boolean;
  switchOrganization: (orgId: string) => void;
  refresh: () => void;
}

// Un servidor que sirve en un módulo (aunque no sea líder) también accede a él.
function matchesAdoracionTeam(name: string) {
  const n = name.toLowerCase();
  return (
    n.includes("adorac") ||
    n.includes("alabanz") ||
    n.includes("músic") ||
    n.includes("banda") ||
    n.includes("coro") ||
    n.includes("sonido")
  );
}

function matchesEscuelaTeam(name: string) {
  const n = name.toLowerCase();
  return (
    n.includes("escuela") ||
    n.includes("dominical") ||
    n.includes("niño") ||
    n.includes("niña") ||
    n.includes("maestr") ||
    n.includes("profesor") ||
    n.includes("infantil")
  );
}

const ADORACION_AREA_TERMS = [
  "voz",
  "cantante",
  "alabanza",
  "guitarra",
  "bajo",
  "batería",
  "teclado",
  "piano",
  "secuencias",
  "multitracks",
  "sonido",
  "plataforma",
  "adorac",
];

const ESCUELA_AREA_TERMS = ["escuela", "dominical", "niño", "niña", "maestr", "profesor", "infantil"];

function matchesArea(roleAssigned: string | null, terms: string[]) {
  if (!roleAssigned) return false;
  const r = roleAssigned.toLowerCase();
  return terms.some((t) => r.includes(t));
}

function normalizeSlug(slug: string) {
  return slug.toLowerCase().replace(/-/g, "");
}

function organizationSlugFromLocation() {
  if (typeof window === "undefined") return null;

  const hostname = window.location.hostname.toLowerCase();
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";

  // Permite probar una iglesia localmente sin alterar DNS:
  // http://localhost:3000/login?org=cfc-puente-alto
  if (isLocal) {
    return new URLSearchParams(window.location.search).get("org");
  }

  const [subdomain] = hostname.split(".");
  return subdomain && subdomain !== "www" ? subdomain : null;
}

const OrganizationContext = createContext<OrgContextType>({
  org: null,
  allOrgs: [],
  userRole: "servidor",
  userProfile: null,
  loading: true,
  canSeeAdoracion: false,
  canSeeEscuela: false,
  canManageEscuela: false,
  switchOrganization: () => {},
  refresh: () => {},
});

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [org, setOrg] = useState<Organization | null>(null);
  const [allOrgs, setAllOrgs] = useState<Organization[]>([]);
  const [userRole, setUserRole] = useState<UserRole>("servidor");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [canSeeAdoracion, setCanSeeAdoracion] = useState(false);
  const [canSeeEscuela, setCanSeeEscuela] = useState(false);
  const [canManageEscuela, setCanManageEscuela] = useState(false);

  const loadData = useCallback(async () => {
    try {
      // 1. Obtener sesión de usuario
      const { data: { session } } = await supabase.auth.getSession();

      // Cargar lista de iglesias para selector (solo accesible para SuperAdmin/Dev)
      const { data: orgsData, error: orgsError } = await supabase.from("organizations").select("*");
      if (orgsError) throw orgsError;
      const availableOrgs = orgsData || [];
      setAllOrgs(availableOrgs);

      const hostSlug = organizationSlugFromLocation();
      const organizationFromHost = hostSlug
        ? availableOrgs.find((organization) => normalizeSlug(organization.slug) === normalizeSlug(hostSlug)) || null
        : null;

      if (!session?.user) {
        // Un visitante ve la identidad de la iglesia indicada por su subdominio.
        setOrg(organizationFromHost);
        setUserProfile(null);
        setCanSeeAdoracion(false);
        setCanSeeEscuela(false);
        setLoading(false);
        return;
      }

      // 2. Buscar perfil del usuario para obtener SU iglesia exacta
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id, role, full_name")
        .eq("id", session.user.id)
        .maybeSingle();

      interface MemberRowData {
        organization_id: string;
        role: string | null;
        full_name: string | null;
      }
      let member: MemberRowData | null = null;
      {
        const { data: byUserId } = await supabase
          .from("church_members")
          .select("organization_id, role, full_name")
          .eq("user_id", session.user.id)
          .limit(1);
        if (byUserId && byUserId.length > 0) {
          member = byUserId[0] as MemberRowData;
        } else if (session.user.email) {
          const { data: byEmail } = await supabase
            .from("church_members")
            .select("organization_id, role, full_name")
            .eq("email", session.user.email)
            .limit(1);
          if (byEmail && byEmail.length > 0) {
            member = byEmail[0] as MemberRowData;
          }
        }
      }

      const userOrgId = profile?.organization_id || member?.organization_id;
      const currentRole = (profile?.role || member?.role || "servidor") as UserRole;

      setUserRole(currentRole);
      setUserProfile({
        id: session.user.id,
        full_name: profile?.full_name || member?.full_name || session.user.user_metadata?.full_name || null,
        role: currentRole,
        organization_id: userOrgId || null,
      });

      // Si el usuario aún no tiene iglesia asignada, la del subdominio por el
      // que entró (ej. cfcpuentealto.miiglesia.cl) se convierte en la suya.
      let finalUserOrgId = userOrgId;
      if (!finalUserOrgId && organizationFromHost && currentRole !== "superadmin") {
        finalUserOrgId = organizationFromHost.id;
        await supabase
          .from("profiles")
          .update({ organization_id: organizationFromHost.id })
          .eq("id", session.user.id);
        setUserProfile({
          id: session.user.id,
          full_name:
            profile?.full_name || member?.full_name || session.user.user_metadata?.full_name || null,
          role: currentRole,
          organization_id: organizationFromHost.id,
        });
      }

      // 2b. Acceso a los módulos: los líderes/admin/pastor entran siempre; un
      //     servidor también entra si su ficha (church_members) o sus
      //     asignaciones apuntan a un equipo de Adoración o de Escuela.
      const isModuleLeader =
        currentRole === "lider" ||
        currentRole === "admin" ||
        currentRole === "superadmin" ||
        currentRole === "pastor";
      setCanSeeAdoracion(isModuleLeader);
      setCanSeeEscuela(isModuleLeader);

      let servesAdoracion = false;
      let servesEscuela = false;

      if (finalUserOrgId && !isModuleLeader) {
        const { data: teamsData } = await supabase
          .from("ministry_teams")
          .select("id, name")
          .eq("organization_id", finalUserOrgId);
        const teams = teamsData || [];
        const adoracionTeamIds = new Set(
          teams.filter((t) => matchesAdoracionTeam(t.name)).map((t) => t.id)
        );
        const escuelaTeamIds = new Set(
          teams.filter((t) => matchesEscuelaTeam(t.name)).map((t) => t.id)
        );

        const memberOrParts = [`user_id.eq.${session.user.id}`];
        if (session.user.email) memberOrParts.push(`email.eq.${session.user.email}`);
        const { data: memberTeams } = await supabase
          .from("church_members")
          .select("team_id")
          .eq("organization_id", finalUserOrgId)
          .or(memberOrParts.join(","));

        const { data: myAssigns } = await supabase
          .from("service_assignments")
          .select("team_id, role_assigned")
          .eq("organization_id", finalUserOrgId)
          .eq("user_id", session.user.id)
          .limit(200);

        const involvedTeams = new Set<string>([
          ...(memberTeams || []).map((m) => m.team_id),
          ...(myAssigns || []).map((a) => a.team_id),
        ]);
        const myRoles = (myAssigns || []).map((a) => (a.role_assigned as string | null) || null);

        servesAdoracion =
          [...involvedTeams].some((t) => adoracionTeamIds.has(t)) ||
          myRoles.some((r) => matchesArea(r, ADORACION_AREA_TERMS));
        servesEscuela =
          [...involvedTeams].some((t) => escuelaTeamIds.has(t)) ||
          myRoles.some((r) => matchesArea(r, ESCUELA_AREA_TERMS));
      }

      // El SuperAdmin siempre entra a una iglesia: usa la guardada en
      // localStorage, la del subdominio por el que entró o la primera
      // disponible. A él no le aplica la restricción "no entrar por URL".
      const savedOrgId = typeof window !== "undefined" ? localStorage.getItem("selected_org_id") : null;
      const superTarget = availableOrgs.find((o) => o.id === savedOrgId) || organizationFromHost || availableOrgs[0] || null;

      if (currentRole === "superadmin") {
        setOrg(superTarget);
        if (superTarget && typeof window !== "undefined" && savedOrgId !== superTarget.id) {
          localStorage.setItem("selected_org_id", superTarget.id);
        }
      } else if (finalUserOrgId) {
        const found = availableOrgs.find((o) => o.id === finalUserOrgId);
        // Un usuario no puede entrar a otra iglesia usando únicamente su URL.
        setOrg(organizationFromHost && found?.id !== organizationFromHost.id ? null : found || null);
      } else {
        setOrg(null); // No se asigna ninguna iglesia si el usuario no tiene una
      }

      // 2c. Visibilidad "pública" de los módulos: si la iglesia activó verlos,
      //     cualquier miembro autenticado los ve (en modo lectura). La gestión
      //     sigue siendo del ministerio (líderes + quienes sirven ahí).
      const effectiveOrgId = currentRole === "superadmin" ? superTarget?.id : finalUserOrgId;
      const effectiveOrg = availableOrgs.find((o) => o.id === (effectiveOrgId || ""));
      const publicAdoracion = !isModuleLeader && Boolean(finalUserOrgId) && effectiveOrg?.public_adoracion !== false;
      const publicEscuela = !isModuleLeader && Boolean(finalUserOrgId) && effectiveOrg?.public_escuela !== false;
      setCanSeeAdoracion(isModuleLeader || servesAdoracion || publicAdoracion);
      setCanSeeEscuela(isModuleLeader || servesEscuela || publicEscuela);
      setCanManageEscuela(isModuleLeader || servesEscuela);

    } catch (err) {
      console.error("Error al obtener organización:", err);
      setOrg(null);
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- inicializa la sesión y organización al montar
    loadData();
  }, [loadData]);

  // Re-evalúa la sesión/papel cada vez que haya cambios de autenticación
  // (login, logout, refresh de token, datos del usuario) o cuando la ventana
  // recupera el foco. Así, al cambiar de usuario o de rol, la interfaz se
  // actualiza sin obligar a recargar la página.
  const refresh = useCallback(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        refresh();
      }
    });
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      subscription.subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const switchOrganization = (orgId: string) => {
    const target = allOrgs.find((o) => o.id === orgId);
    if (target) {
      setOrg(target);
      if (typeof window !== "undefined") {
        localStorage.setItem("selected_org_id", target.id);
      }
    }
  };

  return (
    <OrganizationContext.Provider
      value={{ org, allOrgs, userRole, userProfile, loading, canSeeAdoracion, canSeeEscuela, canManageEscuela, switchOrganization, refresh }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export const useOrganization = () => useContext(OrganizationContext);
