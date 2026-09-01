"use client";

import { useState } from "react";
import { useOrganization } from "@/context/OrganizationContext";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const { org } = useOrganization();

  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      if (isRegister) {
        let activeOrgId = org?.id;

        // Si estamos en localhost y no hay org activa, buscamos la iglesia por defecto
        if (!activeOrgId) {
          const { data: defaultOrg } = await supabase
            .from("organizations")
            .select("id")
            .limit(1)
            .maybeSingle();

          activeOrgId = defaultOrg?.id;
        }

        if (!activeOrgId) {
          throw new Error("No hay iglesias registradas en la base de datos. Crea una en Supabase primero.");
        }

        // 1. Crear usuario en Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: "servidor",
              organization_id: activeOrgId,
            },
          },
        });

        if (authError) throw authError;

        if (authData.user) {
          // 2. Crear o actualizar perfil en la tabla 'profiles'
          const { error: profileError } = await supabase.from("profiles").upsert({
            id: authData.user.id,
            full_name: fullName,
            role: "servidor",
            organization_id: activeOrgId,
          });

          if (profileError) throw profileError;
        }
      } else {
        // Iniciar Sesión
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (loginError) throw loginError;
      }

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Ocurrió un error en la autenticación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 space-y-6 border border-slate-200">
        
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold text-slate-800">
            {org?.name || "Plataforma de Iglesia"}
          </h2>
          <p className="text-xs text-slate-500">
            {isRegister ? "Crea tu cuenta de voluntario / servidor" : "Ingresa con tus credenciales"}
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setIsRegister(false)}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
              !isRegister ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => setIsRegister(true)}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
              isRegister ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Registrarse
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Completo</label>
              <input
                type="text"
                required
                placeholder="Tu Nombre y Apellido"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Correo Electrónico</label>
            <input
              type="email"
              required
              placeholder="ejemplo@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Contraseña</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-md transition-opacity text-sm mt-2"
          >
            {loading ? "Procesando..." : isRegister ? "Crear Mi Cuenta" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
