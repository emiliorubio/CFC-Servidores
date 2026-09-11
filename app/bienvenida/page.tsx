"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function BienvenidaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") || "recovery";

  const [resolviendo, setResolviendo] = useState(true);
  const [okToken, setOkToken] = useState(false);
  const [errorToken, setErrorToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [listo, setListo] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const resolver = async () => {
      if (!tokenHash) {
        // Quizás llegó con sesión ya abierta (enlace tipo fragmento).
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setOkToken(Boolean(session?.user));
        setResolviendo(false);
        return;
      }
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "recovery" | "invite",
      });
      if (error) {
        setErrorToken("El enlace no es válido o ya expiró. Pide uno nuevo desde '¿Olvidaste tu contraseña?'.");
      } else {
        setOkToken(true);
      }
      setResolviendo(false);
    };
    void resolver();
  }, [tokenHash, type]);

  const irAmiIglesia = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (userId) {
        const { data: perfil } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", userId)
          .maybeSingle();
        if (perfil?.organization_id) {
          const { data: orgRow } = await supabase
            .from("organizations")
            .select("slug")
            .eq("id", perfil.organization_id)
            .maybeSingle();
          const base = window.location.hostname.split(".").slice(1).join(".");
          if (orgRow?.slug && base) {
            window.location.href = `https://${orgRow.slug.replace(/-/g, "")}.${base}`;
            return;
          }
        }
      }
    } catch {
      // Sin datos de iglesia: se cae a la raíz y el login reenvía según la cuenta.
    }
    router.replace("/");
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setErrorMsg("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirm) {
      setErrorMsg("Las contraseñas no coinciden.");
      return;
    }
    setSaving(true);
    setErrorMsg("");
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setListo(true);
      window.setTimeout(() => {
        void irAmiIglesia();
      }, 1500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudo guardar la contraseña.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 space-y-6 border border-slate-200">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold text-slate-800">Mi Iglesia</h2>
          <p className="text-xs text-slate-500">Bienvenido a la plataforma</p>
        </div>

        {resolviendo && (
          <p className="text-sm text-slate-500 text-center py-6">Validando el enlace…</p>
        )}

        {!resolviendo && listo && (
          <div className="space-y-4 text-center py-4">
            <p className="text-sm font-bold text-emerald-700">✅ ¡Tu contraseña quedó lista!</p>
            <p className="text-xs text-slate-500">
              Te estamos llevando a la plataforma de tu iglesia…
            </p>
            <button
              type="button"
              onClick={() => void irAmiIglesia()}
              className="block w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl text-sm text-center"
            >
              Entrar a mi iglesia
            </button>
          </div>
        )}

        {!resolviendo && errorToken && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {errorToken}
          </div>
        )}

        {!resolviendo && !errorToken && okToken && !listo && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Primera vez aquí: define la contraseña con la que entrarás a la plataforma de tu iglesia.
            </p>
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {errorMsg}
              </div>
            )}
            <form onSubmit={guardar} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nueva contraseña</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Repite la contraseña</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Repite la contraseña"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-md transition-opacity text-sm disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar contraseña"}
              </button>
            </form>
          </div>
        )}

        {!resolviendo && !errorToken && !okToken && !listo && (
          <p className="text-xs text-slate-400 text-center py-4">
            Para crear tu contraseña usa el enlace que te enviamos por correo.
          </p>
        )}
      </div>
    </div>
  );
}