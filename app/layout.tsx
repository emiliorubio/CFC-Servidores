"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { usePathname, useRouter } from "next/navigation";
import { OrganizationProvider, useOrganization } from "@/context/OrganizationContext";
import "./globals.css";

function LayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { org, userRole, loading: orgLoading } = useOrganization();

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);

      if (session?.user) {
        const { data } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", session.user.id)
          .maybeSingle();

        setProfile(data);
      }
      setAuthLoading(false);
    };

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        const { data } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", session.user.id)
          .maybeSingle();

        setProfile(data);
      } else {
        setProfile(null);
      }
      setAuthLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const displayName = profile?.full_name || user?.email;
  const isAdmin = userRole === "admin" || userRole === "superadmin";
  const isLiderOrAdmin = isAdmin || userRole === "lider";

  // Formateador preciso de Rol
  const formatRole = (role?: string) => {
    const activeRole = role || userRole;
    if (!activeRole) return "Servidor";
    const cleanRole = activeRole.toLowerCase().trim();
    if (cleanRole === "admin" || cleanRole === "superadmin" || cleanRole === "pastor") return "Pastor / Admin";
    if (cleanRole === "lider" || cleanRole === "líder") return "Líder";
    if (cleanRole === "coordinador") return "Coordinador";
    return "Servidor";
  };

  const roleName = formatRole(profile?.role);

  // La pantalla de acceso debe estar disponible aunque la carga de la
  // organización falle o todavía no haya una sesión iniciada.
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // Estado 1: Cargando datos
  if (orgLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-medium">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-400">Cargando plataforma...</p>
        </div>
      </div>
    );
  }

  // Estado 2: Usuario autenticado pero sin iglesia asignada (Protección de privacidad)
  if (user && !org) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md text-center space-y-4 border border-slate-200">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto text-2xl font-bold">
            ⚠️
          </div>
          <h2 className="text-xl font-bold text-slate-800">Cuenta sin Iglesia Asignada</h2>
          <p className="text-sm text-slate-600">
            Tu usuario no está vinculado a ninguna organización en el sistema. Contacta al administrador para que active tu cuenta.
          </p>
          <button
            onClick={handleSignOut}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl text-sm font-bold transition-colors"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  // Estado 3: Aplicación con Identidad Visual Propia de la Iglesia
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 antialiased">
      
      {/* ENCABEZADO PERSONALIZADO CON COLORES Y LOGO DE LA IGLESIA */}
      <header
        style={{ backgroundColor: org?.secondary_color || "#0F172A" }}
        className="text-white shadow-lg border-b border-slate-800 transition-colors duration-300"
      >
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex flex-col sm:flex-row justify-between items-center gap-4">
          
          {/* Logo y Nombre Oficial de la Iglesia */}
          <Link href="/" className="flex items-center gap-3.5 group">
            <div className="relative w-11 h-11 bg-slate-950/50 p-1 rounded-2xl border border-white/10 flex items-center justify-center shadow-inner overflow-hidden">
              {org?.logo_url ? (
                <img
                  src={org.logo_url}
                  alt={org.name}
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <Image
                  src="/logo.png"
                  alt="Logo"
                  width={34}
                  height={34}
                  className="object-contain filter brightness-0 invert"
                />
              )}
            </div>

            <div className="flex flex-col">
              <h1 className="text-base font-extrabold tracking-wide leading-tight text-white group-hover:text-amber-400 transition-colors">
                {org?.name || "Plataforma de Organización"}
              </h1>
              <p className="text-[11px] text-slate-300 font-medium tracking-wider uppercase">
                Plataforma de Organización & Servidores
              </p>
            </div>
          </Link>

          {/* Menú Usuario / Sesión */}
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3 text-right">
                <div className="hidden sm:block">
                  <p className="text-xs font-bold text-slate-100">{displayName}</p>
                  <p className="text-[10px] text-amber-400 uppercase font-bold tracking-wider">
                    📍 {org?.name} <span className="text-slate-400">|</span> {roleName}
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-3.5 py-1.5 rounded-xl transition-all font-semibold shadow-sm hover:shadow-rose-900/30"
                >
                  Salir
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl border border-indigo-500 transition-all shadow-sm"
              >
                Iniciar Sesión
              </Link>
            )}
          </div>

        </div>

        {/* NAVEGACIÓN DINÁMICA */}
        <nav className="bg-black/30 px-4 border-t border-white/10">
          <div className="max-w-7xl mx-auto flex items-center space-x-8 overflow-x-auto py-2.5 text-xs font-semibold tracking-wide">
            
            <Link href="/" className="text-slate-200 hover:text-amber-400 whitespace-nowrap transition-colors">
              Inicio / Cronograma
            </Link>

            <Link href="/servidores" className="text-slate-200 hover:text-amber-400 whitespace-nowrap transition-colors">
              Servidores & Inscripción
            </Link>

            {isLiderOrAdmin && (
              <>
                <Link href="/adoracion" className="text-slate-200 hover:text-amber-400 whitespace-nowrap transition-colors">
                  Equipo de Adoración
                </Link>
                <Link href="/escuela-dominical" className="text-slate-200 hover:text-amber-400 whitespace-nowrap transition-colors">
                  Escuela Dominical
                </Link>
              </>
            )}

            {isAdmin && (
              <Link
                href="/configuracion"
                className="text-amber-300 hover:text-amber-200 font-bold whitespace-nowrap transition-colors bg-white/10 px-2.5 py-1 rounded-lg border border-white/10"
              >
                ⚙️ Configurar Iglesia
              </Link>
            )}

          </div>
        </nav>
      </header>

      {/* CONTENIDO PRINCIPAL DE LA PÁGINA */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">{children}</main>

      {/* PIE DE PÁGINA */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        © 2026 {org?.name || "Centro de Formación Cristiana"}. Desarrollado para la edificación del cuerpo de Cristo.
      </footer>
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <OrganizationProvider>
          <LayoutContent>{children}</LayoutContent>
        </OrganizationProvider>
      </body>
    </html>
  );
}
