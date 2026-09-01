"use client";

import { useState, useEffect } from "react";
import { useOrganization } from "@/context/OrganizationContext";
import { supabase } from "@/lib/supabase";
import RestrictedAccess from "@/components/RestrictedAccess";

interface MinistryTeam {
  id: string;
  name: string;
  role_needed: string;
}

export default function ConfiguracionPage() {
  const { org, userRole, loading: orgLoading } = useOrganization();

  const [name, setName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#4F46E5");
  const [secondaryColor, setSecondaryColor] = useState("#0F172A");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [teams, setTeams] = useState<MinistryTeam[]>([]);
  const [teamName, setTeamName] = useState("");
  const [teamRole, setTeamRole] = useState("Servidor");
  const [savingTeam, setSavingTeam] = useState(false);

  useEffect(() => {
    if (org) {
      setName(org.name || "");
      setPrimaryColor(org.primary_color || "#4F46E5");
      setSecondaryColor(org.secondary_color || "#0F172A");
      setLogoUrl(org.logo_url || "");
    }
  }, [org]);

  useEffect(() => {
    if (org?.id) loadTeams(org.id);
    else setTeams([]);
  }, [org?.id]);

  const loadTeams = async (organizationId: string) => {
    const { data, error } = await supabase
      .from("ministry_teams")
      .select("id, name, role_needed")
      .eq("organization_id", organizationId)
      .order("name");

    if (error) {
      setMessage({ type: "error", text: "No se pudieron cargar los equipos: " + error.message });
      return;
    }
    setTeams(data || []);
  };

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org?.id || !teamName.trim()) return;

    setSavingTeam(true);
    setMessage(null);
    const { error } = await supabase.from("ministry_teams").insert({
      organization_id: org.id,
      name: teamName.trim(),
      role_needed: teamRole.trim() || "Servidor",
    });

    if (error) {
      setMessage({ type: "error", text: "No se pudo crear el equipo: " + error.message });
    } else {
      setTeamName("");
      setTeamRole("Servidor");
      await loadTeams(org.id);
      setMessage({ type: "success", text: "Equipo creado correctamente." });
    }
    setSavingTeam(false);
  };

  const handleDeleteTeam = async (team: MinistryTeam) => {
    if (!org?.id) return;
    const { error } = await supabase
      .from("ministry_teams")
      .delete()
      .eq("id", team.id)
      .eq("organization_id", org.id);

    if (error) {
      setMessage({ type: "error", text: "No se pudo eliminar el equipo: " + error.message });
      return;
    }
    await loadTeams(org.id);
  };

  // Función para subir logo a Supabase Storage
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setMessage(null);

      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      const fileExt = file.name.split(".").pop();
      const filePath = `${org?.slug || "default"}/logo.${fileExt}`;

      // Subir imagen al bucket 'organizations'
      const { error: uploadError } = await supabase.storage
        .from("organizations")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Obtener URL pública
      const { data } = supabase.storage.from("organizations").getPublicUrl(filePath);
      setLogoUrl(data.publicUrl);
      setMessage({ type: "success", text: "Logo subido correctamente (recuerda guardar cambios)." });
    } catch (error: any) {
      setMessage({ type: "error", text: "Error al subir logo: " + error.message });
    } finally {
      setUploading(false);
    }
  };

  // Guardar cambios en la base de datos
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org?.id) return;

    try {
      setSaving(true);
      setMessage(null);

      const { error } = await supabase
        .from("organizations")
        .update({
          name,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          logo_url: logoUrl,
        })
        .eq("id", org.id);

      if (error) throw error;

      setMessage({ type: "success", text: "¡Configuración de la iglesia actualizada con éxito!" });
      // Recargar la página para refrescar los estilos aplicados
      setTimeout(() => window.location.reload(), 1000);
    } catch (error: any) {
      setMessage({ type: "error", text: "Error al guardar: " + error.message });
    } finally {
      setSaving(false);
    }
  };

  if (orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600 font-medium">Cargando configuración...</p>
      </div>
    );
  }

  const isAdmin = userRole === "admin" || userRole === "superadmin";
  if (!isAdmin || !org) {
    return (
      <RestrictedAccess message="La configuración de la iglesia está disponible únicamente para administradores con una iglesia asignada." />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Encabezado */}
        <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-lg space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full">
            ADMINISTRACIÓN MULTI-TENANT
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">⚙️ Configuración de la Iglesia</h1>
          <p className="text-sm text-slate-300">
            Personaliza la identidad visual y datos principales de <strong>{org?.name}</strong>.
          </p>
        </div>

        {/* Mensajes de feedback */}
        {message && (
          <div
            className={`p-4 rounded-2xl text-sm font-semibold ${
              message.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-rose-50 border border-rose-200 text-rose-800"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Formulario de Configuración */}
        <form onSubmit={handleSave} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
          
          {/* Nombre de la Iglesia */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700">Nombre de la Organización / Iglesia</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
              required
            />
          </div>

          {/* Carga de Logo */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700">Logo Oficial</label>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-16 h-16 rounded-2xl object-cover border border-slate-200" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold border border-slate-200">
                  Sin Logo
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={uploading}
                className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              />
            </div>
            {uploading && <p className="text-xs text-indigo-600 font-medium">Subiendo imagen...</p>}
          </div>

          <hr className="border-slate-100" />

          {/* Personalización de Colores */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Color Primario */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">Color Primario (Acentos y Botones)</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-12 h-12 rounded-xl cursor-pointer border-0"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-sm uppercase"
                />
              </div>
            </div>

            {/* Color Secundario */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">Color Secundario (Encabezados/Navegación)</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-12 h-12 rounded-xl cursor-pointer border-0"
                />
                <input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-sm uppercase"
                />
              </div>
            </div>

          </div>

          {/* Botón Guardar */}
          <button
            type="submit"
            disabled={saving}
            style={{ backgroundColor: primaryColor }}
            className="w-full text-white font-bold py-3.5 px-4 rounded-xl shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "Guardando Cambios..." : "Guardar Configuración"}
          </button>

        </form>

        <section className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Áreas y equipos de servicio</h2>
            <p className="text-xs text-slate-500 mt-1">
              Estos equipos pertenecen solo a <strong>{org?.name}</strong> y se usan para las inscripciones.
            </p>
          </div>

          <form onSubmit={handleAddTeam} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3">
            <input
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder="Ej.: Ujieres"
              required
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
            />
            <input
              value={teamRole}
              onChange={(event) => setTeamRole(event.target.value)}
              placeholder="Rol requerido"
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
            />
            <button
              type="submit"
              disabled={savingTeam}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {savingTeam ? "Creando..." : "+ Agregar equipo"}
            </button>
          </form>

          {teams.length === 0 ? (
            <p className="rounded-xl bg-slate-50 border border-dashed border-slate-200 p-4 text-xs text-slate-500">
              Aún no hay equipos configurados.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {teams.map((team) => (
                <div key={team.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{team.name}</p>
                    <p className="text-[11px] text-slate-500">Rol: {team.role_needed}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteTeam(team)}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
