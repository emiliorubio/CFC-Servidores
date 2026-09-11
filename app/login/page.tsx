"use client";

import { useState } from "react";
import { useOrganization } from "@/context/OrganizationContext";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const { org, allOrgs, loading: orgLoading } = useOrganization();

  const [isRegister, setIsRegister] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("mode") === "register"
  );
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [requestedRole, setRequestedRole] = useState("servidor");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // ¿La navegación llegó por el subdominio de una iglesia? El registro solo es
  // posible a través del enlace propio de cada congregación y NUNCA se da a
  // escoger otra: la iglesia queda fijada a ese subdominio.
  const enSubdominio = (() => {
    if (typeof window === "undefined") return false;
    const hostname = window.location.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return Boolean(new URLSearchParams(window.location.search).get("org"));
    }
    const [subdomain] = hostname.split(".");
    return Boolean(subdomain && subdomain !== "www");
  })();

  const puedeRegistrar = enSubdominio;

  // En el dominio raíz (miiglesia.cl) el acceso queda reservado al superadmin:
  // la pestaña de registro no existe y cualquier ?mode=register se ignora.
  const modeRegistro = puedeRegistrar && isRegister;

  const registerOrg = org && org.id ? org : null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      if (modeRegistro) {
        if (!registerOrg) {
          throw new Error("Regístrate desde el enlace de tu iglesia.");
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
      }

      // Iniciar Sesión
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) throw loginError;

      // El enlace raíz es del superadmin: cualquier otra cuenta es redirigida
      // al enlace de su propia iglesia para operar dentro de ella.
      if (!enSubdominio && typeof window !== "undefined") {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id, role")
            .eq("id", session.user.id)
            .maybeSingle();

          if (profile && profile.role !== "superadmin" && profile.organization_id) {
            const suIglesia = allOrgs.find((o) => o.id === profile.organization_id);
            const base = window.location.hostname.split(".").slice(1).join(".");
            if (suIglesia && base) {
              window.location.href = `https://${suIglesia.slug.replace(/-/g, "")}.${base}`;
              return;
            }
          }
        }
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
            {registerOrg?.name || (enSubdominio ? "Esta iglesia" : "MiIglesia · CFC")}
          </h2>
          <p className="text-xs text-slate-500">
            {modeRegistro
              ? "Crea tu cuenta e indica tu rol (" + (registerOrg?.name || "tu iglesia") + ")"
              : enSubdominio
                ? "Ingresa con tus credenciales"
                : "Acceso de administración de la plataforma"}
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setIsRegister(false)}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
              !modeRegistro ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Iniciar Sesión
          </button>
          {puedeRegistrar && (
            <button
              type="button"
              onClick={() => setIsRegister(true)}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                modeRegistro ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Registrarse
            </button>
          )}
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
          {modeRegistro && (
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
                {orgLoading ? (
                  <div className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-500 font-semibold">
                    Resolviendo tu iglesia…
                  </div>
                ) : registerOrg ? (
                  <div className="w-full px-4 py-3 text-sm rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 font-semibold flex items-center justify-between gap-2">
                    <span className="truncate">{registerOrg.name}</span>
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-emerald-600 bg-white rounded-full px-2 py-0.5">
                      Fijada por este enlace
                    </span>
                  </div>
                ) : (
                  <div className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-500 font-semibold">
                    Entra por el enlace de tu iglesia para registrarte.
                  </div>
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
            {modeRegistro && (
              <p className="text-[11px] text-slate-500 mt-1">Mínimo 8 caracteres.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-md transition-opacity text-sm mt-2"
          >
            {loading ? "Procesando..." : modeRegistro ? "Crear Mi Cuenta" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}