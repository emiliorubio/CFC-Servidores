"use client";

import { createContext, useContext, useEffect, useState } from "react";
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
}

export type UserRole = "superadmin" | "admin" | "lider" | "servidor";

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
  switchOrganization: (orgId: string) => void;
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
  switchOrganization: () => {},
});

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [org, setOrg] = useState<Organization | null>(null);
  const [allOrgs, setAllOrgs] = useState<Organization[]>([]);
  const [userRole, setUserRole] = useState<UserRole>("servidor");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // 1. Obtener sesión de usuario
      const { data: { session } } = await supabase.auth.getSession();

      // Cargar lista de iglesias para selector (solo accesible para SuperAdmin/Dev)
      const { data: orgsData, error: orgsError } = await supabase.from("organizations").select("*");
      if (orgsError) throw orgsError;
      const availableOrgs = orgsData || [];
      setAllOrgs(availableOrgs);

      const hostSlug = organizationSlugFromLocation();
      const organizationFromHost = hostSlug
        ? availableOrgs.find((organization) => organization.slug.toLowerCase() === hostSlug.toLowerCase()) || null
        : null;

      if (!session?.user) {
        // Un visitante ve la identidad de la iglesia indicada por su subdominio.
        setOrg(organizationFromHost);
        setUserProfile(null);
        setLoading(false);
        return;
      }

      // 2. Buscar perfil del usuario para obtener SU iglesia exacta
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id, role, full_name")
        .eq("id", session.user.id)
        .maybeSingle();

      const { data: member } = await supabase
        .from("church_members")
        .select("organization_id, role, full_name")
        .or(`user_id.eq.${session.user.id},id.eq.${session.user.id},email.eq.${session.user.email}`)
        .maybeSingle();

      const userOrgId = profile?.organization_id || member?.organization_id;
      const currentRole = (profile?.role || member?.role || "servidor") as UserRole;

      setUserRole(currentRole);
      setUserProfile({
        id: session.user.id,
        full_name: profile?.full_name || member?.full_name || session.user.user_metadata?.full_name || null,
        role: currentRole,
        organization_id: userOrgId || null,
      });

      // Si es SuperAdmin, le permitimos usar el selector de iglesia guardado en localStorage
      const savedOrgId = typeof window !== "undefined" ? localStorage.getItem("selected_org_id") : null;
      const targetOrgId = (currentRole === "superadmin" && savedOrgId) ? savedOrgId : userOrgId;

      if (targetOrgId) {
        const found = availableOrgs.find((o) => o.id === targetOrgId);
        // Un usuario no puede entrar a otra iglesia usando únicamente su URL.
        setOrg(organizationFromHost && found?.id !== organizationFromHost.id ? null : found || null);
      } else {
        setOrg(null); // No se asigna ninguna iglesia si el usuario no tiene una
      }

    } catch (err) {
      console.error("Error al obtener organización:", err);
      setOrg(null);
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  };

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
      value={{ org, allOrgs, userRole, userProfile, loading, switchOrganization }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export const useOrganization = () => useContext(OrganizationContext);
