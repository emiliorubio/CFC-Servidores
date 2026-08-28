"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
        // Consultar el perfil incluyendo el nombre de la sede
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, role, primary_branch_id, branches(name)")
          .eq("id", session.user.id)
          .maybeSingle();

        if (data) {
          setProfile(data);
        } else {
          // Valores por defecto en caso de no encontrar registro en profiles
          setProfile({
            full_name: session.user.user_metadata?.full_name || session.user.email,
            role: "lider",
            branches: { name: "CFC Puente Alto" }
          });
        }
      }
    };

    fetchSessionAndProfile();

    // Escuchar cambios de autenticación
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

  // Prioridad del Nombre
  const displayName = 
    profile?.full_name || 
    user?.user_metadata?.full_name || 
    user?.user_metadata?.name || 
    user?.email;

  // Sede y Rol con respaldo directo
  const branchName = profile?.branches?.name || "CFC Puente Alto";
  const roleName = profile?.role || "Líder";

  return (
    <html lang="es">
      <body className="min-h-screen flex flex-col bg-slate-50">
        {/* Header Principal */}
        <header className="bg-indigo-900 text-white shadow-md">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-wide">Centro Formacion Cristiano</h1>
              <p className="text-xs text-indigo-200">Plataforma de Organización & Servidores</p>
            </div>

            {/* Estado de la Sesión y Usuario */}
            <div className="flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <p className="text-xs font-bold text-white">{displayName}</p>
                    <p className="text-[10px] text-indigo-200 uppercase font-semibold">
                      📍 {branchName} | {roleName}
                    </p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-medium"
                  >
                    Salir
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold px-4 py-2 rounded-lg border border-indigo-600 transition-colors"
                >
                  Iniciar Sesión
                </Link>
              )}
            </div>
          </div>

          {/* Navegación Principal */}
          <nav className="bg-indigo-950 px-4 border-t border-indigo-800">
            <div className="max-w-7xl mx-auto flex space-x-6 overflow-x-auto py-3 text-sm font-medium">
              <Link href="/" className="text-white hover:text-indigo-300 whitespace-nowrap">
                Inicio / Cronograma
              </Link>
              <Link href="/servidores" className="text-indigo-200 hover:text-white whitespace-nowrap">
                Servidores & Inscripción
              </Link>
              <Link href="/adoracion" className="text-indigo-200 hover:text-white whitespace-nowrap">
                Equipo de Adoración
              </Link>
              <Link href="/escuela-dominical" className="text-indigo-200 hover:text-white whitespace-nowrap">
                Escuela Dominical
              </Link>
            </div>
          </nav>
        </header>

        {/* Contenido Dinámico */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">{children}</main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
          © 2026 CFC Organizador. Desarrollado para la edificación del cuerpo de Cristo.
        </footer>
      </body>
    </html>
  );
}