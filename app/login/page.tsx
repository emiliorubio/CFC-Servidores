"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const [isLoginMode, setIsLoginMode] = useState(true);

  // Campos de Formulario
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("servidor"); // Rol por defecto
  
  // Sedes
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  
  // Estados de interfaz
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Cargar sedes activas al entrar a la página
  useEffect(() => {
    const loadBranches = async () => {
      const { data, error } = await supabase.from("branches").select("id, name");
      if (error) {
        console.error("Error al cargar sedes:", error);
      } else if (data && data.length > 0) {
        setBranches(data);
        setSelectedBranch(data[0].id); // Selecciona la primera sede por defecto
      }
    };
    loadBranches();
  }, []);

  // Manejador de Inicio de Sesión
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage("Error al iniciar sesión: " + error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/servidores");
      router.refresh();
    }
  };

  // Manejador de Registro con Sede y Rol (Optimizado para Trigger de DB)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    if (!selectedBranch) {
      setErrorMessage("Por favor selecciona una sede válida.");
      setLoading(false);
      return;
    }

    // Registrar usuario en Auth enviando metadata completa para el Trigger
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role,
          primary_branch_id: selectedBranch,
        },
      },
    });

    if (error) {
      setErrorMessage("Error al registrar: " + error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      alert("¡Cuenta creada exitosamente!");
      router.push("/servidores");
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md space-y-6">
        
        {/* Pestañas para cambiar entre Iniciar Sesión y Registro */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => { setIsLoginMode(true); setErrorMessage(""); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              isLoginMode ? "bg-white text-indigo-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => { setIsLoginMode(false); setErrorMessage(""); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              !isLoginMode ? "bg-white text-indigo-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Registrarse
          </button>
        </div>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg">
            {errorMessage}
          </div>
        )}

        {/* Formulario de Inicio de Sesión */}
        {isLoginMode ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Correo Electrónico</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {loading ? "Entrando..." : "Ingresar"}
            </button>
          </form>
        ) : (
          /* Formulario de Registro */
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre Completo</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Tu Nombre y Apellido"
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Correo Electrónico</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Selector de Sedes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Selecciona tu Sede</label>
              {branches.length === 0 ? (
                <p className="text-xs text-amber-600">Cargando sedes...</p>
              ) : (
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Selector de Rol */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Rol / Función en la Iglesia</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="servidor">Servidor / Voluntario</option>
                <option value="lider">Líder de Área</option>
                <option value="admin">Pastor / Administrador</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading || branches.length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {loading ? "Creando Cuenta..." : "Registrarme"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}