"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/context/OrganizationContext";
import { formatearFechaCulto, horaCulto } from "@/lib/format";
import RestrictedAccess from "@/components/RestrictedAccess";
import PlanDisabled from "@/components/PlanDisabled";
import { moduloActivo } from "@/lib/plans";

// Roles específicos del Ministerio de Adoración
const ADORACION_ROLES = [
  "Voz / Cantante",
  "Director de Alabanza",
  "Guitarra Acústica",
  "Guitarra Eléctrica",
  "Bajo",
  "Batería",
  "Teclado / Piano",
  "Secuencias / Multitracks",
  "Sonido / FOH",
  "Plataforma / Apoyo",
] as const;

interface AdoracionCulto {
  id: string;
  title?: string | null;
  service_type?: string | null;
  service_date?: string | null;
  date?: string | null;
  time?: string | null;
  start_time?: string | null;
  service_time?: string | null;
}

interface AdoracionProfile {
  id: string;
  full_name: string | null;
  role: string | null;
}

interface AdoracionMember {
  id: string;
  full_name: string | null;
  role?: string | null;
  team_id?: string | null;
}

interface AdoracionAssignment {
  id: string;
  service_id?: string | null;
  team_id?: string | null;
  user_id?: string | null;
  member_id?: string | null;
  manual_name?: string | null;
  role_assigned?: string | null;
  organization_id: string | null;
  profiles?: { full_name: string } | null;
  service_schedule_id?: string | null;
  profile_id?: string | null;
  user_name?: string | null;
  area?: string | null;
}

interface AdoracionSong {
  id: string;
  service_schedule_id: string;
  organization_id: string;
  title: string;
  artist?: string | null;
  key_note?: string | null;
  song_url?: string | null;
  posicion?: number;
  created_at?: string;
}

function cultoDetalle(culto: AdoracionCulto) {
  const raw = culto.service_date || culto.date || null;
  let hora = horaCulto(raw).replace(/\s?hrs$/, "");
  const explicit = culto.time || culto.start_time || culto.service_time;
  if (!hora && explicit) hora = explicit.slice(0, 5);
  return { fecha: formatearFechaCulto(raw), hora };
}

