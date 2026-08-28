"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const fetchSessionAndProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);

      if (session?.user) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, role, primary_branch_id, branches(name)")
          .eq("id", session.user.id)
          .maybeSingle();

        if (data) {
          setProfile(data);
        } else {
          setProfile({
            full_name: session.user.user_metadata?.full_name || session.user.email,
            role: "lider",
            branches: { name: "CFC Puente Alto" }
          });
        }
      }
    };

    fetchSessionAndProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, role, primary_branch_id, branches(name)")
          .eq("id", session.user.id)
          .maybeSingle();

        setProfile(data || {
          full_name: session.user.user_metadata?.full_name || session.user.email,
          role: "lider",
          branches: { name: "CFC Puente Alto" }
        });
      } else {
        setProfile(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const displayName = 
    profile?.full_name || 
    user?.user_metadata?.full_name || 
    user?.user_metadata?.name || 
    user?.email;

  const branchName = profile?.branches?.name || "CFC Puente Alto";
  const roleName = profile?.role || "Líder";

  return (
    <html lang="es">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-800 antialiased">
        {/* Header Principal */}
        <header className="bg-slate-900 text-white shadow-lg border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 py-3.5 flex flex-col sm:flex-row justify-between items-center gap-4">
            
            {/* BRANDING CON LOGO LIMPIO */}
            <Link href="/" className="flex items-center gap-3.5 group">
              <div className="relative w-11 h-11 bg-slate-950 p-1 rounded-full border border-slate-700/60 flex items-center justify-center transition-transform group-hover:scale-105 shadow-inner">
                <Image
                  src="/logo.png"
                  alt="Iglesia CFC Logo"
                  width={34}
                  height={34}
                  className="object-contain filter brightness-0 invert"
                />
              </div>

              <div className="flex flex-col">
                <h1 className="text-base font-extrabold tracking-wide leading-tight text-white group-hover:text-amber-400 transition-colors">
                  Centro de Formación Cristiana
                </h1>
                <p className="text-[11px] text-slate-400 font-medium tracking-wider uppercase">
                  Plataforma de Organización & Servidores
                </p>
              </div>
            </Link>

            {/* Estado de la Sesión y Usuario */}
            <div className="flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-3 text-right">
                  <div className="hidden sm:block">
                    <p className="text-xs font-bold text-slate-100">{displayName}</p>
                    <p className="text-[10px] text-amber-400 uppercase font-bold tracking-wider">
                      📍 {branchName} <span className="text-slate-500">|</span> {roleName}
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

          {/* Navegación Principal */}
          <nav className="bg-slate-950 px-4 border-t border-slate-800/80">
            <div className="max-w-7xl mx-auto flex space-x-8 overflow-x-auto py-2.5 text-xs font-semibold tracking-wide">
              <Link href="/" className="text-slate-300 hover:text-amber-400 whitespace-nowrap transition-colors">
                Inicio / Cronograma
              </Link>
              <Link href="/servidores" className="text-slate-300 hover:text-amber-400 whitespace-nowrap transition-colors">
                Servidores & Inscripción
              </Link>
              <Link href="/adoracion" className="text-slate-300 hover:text-amber-400 whitespace-nowrap transition-colors">
                Equipo de Adoración
              </Link>
              <Link href="/escuela-dominical" className="text-slate-300 hover:text-amber-400 whitespace-nowrap transition-colors">
                Escuela Dominical
              </Link>
            </div>
          </nav>
        </header>

        {/* Contenido Dinámico */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">{children}</main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
          © 2026 Centro de Formación Cristiana. Desarrollado para la edificación del cuerpo de Cristo.
        </footer>
      </body>
    </html>
  );
}