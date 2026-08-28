"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

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
];

export default function AdoracionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);

  // Datos base
  const [servidores, setServidores] = useState<any[]>([]);
  const [churchMembers, setChurchMembers] = useState<any[]>([]);
  const [cultos, setCultos] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);

  // Sede Seleccionada
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  // ID del equipo de Adoración
  const [adoracionTeamId, setAdoracionTeamId] = useState<string>("");

  // Formulario Registro Manual de Músico/Cantante
  const [manualName, setManualName] = useState("");
  const [manualInstrument, setManualInstrument] = useState(ADORACION_ROLES[0]);
  const [manualCultoId, setManualCultoId] = useState("");

  // Auto-inscripción (Músico/Cantante App)
  const [selfCultoId, setSelfCultoId] = useState("");
  const [selfInstrument, setSelfInstrument] = useState(ADORACION_ROLES[0]);

  // Gestión de Setlist (Canciones) por Culto con campos completos
  const [selectedCultoForSetlist, setSelectedCultoForSetlist] = useState<string>("");
  const [songTitle, setSongTitle] = useState("");
  const [songArtist, setSongArtist] = useState("");
  const [songKey, setSongKey] = useState("");
  const [songUrl, setSongUrl] = useState("");
  const [setlists, setSetlists] = useState<Record<string, any[]>>({});

  const formatDateTime = (rawDate: string) => {
    if (!rawDate) return "";
    let clean = rawDate.replace("T", " ");
    if (clean.includes("+")) clean = clean.split("+")[0];
    if (clean.length > 16) clean = clean.substring(0, 16);
    return clean;
  };

  useEffect(() => {
    loadAllData();
  }, [selectedBranchId]);

  const loadAllData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    const metadataName = 
      session.user.user_metadata?.full_name || 
      session.user.user_metadata?.name || 
      session.user.email?.split("@")[0] ||
      "Músico/Cantante";

    // 1. Perfil del Usuario
    const { data: myProfile } = await supabase
      .from("profiles")
      .select(`id, full_name, role, primary_branch_id, branch_id, branches(id, name)`)
      .eq("id", session.user.id)
      .maybeSingle();

    let initialBranchId = selectedBranchId;
    const metadataRole = session.user.user_metadata?.role || session.user.app_metadata?.role;

    if (myProfile) {
      const activeUser = {
        ...myProfile,
        full_name: myProfile.full_name || metadataName,
        role: myProfile.role || metadataRole || "servidor"
      };
      setCurrentUserProfile(activeUser);
      if (!initialBranchId) {
        initialBranchId = myProfile.primary_branch_id || myProfile.branch_id || "";
      }
    } else {
      setCurrentUserProfile({
        id: session.user.id,
        full_name: metadataName,
        role: metadataRole || "lider",
        branches: { name: "CFC Puente Alto" }
      });
    }

    // 2. Sedes
    const { data: bData } = await supabase.from("branches").select("id, name");
    if (bData) {
      setBranches(bData);
      if (!initialBranchId && bData.length > 0) {
        initialBranchId = bData[0].id;
      }
    }
    if (!selectedBranchId && initialBranchId) {
      setSelectedBranchId(initialBranchId);
    }

    // 3. Obtener/Identificar ID del Equipo de Adoración
    const { data: tData } = await supabase.from("teams").select("id, name");
    if (tData) {
      setTeams(tData);
      const adoTeam = tData.find(t => 
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
      .order("service_date", { ascending: true });
    
    if (serviceData) {
      const branchCultos = serviceData.filter((c) => !c.branch_id || c.branch_id === initialBranchId);
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
      .select(`id, full_name, role, primary_branch_id, branches(id, name)`);
    if (allProfiles) setServidores(allProfiles);

    const { data: membersData } = await supabase
      .from("church_members")
      .select(`id, full_name, role, branch_id, team_id, branches(id, name), teams(id, name)`);
    if (membersData) setChurchMembers(membersData);

    // 6. Asignaciones de la Banda
    const { data: assignData } = await supabase.from("roster_assignments").select(`*`);
    if (assignData) setAssignments(assignData);

    // 7. Cargar Canciones / Setlist
    const { data: songsData } = await supabase.from("service_songs").select("*").order("created_at", { ascending: true });
    if (songsData) {
      const grouped = songsData.reduce((acc: any, song: any) => {
        acc[song.service_schedule_id] = acc[song.service_schedule_id] || [];
        acc[song.service_schedule_id].push(song);
        return acc;
      }, {});
      setSetlists(grouped);
    }

    setLoading(false);
  };

  const isLiderOrAdmin =
    currentUserProfile?.role?.toLowerCase() === "lider" ||
    currentUserProfile?.role?.toLowerCase() === "admin" ||
    currentUserProfile?.role?.toLowerCase() === "pastor" ||
    currentUserProfile?.role?.toLowerCase() === "director";

  // Auto-agendarse en la Banda
  const handleSelfAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selfCultoId || !currentUserProfile?.id) {
      alert("Selecciona un culto válido.");
      return;
    }

    const myName = currentUserProfile.full_name || "Músico";

    const payload = {
      service_schedule_id: selfCultoId,
      team_id: adoracionTeamId,
      profile_id: currentUserProfile.id,
      area: `Adoración: ${selfInstrument}`,
      user_name: myName
    };

    const { error } = await supabase.from("roster_assignments").insert(payload);

    if (error) {
      delete payload.user_name;
      const { error: secondError } = await supabase.from("roster_assignments").insert(payload);
      if (secondError) {
        alert("Error al anotarte en la banda: " + secondError.message);
        return;
      }
    }

    alert(`¡Confirmado! Servirás como [${selfInstrument}] en la alabanza.`);
    await loadAllData();
  };

  // Registrar Músico Manualmente (Para líderes)
  const handleAddManualServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !selectedBranchId || !manualCultoId) {
      alert("Ingresa el nombre del integrante y el culto.");
      return;
    }

    let memberId = null;
    const existingMember = churchMembers.find(
      (m) => m.full_name.trim().toLowerCase() === manualName.trim().toLowerCase()
    );

    if (existingMember) {
      memberId = existingMember.id;
    } else {
      const { data: newMem, error: memError } = await supabase
        .from("church_members")
        .insert({
          full_name: manualName,
          role: "músico",
          branch_id: selectedBranchId,
          team_id: adoracionTeamId,
        })
        .select();

      if (memError) {
        alert("Error al guardar integrante: " + memError.message);
        return;
      }
      if (newMem && newMem.length > 0) memberId = newMem[0].id;
    }

    const assignmentPayload: any = {
      service_schedule_id: manualCultoId,
      team_id: adoracionTeamId,
      member_id: memberId,
      area: `Adoración: ${manualInstrument}`,
      user_name: manualName,
    };

    const { error: assignErr } = await supabase.from("roster_assignments").insert(assignmentPayload);

    if (assignErr) {
      delete assignmentPayload.user_name;
      const { error: retryErr } = await supabase.from("roster_assignments").insert(assignmentPayload);
      if (retryErr) {
        alert("Error al programar al músico: " + retryErr.message);
        return;
      }
    }

    alert(`${manualName} asignado/a como [${manualInstrument}] exitosamente.`);
    setManualName("");
    await loadAllData();
  };

  // Agregar Canción con todos los campos (Nombre, Cantante, Nota/Tono y Link)
  const handleAddSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!songTitle.trim() || !selectedCultoForSetlist) {
      alert("Escribe el nombre de la canción.");
      return;
    }

    const songPayload = {
      service_schedule_id: selectedCultoForSetlist,
      title: songTitle.trim(),
      artist: songArtist.trim() || null,
      key_note: songKey.trim() || null,
      song_url: songUrl.trim() || null
    };

    const { error } = await supabase.from("service_songs").insert(songPayload);

    if (error) {
      alert("Error al guardar la canción: " + error.message);
      return;
    }

    alert("Canción agregada al repertorio.");
    setSongTitle("");
    setSongArtist("");
    setSongKey("");
    setSongUrl("");
    await loadAllData();
  };

  const handleRemoveSong = async (songId: string) => {
    const { error } = await supabase.from("service_songs").delete().eq("id", songId);
    if (!error) await loadAllData();
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    const { error } = await supabase.from("roster_assignments").delete().eq("id", assignmentId);
    if (!error) {
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <p className="text-amber-400 font-medium animate-pulse">Cargando Ministerio de Adoración...</p>
      </div>
    );
  }

  const currentBranchName = branches.find(b => b.id === selectedBranchId)?.name || "CFC Puente Alto";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* ENCABEZADO */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-wrap justify-between items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎵</span>
              <h1 className="text-2xl font-bold text-white">Ministerio de Adoración</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Hola, <strong className="text-amber-400">{currentUserProfile?.full_name}</strong> — Coordinación de Alabanza y Músicos
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isLiderOrAdmin ? (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-full text-xs font-semibold text-amber-300">
                <span>📍 Sede:</span>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="bg-transparent font-bold text-amber-200 focus:outline-none cursor-pointer"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id} className="bg-slate-900 text-white">{b.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-xs font-semibold px-3 py-1.5 bg-slate-800 text-slate-300 rounded-full border border-slate-700">
                📍 Sede: {currentBranchName}
              </span>
            )}
          </div>
        </div>

        {/* ANOTARME EN LA BANDA (PARA MÚSICOS Y SERVIDORES) */}
        <div className="bg-gradient-to-r from-purple-900/40 to-slate-900 border border-purple-500/30 p-6 rounded-2xl shadow-lg space-y-4">
          <div>
            <h2 className="text-lg font-bold text-purple-200 flex items-center gap-2">
              <span>🎸</span> Confirmar mi Participación en la Alabanza
            </h2>
            <p className="text-xs text-purple-300/70">Selecciona el servicio y el instrumento/rol que ejercerás.</p>
          </div>

          <form onSubmit={handleSelfAssign} className="grid gap-3 sm:grid-cols-3 items-end">
            <div>
              <label className="block text-xs font-semibold text-purple-200 mb-1">Culto / Fecha</label>
              <select
                value={selfCultoId}
                onChange={(e) => setSelfCultoId(e.target.value)}
                className="w-full bg-slate-950 border border-purple-500/40 rounded-xl p-2.5 text-sm text-slate-200 focus:ring-2 focus:ring-purple-500"
              >
                {cultos.length === 0 ? (
                  <option value="">No hay cultos programados</option>
                ) : (
                  cultos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title || c.service_type} ({formatDateTime(c.service_date || c.date)})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-purple-200 mb-1">Instrumento / Rol</label>
              <select
                value={selfInstrument}
                onChange={(e) => setSelfInstrument(e.target.value)}
                className="w-full bg-slate-950 border border-purple-500/40 rounded-xl p-2.5 text-sm text-slate-200 focus:ring-2 focus:ring-purple-500"
              >
                {ADORACION_ROLES.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={cultos.length === 0}
              className="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all shadow-md shadow-purple-900/50"
            >
              Confirmar en Alabanza
            </button>
          </form>
        </div>

        {/* REGISTRO DIRECTO DE MÚSICO (DIRECTOR / LÍDER) */}
        {isLiderOrAdmin && (
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <span>🎤</span> Asignar Músico / Cantante Manualmente
              </h2>
              <p className="text-xs text-slate-400">Agrega integrantes a la lista del domingo aunque no usen la App.</p>
            </div>

            <form onSubmit={handleAddManualServer} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Nombre Hermano/a</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Daniel Rojo"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Culto</label>
                <select
                  value={manualCultoId}
                  onChange={(e) => setManualCultoId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100"
                >
                  {cultos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title || c.service_type} ({formatDateTime(c.service_date || c.date)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Instrumento / Función</label>
                <select
                  value={manualInstrument}
                  onChange={(e) => setManualInstrument(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100"
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
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>📅</span> Alineación de Banda por Culto
            </h2>
            <p className="text-xs text-slate-400">Equipo programado para la alabanza en {currentBranchName}</p>
          </div>

          {cultos.length === 0 ? (
            <div className="p-8 text-center bg-slate-950 rounded-xl border border-dashed border-slate-800">
              <p className="text-sm font-semibold text-slate-500">No hay servicios programados en esta sede.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {cultos.map((culto) => {
                const bandMembers = assignments.filter((a) => {
                  const isCultoMatch = a.service_schedule_id === culto.id;
                  const isAdoracionArea = 
                    a.team_id === adoracionTeamId || 
                    a.area?.toLowerCase().includes("adorac") ||
                    a.area?.toLowerCase().includes("alabanz") ||
                    ADORACION_ROLES.some(r => a.area?.includes(r));

                  return isCultoMatch && isAdoracionArea;
                });

                const currentSetlist = setlists[culto.id] || [];

                return (
                  <div key={culto.id} className="p-5 border border-slate-800 rounded-2xl bg-slate-950/60 shadow-inner space-y-4 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                        <div>
                          <h3 className="font-bold text-amber-400 text-lg">{culto.title || culto.service_type}</h3>
                          <p className="text-xs font-medium text-slate-400 mt-0.5">
                            🗓️ {formatDateTime(culto.service_date || culto.date)}
                          </p>
                        </div>
                        <span className="text-[11px] font-bold px-2.5 py-1 bg-purple-950 text-purple-300 rounded-lg border border-purple-800">
                          {bandMembers.length} Integrantes
                        </span>
                      </div>

                      {/* LISTA DE MÚSICOS */}
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Banda Confirmada:</p>
                        {bandMembers.length === 0 ? (
                          <p className="text-xs text-slate-600 italic">No hay músicos o cantantes inscritos aún.</p>
                        ) : (
                          <div className="grid gap-1.5">
                            {bandMembers.map((asgn) => {
                              const isMe = asgn.profile_id === currentUserProfile?.id;
                              let personName = asgn.user_name;

                              if (!personName) {
                                if (isMe) personName = currentUserProfile?.full_name;
                                else {
                                  const prof = servidores.find(s => s.id === asgn.profile_id);
                                  const mem = churchMembers.find(m => m.id === asgn.member_id);
                                  personName = prof?.full_name || mem?.full_name || "Servidor";
                                }
                              }

                              const roleLabel = asgn.area?.replace("Adoración: ", "") || "Músico";

                              return (
                                <div key={asgn.id} className="flex justify-between items-center text-xs bg-slate-900 px-3 py-2 rounded-xl border border-slate-800/80">
                                  <div className="flex items-center gap-2">
                                    <span className="text-purple-400 font-bold">🎵</span>
                                    <span className="font-semibold text-slate-200">{personName}</span>
                                    <span className="text-[11px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md">
                                      {roleLabel}
                                    </span>
                                  </div>

                                  {(isLiderOrAdmin || isMe) && (
                                    <button
                                      onClick={() => handleRemoveAssignment(asgn.id)}
                                      className="text-[10px] text-red-400 hover:text-red-300 font-bold"
                                    >
                                      Quitar
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* REPERTORIO / CANCIONES (SETLIST) DETALLADO */}
                      {currentSetlist.length > 0 && (
                        <div className="mt-4 border-t border-slate-800/60 pt-3">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">🎶 Setlist / Canciones:</p>
                          <div className="space-y-1.5">
                            {currentSetlist.map((song: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center text-xs bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 text-slate-200">
                                <div className="space-y-0.5">
                                  <p className="font-semibold">
                                    {idx + 1}. {song.title} {song.artist && <span className="text-slate-400 font-normal">({song.artist})</span>}
                                  </p>
                                  {song.key_note && (
                                    <span className="inline-block text-[10px] font-mono bg-purple-900/60 text-purple-200 px-2 py-0.5 rounded-md">
                                      Tono: {song.key_note}
                                    </span>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  {song.song_url && (
                                    <a
                                      href={song.song_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[10px] bg-red-900/40 hover:bg-red-900/60 text-red-300 border border-red-700/50 px-2 py-1 rounded-lg transition-colors"
                                    >
                                      ▶️ Link
                                    </a>
                                  )}
                                  {isLiderOrAdmin && (
                                    <button
                                      onClick={() => handleRemoveSong(song.id)}
                                      className="text-xs text-slate-500 hover:text-red-400 px-1"
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
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🎼</span> Cargar Canción al Setlist
            </h2>

            <form onSubmit={handleAddSong} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Culto</label>
                <select
                  value={selectedCultoForSetlist}
                  onChange={(e) => setSelectedCultoForSetlist(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100"
                >
                  {cultos.map((c) => (
                    <option key={c.id} value={c.id}>{c.title || c.service_type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Canción / Nombre</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Cuán Grande es Él"
                  value={songTitle}
                  onChange={(e) => setSongTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Cantante / Grupo</label>
                <input
                  type="text"
                  placeholder="Ej: En Espíritu y Verdad"
                  value={songArtist}
                  onChange={(e) => setSongArtist(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Tono / Nota</label>
                <input
                  type="text"
                  placeholder="Ej: Sol (G) / C#"
                  value={songKey}
                  onChange={(e) => setSongKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Link (YouTube/Chords)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={songUrl}
                  onChange={(e) => setSongUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100"
                />
              </div>

              <div className="lg:col-span-5 flex justify-end">
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2.5 px-6 rounded-xl text-sm transition-colors"
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