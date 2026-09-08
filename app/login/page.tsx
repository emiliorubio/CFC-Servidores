"use client";

import { useState } from "react";
import { useOrganization } from "@/context/OrganizationContext";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const { org, allOrgs } = useOrganization();

  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [requestedRole, setRequestedRole] = useState("servidor");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const signupOrgs = allOrgs.filter((o) => o.signup_visible !== false);

  // En el dominio raíz (sin subdominio) cae en la primera iglesia habilitada.
  const registerOrg = selectedOrgId
    ? allOrgs.find((o) => o.id === selectedOrgId) || null
    : org || signupOrgs[0] || null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      if (isRegister) {
        if (!registerOrg) {
          throw new Error("Selecciona una iglesia para crear tu cuenta.");
        }

        const response = await fetch("/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName,
            email,
            password,
            orgSlug: registerOrg.slug,
            requestedRole,
          }),
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "No se pudo crear la cuenta.");
        }

        setIsRegister(false);
        setPassword("");
        setSuccessMsg(
          "Cuenta creada. Ya puedes iniciar sesión. Tu rol quedará como 'servidor' hasta que un administrador confirme tu rol."
        );
        return;
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
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Ocurrió un error en la autenticación");
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
            {isRegister ? "Crea tu cuenta e indica tu rol (" + (registerOrg?.name || "tu iglesia") + ")" : "Ingresa con tus credenciales"}
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

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {isRegister && (
            <>
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

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Iglesia</label>
                <select
                  value={registerOrg?.id || ""}
                  onChange={(e) => setSelectedOrgId(e.target.value || null)}
                  className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                >
                  {signupOrgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                {signupOrgs.length === 0 && (
                  <p className="text-[11px] text-amber-700 mt-1 font-semibold">
                    Aún no hay iglesias habilitadas para registrarse. Entra por el enlace de tu iglesia.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rol deseado</label>
                <select
                  value={requestedRole}
                  onChange={(e) => setRequestedRole(e.target.value)}
                  className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                >
                  <option value="servidor">Servidor / Voluntario</option>
                  <option value="lider">Líder</option>
                  <option value="coordinador">Coordinador</option>
                  <option value="pastor">Pastor</option>
                  <option value="admin">Administrador</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Un administrador de la iglesia confirma tu rol en la página de Usuarios. Por ahora entras como Servidor.
                </p>
              </div>
            </>
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
              minLength={8}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            {isRegister && (
              <p className="text-[11px] text-slate-500 mt-1">Mínimo 8 caracteres.</p>
            )}
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
