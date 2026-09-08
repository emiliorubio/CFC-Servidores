"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useOrganization } from "@/context/OrganizationContext";
import type { Organization } from "@/context/OrganizationContext";
import { supabase } from "@/lib/supabase";
import RestrictedAccess from "@/components/RestrictedAccess";

interface MinistryTeam {
  id: string;
  name: string;
  role_needed: string;
}

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function ConfigureOrgForm({ org }: { org: Organization }) {
  const [name, setName] = useState(org.name || "");
  const [primaryColor, setPrimaryColor] = useState(org.primary_color || "#4F46E5");
  const [secondaryColor, setSecondaryColor] = useState(org.secondary_color || "#0F172A");
  const [logoUrl, setLogoUrl] = useState(org.logo_url || "");
  const [address, setAddress] = useState(org.address || "");
  const [serviceTimes, setServiceTimes] = useState(org.service_times || "");
  const [contactPhone, setContactPhone] = useState(org.contact_phone || "");
  const [pattern, setPattern] = useState<{ weekday: number; time: string }[]>(
    Array.isArray(org.service_pattern) ? [...org.service_pattern] : []
  );
  const [signupVisible, setSignupVisible] = useState(org.signup_visible ?? true);
  const [newWeekday, setNewWeekday] = useState(org.service_pattern?.[0]?.weekday ?? 0);
  const [newTime, setNewTime] = useState(org.service_pattern?.[0]?.time?.slice(0, 5) ?? "19:00");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [teams, setTeams] = useState<MinistryTeam[]>([]);
  const [teamName, setTeamName] = useState("");
  const [teamRole, setTeamRole] = useState("Servidor");
  const [savingTeam, setSavingTeam] = useState(false);

  const loadTeams = useCallback(async () => {
    const { data, error } = await supabase
      .from("ministry_teams")
      .select("id, name, role_needed")
      .eq("organization_id", org.id)
      .order("name");

    if (error) {
      setMessage({ type: "error", text: "No se pudieron cargar los equipos: " + error.message });
      return;
    }
    setTeams(data || []);
  }, [org.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de equipos al montar
    loadTeams();
  }, [loadTeams]);

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;

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
      await loadTeams();
      setMessage({ type: "success", text: "Equipo creado correctamente." });
    }
    setSavingTeam(false);
  };

  const handleDeleteTeam = async (team: MinistryTeam) => {
    const { error } = await supabase
      .from("ministry_teams")
      .delete()
      .eq("id", team.id)
      .eq("organization_id", org.id);

    if (error) {
      setMessage({ type: "error", text: "No se pudo eliminar el equipo: " + error.message });
      return;
    }
    await loadTeams();
  };

  // Función para subir logo a Supabase Storage
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setMessage(null);

      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      const fileExt = file.name.split(".").pop();
      const filePath = `${org.slug || "default"}/logo.${fileExt}`;

      // Subir imagen al bucket 'organizations'
      const { error: uploadError } = await supabase.storage
        .from("organizations")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Obtener URL pública
      const { data } = supabase.storage.from("organizations").getPublicUrl(filePath);
      setLogoUrl(data.publicUrl);
      setMessage({ type: "success", text: "Logo subido correctamente (recuerda guardar cambios)." });
    } catch (error) {
      setMessage({ type: "error", text: "Error al subir logo: " + errorMessage(error) });
    } finally {
      setUploading(false);
    }
  };

  const handleAddSlot = () => {
    if (!newTime) return;
    if (!DAY_NAMES[newWeekday]) return;
    setPattern((prev) =>
      [...prev.filter((s) => s.weekday !== newWeekday), { weekday: newWeekday, time: newTime }].sort(
        (a, b) => a.weekday - b.weekday
      )
    );
  };

  const handleRemoveSlot = (weekday: number) =>
    setPattern((prev) => prev.filter((s) => s.weekday !== weekday));

  // Guardar cambios en la base de datos
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

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
          address: address.trim() || null,
          service_times: serviceTimes.trim() || null,
          contact_phone: contactPhone.trim() || null,
          service_pattern: pattern,
          signup_visible: signupVisible,
        })
        .eq("id", org.id);

      if (error) throw error;

      setMessage({ type: "success", text: "¡Configuración de la iglesia actualizada con éxito!" });
      // Recargar la página para refrescar los estilos aplicados
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      setMessage({ type: "error", text: "Error al guardar: " + errorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

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
            Personaliza la identidad visual y datos principales de <strong>{org.name}</strong>.
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
                <Image src={logoUrl} alt="Logo" width={64} height={64} unoptimized className="w-16 h-16 rounded-2xl object-cover border border-slate-200" />
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

          {/* Registro abierto */}
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-sm font-bold text-slate-800">Registro abierto para nuevas personas</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Si está activo, cualquiera puede crear una cuenta eligiendo esta iglesia desde /login.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={signupVisible}
              onClick={() => setSignupVisible((value) => !value)}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                signupVisible ? "bg-emerald-500" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  signupVisible ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <hr className="border-slate-100" />

          {/* Datos de contacto para la bienvenida por WhatsApp */}
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Datos para la bienvenida por WhatsApp</h2>
              <p className="text-xs text-slate-500 mt-1">
                Se usan en el mensaje que el equipo de consolidación envía a los nuevos.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Dirección</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ej.: Av. Los Pajaritos 1234, Puente Alto"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Horarios de culto</label>
                <input
                  type="text"
                  value={serviceTimes}
                  onChange={(e) => setServiceTimes(e.target.value)}
                  placeholder="Ej.: Dom 10:30 y 18:00 hrs"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">WhatsApp de contacto</label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Ej.: +56 9 5555 5555"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Horarios de culto (alimentan "Gén. Cultos") */}
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Horarios de culto</h2>
              <p className="text-xs text-slate-500 mt-1">
                Son los que usa <strong>&ldquo;⚡ Gén. Cultos 1 mes&rdquo;</strong> en el inicio. Un horario por día; si repites un
                día se reemplaza.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Día</label>
                <select
                  value={newWeekday}
                  onChange={(event) => setNewWeekday(Number(event.target.value))}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800"
                >
                  {DAY_NAMES.map((day, idx) => (
                    <option key={day} value={idx}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Hora (Chile)</label>
                <input
                  type="time"
                  value={newTime}
                  onChange={(event) => setNewTime(event.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800"
                />
              </div>
              <button
                type="button"
                onClick={handleAddSlot}
                disabled={!newTime}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
              >
                + Agregar horario
              </button>
            </div>

            {pattern.length === 0 ? (
              <p className="rounded-xl bg-slate-50 border border-dashed border-slate-200 p-4 text-xs text-slate-500">
                No hay horarios configurados.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {pattern.map((slot) => (
                  <div
                    key={slot.weekday}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-800">{DAY_NAMES[slot.weekday]}</p>
                      <p className="text-[11px] text-slate-500">⏰ {slot.time} hrs</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSlot(slot.weekday)}
                      className="text-xs font-bold text-rose-600 hover:text-rose-700"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}
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
              Estos equipos pertenecen solo a <strong>{org.name}</strong> y se usan para las inscripciones.
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

function SuperadminNewOrg() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#4F46E5");
  const [secondaryColor, setSecondaryColor] = useState("#0F172A");
  const [signupVisible, setSignupVisible] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const normalizeSlug = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalSlug = normalizeSlug(slug || name);
    if (!name.trim() || !finalSlug) {
      setMessage({ type: "error", text: "Indica el nombre de la iglesia." });
      return;
    }
    setCreating(true);
    setMessage(null);

    const { data: dup } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", finalSlug)
      .maybeSingle();
    if (dup) {
      setMessage({ type: "error", text: `Ya existe una iglesia con el slug "${finalSlug}".` });
      setCreating(false);
      return;
    }

    const { error } = await supabase.from("organizations").insert({
      name: name.trim(),
      slug: finalSlug,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      signup_visible: signupVisible,
      service_pattern: [],
      plan: "free",
      active_modules: {},
    });
    setCreating(false);

    if (error) {
      setMessage({ type: "error", text: "No se pudo crear la iglesia: " + error.message });
      return;
    }
    setMessage({
      type: "success",
      text: `Iglesia "${name.trim()}" creada con slug "${finalSlug}". Refresca la página para verla en el selector.`,
    });
    setName("");
    setSlug("");
  };

  return (
    <section className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-800">➕ Nueva iglesia (Superadmin)</h2>
        <p className="text-xs text-slate-500 mt-1">
          Crea una organización nueva en la plataforma. Luego se puede entrar desde su subdominio
          (<code className="text-indigo-600 font-semibold">tu-slug.miiglesia.cl</code>) y configurar
          horarios, colores y registro.
        </p>
      </div>

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

      <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-700">Nombre de la iglesia</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej.: CFC Nueva Vida"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-700">Slug (subdominio)</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            onBlur={() => setSlug(normalizeSlug(slug || name))}
            placeholder="Ej.: cfc-nueva-vida"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800"
          />
          <p className="text-[11px] text-slate-500">Déjalo vacío para generarlo desde el nombre.</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-700">Color primario</label>
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

        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-700">Color secundario</label>
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

        <div className="md:col-span-2 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-sm font-bold text-slate-800">Registro abierto desde el inicio</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Permite que nuevas personas se registren en esta iglesia desde el inicio.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={signupVisible}
            onClick={() => setSignupVisible((v) => !v)}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
              signupVisible ? "bg-emerald-500" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                signupVisible ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={creating}
            className="w-full text-white font-bold py-3 px-4 rounded-xl shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
          >
            {creating ? "Creando iglesia..." : "Crear iglesia"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default function ConfiguracionPage() {
  const { org, userRole, loading: orgLoading } = useOrganization();

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
        <ConfigureOrgForm key={org.id} org={org} />
        {userRole === "superadmin" && <SuperadminNewOrg />}
      </div>
    </div>
  );
}