export default function AdoracionPage() {
  const { org, userProfile, userRole, loading: orgLoading, canSeeAdoracion } = useOrganization();
  const [loading, setLoading] = useState(true);

  // Datos base
  const [servidores, setServidores] = useState<AdoracionProfile[]>([]);
  const [churchMembers, setChurchMembers] = useState<AdoracionMember[]>([]);
  const [cultos, setCultos] = useState<AdoracionCulto[]>([]);
  const [assignments, setAssignments] = useState<AdoracionAssignment[]>([]);

  // ID del equipo de Adoración
  const [adoracionTeamId, setAdoracionTeamId] = useState<string>("");

  // Formulario Registro Manual de Músico/Cantante
  const [manualName, setManualName] = useState("");
  const [manualInstrument, setManualInstrument] = useState<string>(ADORACION_ROLES[0]);
  const [manualCultoId, setManualCultoId] = useState("");

  // Auto-inscripción (Músico/Cantante App)
  const [selfCultoId, setSelfCultoId] = useState("");
  const [selfInstrument, setSelfInstrument] = useState<string>(ADORACION_ROLES[0]);

  // Gestión de Setlist (Canciones) por Culto
  const [selectedCultoForSetlist, setSelectedCultoForSetlist] = useState<string>("");
  const [songTitle, setSongTitle] = useState("");
  const [songArtist, setSongArtist] = useState("");
  const [songKey, setSongKey] = useState("");
  const [songUrl, setSongUrl] = useState("");
  const [setlists, setSetlists] = useState<Record<string, AdoracionSong[]>>({});

  // Add rápido en el próximo culto
  const [quickTitle, setQuickTitle] = useState("");
  const [quickArtist, setQuickArtist] = useState("");
  const [quickKey, setQuickKey] = useState("");

  // Momento de carga para calcular el "próximo culto" (evita Date.now() en render)
  const [now, setNow] = useState(0);

  const loadAllData = useCallback(async () => {
    if (!org?.id) return;

    setNow(Date.now());

    // 3. Obtener/Identificar ID del Equipo de Adoración
    const { data: tData } = await supabase
      .from("ministry_teams")
      .select("id, name")
      .eq("organization_id", org.id);
    if (tData) {
      const adoTeam = tData.find((t) =>
        t.name.toLowerCase().includes("adorac") ||
        t.name.toLowerCase().includes("alabanz") ||
        t.name.toLowerCase().includes("músic")
      );
      setAdoracionTeamId(adoTeam ? adoTeam.id : tData[0]?.id || "");
    }

    // 4. Cultos
    const { data: serviceData } = await supabase
      .from("service_schedules")
      .select("*")
      .eq("organization_id", org.id)
      .order("service_date", { ascending: true });

    if (serviceData) {
      const branchCultos = serviceData;
      setCultos(branchCultos);

      if (branchCultos.length > 0) {
        setSelfCultoId(branchCultos[0].id);
        setManualCultoId(branchCultos[0].id);
        setSelectedCultoForSetlist(branchCultos[0].id);
      }
    }

    // 5. Integrantes
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("organization_id", org.id);
    if (allProfiles) setServidores(allProfiles as AdoracionProfile[]);

    const { data: membersData } = await supabase
      .from("church_members")
      .select("id, full_name, role, team_id")
      .eq("organization_id", org.id);
    if (membersData) setChurchMembers(membersData as AdoracionMember[]);

    // 6. Asignaciones de la Banda
    const { data: assignData } = await supabase
      .from("service_assignments")
      .select("*, profiles(full_name)")
      .eq("organization_id", org.id);
    if (assignData) {
      setAssignments(assignData.map((assignment: AdoracionAssignment) => ({
        ...assignment,
        service_schedule_id: assignment.service_id,
        profile_id: assignment.user_id,
        user_name: assignment.manual_name || assignment.profiles?.full_name,
        area: assignment.role_assigned,
      })));
    }

    // 7. Cargar Canciones / Setlist
    const serviceIds = (serviceData || []).map((service) => service.id);
    const { data: songsData } = serviceIds.length > 0
      ? await supabase.from("service_songs").select("*").eq("organization_id", org.id).in("service_schedule_id", serviceIds).order("posicion", { ascending: true }).order("created_at", { ascending: true })
      : { data: [] };
    if (songsData) {
      const grouped = songsData.reduce((acc: Record<string, AdoracionSong[]>, song: AdoracionSong) => {
        acc[song.service_schedule_id] = acc[song.service_schedule_id] || [];
        acc[song.service_schedule_id].push(song);
        return acc;
      }, {} as Record<string, AdoracionSong[]>);
      setSetlists(grouped);
    }

    setLoading(false);
  }, [org]);

  useEffect(() => {
    if (org?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del ministerio de adoración
      loadAllData();
    }
  }, [org?.id, loadAllData]);

  const isLiderOrAdmin = userRole === "lider" || userRole === "admin" || userRole === "superadmin";

  const isBanda = (a: AdoracionAssignment) =>
    a.team_id === adoracionTeamId ||
    a.area?.toLowerCase().includes("adorac") ||
    a.area?.toLowerCase().includes("alabanz") ||
    ADORACION_ROLES.some((r) => a.area?.includes(r));

  // Auto-agendarse en la Banda
  const handleSelfAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selfCultoId || !userProfile?.id || !org?.id) {
      alert("Selecciona un culto válido.");
      return;
    }

    // Evitar duplicados: no inscribirse dos veces al mismo culto y área.
    const { data: existing } = await supabase
      .from("service_assignments")
      .select("id")
      .eq("service_id", selfCultoId)
      .eq("user_id", userProfile.id)
      .eq("team_id", adoracionTeamId)
      .maybeSingle();
    if (existing) {
      alert("Ya estás inscrito/a en la alabanza de este culto. Si quieres cambiar tu instrumento, pídele al director que te reasigne.");
      return;
    }

    const payload = {
      service_id: selfCultoId,
      team_id: adoracionTeamId,
      user_id: userProfile.id,
      role_assigned: selfInstrument,
      organization_id: org.id,
    };

    const { error } = await supabase.from("service_assignments").insert(payload);
    if (error) {
      alert("Error al anotarte en la banda: " + error.message);
      return;
    }

    alert(`¡Confirmado! Servirás como [${selfInstrument}] en la alabanza.`);
    await loadAllData();
  };

  // Registrar Músico Manualmente (Para líderes)
  const handleAddManualServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualCultoId || !adoracionTeamId || !org?.id) {
      alert("Ingresa el nombre del integrante y el culto.");
      return;
    }

    const assignmentPayload = {
      service_id: manualCultoId,
      team_id: adoracionTeamId,
      manual_name: manualName.trim(),
      role_assigned: manualInstrument,
      organization_id: org.id,
    };

    const { error: assignErr } = await supabase.from("service_assignments").insert(assignmentPayload);

    if (assignErr) {
      alert("Error al programar al músico: " + assignErr.message);
      return;
    }

    alert(`${manualName} asignado/a como [${manualInstrument}] exitosamente.`);
    setManualName("");
    await loadAllData();
  };

  // Agregar canción genérica a un culto
  const addSong = async (
    cultoId: string,
    title: string,
    artist: string,
    keyNote: string,
    url: string
  ) => {
    if (!title.trim() || !cultoId || !org?.id) return "Escribe el nombre de la canción.";
    if (!cultos.some((c) => c.id === cultoId)) return "Culto no válido.";

    const songPayload = {
      service_schedule_id: cultoId,
      organization_id: org?.id,
      title: title.trim(),
      artist: artist.trim() || null,
      key_note: keyNote.trim() || null,
      song_url: url.trim() || null,
    };

    const { error } = await supabase.from("service_songs").insert(songPayload);
    if (error) return "Error al guardar la canción: " + error.message;

    await loadAllData();
    return null;
  };

  // Agregar Canción con todos los campos (Nombre, Cantante, Nota/Tono y Link)
  const handleAddSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!songTitle.trim() || !selectedCultoForSetlist || !org?.id) {
      alert("Escribe el nombre de la canción.");
      return;
    }

    const err = await addSong(selectedCultoForSetlist, songTitle, songArtist, songKey, songUrl);
    if (err) {
      alert(err);
      return;
    }

    alert("Canción agregada al repertorio.");
    setSongTitle("");
    setSongArtist("");
    setSongKey("");
    setSongUrl("");
  };

  // Add rápido desde el próximo culto
  const handleQuickAddSong = async () => {
    if (!nextCulto) return;
    const err = await addSong(nextCulto.id, quickTitle, quickArtist, quickKey, "");
    if (err) {
      alert(err);
      return;
    }
    setQuickTitle("");
    setQuickArtist("");
    setQuickKey("");
  };

  const handleRemoveSong = async (songId: string) => {
    if (!org?.id) return;
    const { error } = await supabase.from("service_songs").delete().eq("id", songId).eq("organization_id", org.id);
    if (!error) await loadAllData();
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!org?.id) return;
    const { error } = await supabase
      .from("service_assignments")
      .delete()
      .eq("id", assignmentId)
      .eq("organization_id", org.id);
    if (!error) {
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    }
  };

  // Subir / bajar una canción dentro del setlist de un culto
  const handleMoveSong = async (cultoId: string, songId: string, dir: -1 | 1) => {
    if (!org?.id) return;
    const list = [...(setlists[cultoId] || [])].sort(
      (a, b) => (a.posicion ?? 0) - (b.posicion ?? 0) || (a.created_at || "").localeCompare(b.created_at || "")
    );
    const idx = list.findIndex((s) => s.id === songId);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;
    const [moved] = list.splice(idx, 1);
    list.splice(swapIdx, 0, moved);
    await Promise.all(
      list.map((s, i) =>
        supabase.from("service_songs").update({ posicion: i + 1 }).eq("id", s.id).eq("organization_id", org.id)
      )
    );
    await loadAllData();
  };

  if (!orgLoading && org && !moduloActivo(org.plan, "adoracion")) {
    return <PlanDisabled modulo="Equipo de Adoración" />;
  }

  if (!orgLoading && (!canSeeAdoracion || !org)) {
    return (
      <RestrictedAccess message="El módulo de adoración está disponible para el equipo de alabanza (líderes, administradores y músicos/as con iglesia asignada)." />
    );
  }

  if (loading || orgLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600 font-medium animate-pulse">Cargando Ministerio de Adoración...</p>
      </div>
    );
  }

  const currentBranchName = org?.name || "tu iglesia";

  // Próximo culto (el más cercano futuro; si no hay, el último)
  const upcoming = cultos
    .filter((c) => new Date(c.service_date || c.date || "").getTime() >= now)
    .sort((a, b) => new Date(a.service_date || "").getTime() - new Date(b.service_date || "").getTime());
  const nextCulto = upcoming[0] || cultos[0] || null;

  const nameFor = (a: AdoracionAssignment) => {
    let personName = a.user_name;
    if (!personName) {
      if (a.profile_id === userProfile?.id) personName = userProfile?.full_name;
      else {
        const prof = servidores.find((s) => s.id === a.profile_id);
        const mem = churchMembers.find((m) => m.id === a.member_id);
        personName = prof?.full_name || mem?.full_name || "Servidor";
      }
    }
    return personName || "Servidor";
  };

  const bandOf = (cultoId: string) => assignments.filter((a) => a.service_schedule_id === cultoId && isBanda(a));

  // Roles del ministerio que aún no tienen músico confirmado para un culto
  const rolesFaltantes = (cultoId: string) => {
    const ocupados = bandOf(cultoId).map((a) => (a.area || "").replace("Adoración: ", "").trim());
    return ADORACION_ROLES.filter((rol) => !ocupados.some((o) => o === rol || o.includes(rol) || rol.includes(o)));
  };

  const totalSongs = Object.values(setlists).reduce((acc, list) => acc + list.length, 0);
  const totalBand = assignments.filter(isBanda).length;

  const buildAlineacionMessage = (culto: AdoracionCulto) => {
    const detail = cultoDetalle(culto);
    const band = bandOf(culto.id);
    const list = setlists[culto.id] || [];

    const lines = [
      `🎵 Alineación de Alabanza — ${currentBranchName}`,
      `🗓️ ${detail.fecha}${detail.hora ? ` — ${detail.hora} hrs` : ""}`,
    ];

    if (band.length > 0) {
      lines.push("", "👥 Banda confirmada:");
      band.forEach((m) => {
        lines.push(`  • ${nameFor(m)} — ${m.area?.replace("Adoración: ", "") || "Músico"}`);
      });
    } else {
      lines.push("", "👥 Aún sin músicos confirmados.");
    }

    if (list.length > 0) {
      lines.push("", "🎶 Setlist:");
      list.forEach((s, i) => {
        const artist = s.artist ? ` (${s.artist})` : "";
        const tono = s.key_note ? ` [Tono: ${s.key_note}]` : "";
        lines.push(`  ${i + 1}. ${s.title}${artist}${tono}`);
      });
    }

    const faltantes = rolesFaltantes(culto.id);
    if (faltantes.length > 0) {
      lines.push("", `⚠️ Faltan por confirmar: ${faltantes.join(", ")}`);
    }

    lines.push("", "¡Los esperamos!");
    return lines.join("\n");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ENCABEZADO */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-8 rounded-3xl shadow-lg space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full">
            MINISTERIO DE ADORACIÓN
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">🎵 Alabanza y Músicos</h1>
          <p className="text-sm text-indigo-100 max-w-2xl">
            Hola, <strong className="text-white">{userProfile?.full_name}</strong> — organiza la banda, los
            setlist y confirma a los músicos para {currentBranchName}.
          </p>
        </div>

        {/* KPIs */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Próximo culto</p>
            <p className="text-sm font-bold text-slate-800 mt-1">
              {nextCulto ? cultoDetalle(nextCulto).fecha : "Sin cultos"}
            </p>
            {nextCulto && cultoDetalle(nextCulto).hora && (
              <p className="text-xs font-semibold text-indigo-600 mt-0.5">⏰ {cultoDetalle(nextCulto).hora} hrs</p>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Banda confirmada</p>
            <p className="text-2xl font-extrabold text-purple-700 mt-1">{totalBand}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">músicos / cantantes</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Setlist en agenda</p>
            <p className="text-2xl font-extrabold text-indigo-700 mt-1">{totalSongs}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">canciones programadas</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cultos agendados</p>
            <p className="text-2xl font-extrabold text-slate-800 mt-1">{cultos.length}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">instancias listadas</p>
          </div>
        </section>

        {/* PRÓXIMO CULTO DESTACADO */}
        {nextCulto && (
          <section className="bg-white rounded-3xl p-6 border border-purple-200 shadow-md space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="w-11 h-11 flex items-center justify-center rounded-2xl bg-purple-600 text-white text-xl shadow-md">⭐</span>
                <div>
                  <h2 className="font-bold text-slate-800 text-lg">{nextCulto.title || nextCulto.service_type || "Culto"}</h2>
                  <p className="text-xs text-purple-700 font-semibold mt-0.5 capitalize">
                    🗓️ {cultoDetalle(nextCulto).fecha} {cultoDetalle(nextCulto).hora && `— ⏰ ${cultoDetalle(nextCulto).hora} hrs`}
                  </p>
                </div>
              </div>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(buildAlineacionMessage(nextCulto))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
              >
                📲 Compartir alineación por WhatsApp
              </a>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {/* Banda confirmada */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Banda confirmada:</p>
                {bandOf(nextCulto.id).length === 0 ? (
                  <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-center">
                    <p className="text-2xl mb-1">🎸</p>
                    <p className="text-xs text-amber-800 font-semibold">Aún no hay músicos inscritos para este culto.</p>
                    <p className="text-[11px] text-amber-700/80 mt-1">Anótate abajo o asigna músicos manualmente.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {bandOf(nextCulto.id).map((m) => (
                      <div key={m.id} className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-purple-600 font-bold">🎵</span>
                          <span className="font-semibold text-slate-800">{nameFor(m)}</span>
                          <span className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
                            {m.area?.replace("Adoración: ", "") || "Músico"}
                          </span>
                        </div>
                        {(isLiderOrAdmin || m.profile_id === userProfile?.id) && (
                          <button onClick={() => handleRemoveAssignment(m.id)} className="text-[10px] text-red-400 hover:text-red-300 font-bold">
                            Quitar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {rolesFaltantes(nextCulto.id).length > 0 && (
                  <div className="rounded-2xl bg-orange-50 border border-orange-200 p-3">
                    <p className="text-[11px] font-bold text-orange-800 uppercase tracking-wide mb-1.5">⚠️ Roles sin confirmar</p>
                    <div className="flex flex-wrap gap-1.5">
                      {rolesFaltantes(nextCulto.id).map((rol) => (
                        <span key={rol} className="text-[10px] font-semibold text-orange-800 bg-orange-100 border border-orange-200 rounded-lg px-2 py-0.5">
                          {rol}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Setlist del próximo culto */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Setlist de este culto:</p>
                {!setlists[nextCulto.id] || setlists[nextCulto.id].length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Sin canciones aún. Agrega la primera abajo.</p>
                ) : (
                  <div className="space-y-1.5">
                    {setlists[nextCulto.id].map((song, idx) => (
                      <div key={song.id} className="flex justify-between items-center text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-800">
                            {idx + 1}. {song.title} {song.artist && <span className="text-slate-400 font-normal">({song.artist})</span>}
                          </p>
                          {song.key_note && (
                            <span className="inline-block text-[10px] font-mono bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md">
                              Tono: {song.key_note}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {isLiderOrAdmin && (
                            <>
                              <button
                                onClick={() => handleMoveSong(nextCulto.id, song.id, -1)}
                                disabled={idx === 0}
                                title="Subir en el setlist"
                                className="text-xs text-indigo-500 hover:text-indigo-700 disabled:opacity-25 px-1"
                              >
                                ▲
                              </button>
                              <button
                                onClick={() => handleMoveSong(nextCulto.id, song.id, 1)}
                                disabled={idx === setlists[nextCulto.id].length - 1}
                                title="Bajar en el setlist"
                                className="text-xs text-indigo-500 hover:text-indigo-700 disabled:opacity-25 px-1"
                              >
                                ▼
                              </button>
                            </>
                          )}
                          {song.song_url && (
                            <a href={song.song_url} target="_blank" rel="noopener noreferrer" className="text-[10px] bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-2 py-1 rounded-lg transition-colors">
                              ▶️ Link
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add rápido de canción */}
                {isLiderOrAdmin && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleQuickAddSong();
                  }}
                  className="flex flex-wrap gap-2 bg-purple-50/60 border border-purple-200/70 rounded-2xl p-3"
                >
                  <input
                    type="text"
                    required
                    placeholder="Canción (ej: Cuán Grande es Él)"
                    value={quickTitle}
                    onChange={(e) => setQuickTitle(e.target.value)}
                    className="flex-1 min-w-[140px] bg-white border border-purple-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <input
                    type="text"
                    placeholder="Artista"
                    value={quickArtist}
                    onChange={(e) => setQuickArtist(e.target.value)}
                    className="w-[110px] bg-white border border-purple-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <input
                    type="text"
                    placeholder="Tono (G, C#...)"
                    value={quickKey}
                    onChange={(e) => setQuickKey(e.target.value)}
                    className="w-[100px] bg-white border border-purple-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="submit"
                    className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
                  >
                    + Añadir
                  </button>
                </form>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ANOTARME EN LA BANDA */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span>🎸</span> Confirmar mi Participación en la Alabanza
            </h2>
            <p className="text-xs text-slate-500">Selecciona el servicio y el instrumento/rol que ejercerás.</p>
          </div>

          <form onSubmit={handleSelfAssign} className="grid gap-3 sm:grid-cols-3 items-end">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Culto / Fecha</label>
              <select
                value={selfCultoId}
                onChange={(e) => setSelfCultoId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {cultos.length === 0 ? (
                  <option value="">No hay cultos programados</option>
                ) : (
                  cultos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title || c.service_type} — {cultoDetalle(c).fecha} {cultoDetalle(c).hora && `(${cultoDetalle(c).hora})`}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Instrumento / Rol</label>
              <select
                value={selfInstrument}
                onChange={(e) => setSelfInstrument(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {ADORACION_ROLES.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={cultos.length === 0}
              className="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all shadow-sm"
            >
              Confirmar en Alabanza
            </button>
          </form>

          {/* MIS COMPROMISOS */}
          {(() => {
            const misCompromisos = assignments.filter((a) => isBanda(a) && a.profile_id === userProfile?.id);
            if (misCompromisos.length === 0) return null;
            return (
              <div className="rounded-2xl bg-purple-50/70 border border-purple-200 p-4 space-y-2">
                <p className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">🎸 Mis compromisos</p>
                <div className="grid gap-1.5">
                  {misCompromisos.map((a) => {
                    const culto = cultos.find((c) => c.id === a.service_schedule_id);
                    return (
                      <div key={a.id} className="flex justify-between items-center text-xs bg-white border border-purple-100 rounded-xl px-3 py-2">
                        <div>
                          <span className="font-semibold text-slate-800">
                            {culto ? `${culto.title || culto.service_type} — ${cultoDetalle(culto).fecha}` : "Culto"}
                          </span>
                          <span className="ml-2 text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
                            {a.area?.replace("Adoración: ", "") || "Músico"}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveAssignment(a.id)}
                          className="text-[10px] text-red-400 hover:text-red-300 font-bold"
                        >
                          ✕ Quitar
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* REGISTRO DIRECTO DE MÚSICO (DIRECTOR / LÍDER) */}
        {isLiderOrAdmin && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span>🎤</span> Asignar Músico / Cantante Manualmente
              </h2>
              <p className="text-xs text-slate-500">Agrega integrantes a la lista del domingo aunque no usen la App.</p>
            </div>

            <form onSubmit={handleAddManualServer} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Nombre Hermano/a</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Daniel Rojo"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Culto</label>
                <select
                  value={manualCultoId}
                  onChange={(e) => setManualCultoId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {cultos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title || c.service_type} — {cultoDetalle(c).fecha}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Instrumento / Función</label>
                <select
                  value={manualInstrument}
                  onChange={(e) => setManualInstrument(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {ADORACION_ROLES.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={cultos.length === 0}
                className="bg-amber-600 hover:bg-amber-500 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors"
              >
                + Integrar a Banda
              </button>
            </form>
          </div>
        )}

        {/* CRONOGRAMA Y BANDA PROGRAMADA POR CULTO */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <span>📅</span> Alineación de Banda por Culto
            </h2>
            <p className="text-xs text-slate-500">Equipo programado para la alabanza en {currentBranchName}</p>
          </div>

          {cultos.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <p className="text-sm font-semibold text-slate-500">No hay servicios programados en esta sede.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {cultos.map((culto) => {
                const bandMembers = bandOf(culto.id);
                const currentSetlist = setlists[culto.id] || [];

                return (
                  <div key={culto.id} className="p-5 border border-slate-200 rounded-2xl bg-slate-50/60 shadow-sm space-y-4 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                        <div>
                          <h3 className="font-bold text-indigo-700 text-lg">{culto.title || culto.service_type}</h3>
                          <p className="text-xs font-medium text-slate-500 mt-0.5 capitalize">
                            🗓️ {cultoDetalle(culto).fecha} {cultoDetalle(culto).hora && `— ⏰ ${cultoDetalle(culto).hora} hrs`}
                          </p>
                        </div>
                        <span className="text-[11px] font-bold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200">
                          {bandMembers.length} Integrantes
                        </span>
                      </div>

                      {/* LISTA DE MÚSICOS */}
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Banda Confirmada:</p>
                        {bandMembers.length === 0 ? (
                          <p className="text-xs text-slate-500 italic">No hay músicos o cantantes inscritos aún.</p>
                        ) : (
                          <div className="grid gap-1.5">
                            {bandMembers.map((asgn) => (
                              <div key={asgn.id} className="flex justify-between items-center text-xs bg-white px-3 py-2 rounded-xl border border-slate-200">
                                <div className="flex items-center gap-2">
                                  <span className="text-purple-600 font-bold">🎵</span>
                                  <span className="font-semibold text-slate-800">{nameFor(asgn)}</span>
                                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                    {asgn.area?.replace("Adoración: ", "") || "Músico"}
                                  </span>
                                </div>

                                {(isLiderOrAdmin || asgn.profile_id === userProfile?.id) && (
                                  <button
                                    onClick={() => handleRemoveAssignment(asgn.id)}
                                    className="text-[10px] text-red-400 hover:text-red-300 font-bold"
                                  >
                                    Quitar
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* REPERTORIO / CANCIONES (SETLIST) */}
                      {currentSetlist.length > 0 && (
                        <div className="mt-4 border-t border-slate-200/80 pt-3">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">🎶 Setlist / Canciones:</p>
                          <div className="space-y-1.5">
                            {currentSetlist.map((song, idx) => (
                              <div key={idx} className="flex justify-between items-center text-xs bg-white p-2.5 rounded-xl border border-slate-200 text-slate-700">
                                <div className="space-y-0.5">
                                  <p className="font-semibold">
                                    {idx + 1}. {song.title} {song.artist && <span className="text-slate-400 font-normal">({song.artist})</span>}
                                  </p>
                                  {song.key_note && (
                                    <span className="inline-block text-[10px] font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">
                                      Tono: {song.key_note}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  {isLiderOrAdmin && (
                                    <>
                                      <button
                                        onClick={() => handleMoveSong(culto.id, song.id, -1)}
                                        disabled={idx === 0}
                                        title="Subir en el setlist"
                                        className="text-xs text-indigo-400 hover:text-indigo-600 disabled:opacity-25 px-1"
                                      >
                                        ▲
                                      </button>
                                      <button
                                        onClick={() => handleMoveSong(culto.id, song.id, 1)}
                                        disabled={idx === currentSetlist.length - 1}
                                        title="Bajar en el setlist"
                                        className="text-xs text-indigo-400 hover:text-indigo-600 disabled:opacity-25 px-1"
                                      >
                                        ▼
                                      </button>
                                    </>
                                  )}
                                  {song.song_url && (
                                    <a
                                      href={song.song_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[10px] bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-2 py-1 rounded-lg transition-colors"
                                    >
                                      ▶️ Link
                                    </a>
                                  )}
                                  {isLiderOrAdmin && (
                                    <button
                                      onClick={() => handleRemoveSong(song.id)}
                                      className="text-xs text-slate-400 hover:text-red-500 px-1"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* GESTOR DE REPERTORIO DE CANCIONES (SETLIST COMPLETO) */}
        {isLiderOrAdmin && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span>🎼</span> Cargar Canción al Setlist
            </h2>

            <form onSubmit={handleAddSong} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Culto</label>
                <select
                  value={selectedCultoForSetlist}
                  onChange={(e) => setSelectedCultoForSetlist(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {cultos.map((c) => (
                    <option key={c.id} value={c.id}>{c.title || c.service_type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Canción / Nombre</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Cuán Grande es Él"
                  value={songTitle}
                  onChange={(e) => setSongTitle(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Cantante / Grupo</label>
                <input
                  type="text"
                  placeholder="Ej: En Espíritu y Verdad"
                  value={songArtist}
                  onChange={(e) => setSongArtist(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Tono / Nota</label>
                <input
                  type="text"
                  placeholder="Ej: Sol (G) / C#"
                  value={songKey}
                  onChange={(e) => setSongKey(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Link (YouTube/Chords)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={songUrl}
                  onChange={(e) => setSongUrl(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="lg:col-span-5 flex justify-end">
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-6 rounded-xl text-sm transition-colors"
                >
                  + Añadir Canción al Repertorio
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}