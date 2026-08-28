"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ServidoresPage() {
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

  // Sede Seleccionada para Gestión (Líderes/Admins)
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  // Filtro de vista por Ministerio / Área
  const [selectedFilterTeam, setSelectedFilterTeam] = useState<string>("all");

  // Formulario Registro Manual (Líderes/Admins)
  const [manualName, setManualName] = useState("");
  const [manualRole, setManualRole] = useState("servidor");
  const [manualTeamId, setManualTeamId] = useState("");
  const [manualCultoId, setManualCultoId] = useState("");

  // Nuevo Culto (Líderes/Admins)
  const [newCultoTitle, setNewCultoTitle] = useState("");
  const [newCultoDate, setNewCultoDate] = useState("");
  const [newCultoTime, setNewCultoTime] = useState("10:00");

  // Auto-inscripción de Usuario App (Servidor)
  const [selfCultoId, setSelfCultoId] = useState("");
  const [selfTeamId, setSelfTeamId] = useState("");

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
      "Servidor";

    // 1. Cargar Perfil
    // 1. Cargar Perfil con Fallback de Rol por Metadata
    const { data: myProfile } = await supabase
      .from("profiles")
      .select(`id, full_name, role, primary_branch_id, branch_id, branches(id, name)`)
      .eq("id", session.user.id)
      .maybeSingle();

    let activeUser = null;
    let initialBranchId = selectedBranchId;

    // Detectar si en la metadata de Supabase Auth viene el rol explícito
    const metadataRole = session.user.user_metadata?.role || session.user.app_metadata?.role;

    if (myProfile) {
      activeUser = {
        ...myProfile,
        full_name: myProfile.full_name || metadataName,
        // Si el perfil en DB no tiene rol, respeta la metadata o mantiene el de la DB
        role: myProfile.role || metadataRole || "servidor"
      };
      setCurrentUserProfile(activeUser);

      if (!initialBranchId) {
        initialBranchId = myProfile.primary_branch_id || myProfile.branch_id || "";
      }
    } else {
      activeUser = {
        id: session.user.id,
        full_name: metadataName,
        role: metadataRole || "lider", // Si el perfil no cargó aún, mantenemos rol de líder si es la cuenta principal
        branches: { name: "CFC Puente Alto" }
      };
      setCurrentUserProfile(activeUser);
    }

    // 2. Cargar Sedes
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

    // 3. Equipos / Áreas
    const { data: tData } = await supabase.from("teams").select("id, name");
    if (tData) {
      setTeams(tData);
      if (tData.length > 0) {
        setSelfTeamId(tData[0].id);
        setManualTeamId(tData[0].id);
      }
    }

    // 4. Cultos (Todos o filtrados si tienen branch_id)
    const { data: serviceData } = await supabase
      .from("service_schedules")
      .select("*")
      .order("service_date", { ascending: true });
    
    if (serviceData) {
      // Filtrar cultos por la sede activa
      const branchCultos = serviceData.filter((c) => !c.branch_id || c.branch_id === initialBranchId);
      setCultos(branchCultos);

      if (branchCultos.length > 0) {
        setSelfCultoId(branchCultos[0].id);
        setManualCultoId(branchCultos[0].id);
      } else {
        setSelfCultoId("");
        setManualCultoId("");
      }
    }

    // 5. Servidores App y Manuales
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select(`id, full_name, role, primary_branch_id, branches(id, name)`);
    if (allProfiles) setServidores(allProfiles);

    const { data: membersData } = await supabase
      .from("church_members")
      .select(`id, full_name, role, branch_id, team_id, branches(id, name), teams(id, name)`);
    if (membersData) setChurchMembers(membersData);

    // 6. Asignaciones Generales
    const { data: assignData } = await supabase.from("roster_assignments").select(`*`);
    if (assignData) setAssignments(assignData);

    setLoading(false);
  };

  const isLiderOrAdmin =
    currentUserProfile?.role?.toLowerCase() === "lider" ||
    currentUserProfile?.role?.toLowerCase() === "admin" ||
    currentUserProfile?.role?.toLowerCase() === "pastor";

  const handleSelfAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selfCultoId || !selfTeamId || !currentUserProfile?.id) {
      alert("Por favor selecciona un culto y tu área de servicio.");
      return;
    }

    const selectedTeam = teams.find((t) => t.id === selfTeamId);
    const teamName = selectedTeam ? selectedTeam.name : "Servicio";
    const myName = currentUserProfile.full_name || "Servidor";

    const { error } = await supabase.from("roster_assignments").insert({
      service_schedule_id: selfCultoId,
      team_id: selfTeamId,
      profile_id: currentUserProfile.id,
      area: teamName,
      user_name: myName
    });

    if (error) {
      const { error: secondError } = await supabase.from("roster_assignments").insert({
        service_schedule_id: selfCultoId,
        team_id: selfTeamId,
        profile_id: currentUserProfile.id,
        area: teamName
      });

      if (secondError) {
        alert("Error al anotarte: " + secondError.message);
        return;
      }
    }

    alert("¡Genial! Te has anotado exitosamente para servir.");
    await loadAllData();
  };

  const handleAddManualServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !selectedBranchId || !manualCultoId || !manualTeamId) {
      alert("Por favor completa el nombre, culto y área.");
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
          role: manualRole,
          branch_id: selectedBranchId,
          team_id: manualTeamId,
        })
        .select(`id, full_name, role, branch_id, team_id, branches(id, name), teams(id, name)`);

      if (memError) {
        alert("Error al guardar hermano en el directorio: " + memError.message);
        return;
      }
      if (newMem && newMem.length > 0) {
        memberId = newMem[0].id;
      }
    }

    const selectedTeam = teams.find((t) => t.id === manualTeamId);
    const teamName = selectedTeam ? selectedTeam.name : "Servidor Manual";

    const assignmentPayload: any = {
      service_schedule_id: manualCultoId,
      team_id: manualTeamId,
      member_id: memberId,
      area: teamName,
      user_name: manualName,
    };

    const { error: assignErr } = await supabase
      .from("roster_assignments")
      .insert(assignmentPayload);

    if (assignErr) {
      delete assignmentPayload.user_name;
      const { error: secondAssignErr } = await supabase
        .from("roster_assignments")
        .insert(assignmentPayload);

      if (secondAssignErr) {
        alert("Hermano guardado, pero falló la asignación al culto: " + secondAssignErr.message);
        await loadAllData();
        return;
      }
    }

    alert(`¡Hermano/a ${manualName} anotado/a con éxito en el culto!`);
    setManualName("");
    await loadAllData();
  };

  const handleAssignPastorDaniel = async (cultoId: string) => {
    const altarTeam = teams.find(t => t.name.toLowerCase().includes("altar") || t.name.toLowerCase().includes("predic"));
    const teamId = altarTeam ? altarTeam.id : teams[0]?.id;
    const teamName = altarTeam ? altarTeam.name : (teams[0]?.name || "Predicación");

    let pastorMember = churchMembers.find(m => m.full_name.toLowerCase().includes("daniel rojo"));
    
    let payload: any = {
      service_schedule_id: cultoId,
      team_id: teamId,
      area: teamName,
      user_name: "Pastor Daniel Rojo"
    };

    if (pastorMember) {
      payload.member_id = pastorMember.id;
    } else {
      const { data: newMember } = await supabase.from("church_members").insert({
        full_name: "Pastor Daniel Rojo",
        role: "pastor",
        branch_id: selectedBranchId || branches[0]?.id
      }).select();

      if (newMember) payload.member_id = newMember[0].id;
    }

    const { error } = await supabase.from("roster_assignments").insert(payload);
    if (error) {
      delete payload.user_name;
      await supabase.from("roster_assignments").insert(payload);
    }
    
    alert("Pastor Daniel Rojo asignado a este culto.");
    loadAllData();
  };

  const handleDeleteMember = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar a ${name} del directorio?`)) return;
    const { error } = await supabase.from("church_members").delete().eq("id", id);
    if (error) {
      alert("Error: " + error.message);
    } else {
      setChurchMembers((prev) => prev.filter((m) => m.id !== id));
      setAssignments((prev) => prev.filter((a) => a.member_id !== id));
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    const { error } = await supabase.from("roster_assignments").delete().eq("id", assignmentId);
    if (error) {
      alert("Error al quitar asignación: " + error.message);
    } else {
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    }
  };

  const handleCreateCulto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCultoTitle.trim() || !newCultoDate) {
      alert("Ingresa un título y una fecha.");
      return;
    }

    const fullDateTime = `${newCultoDate} ${newCultoTime}`;

    const cultoPayload: any = {
      title: newCultoTitle,
      service_type: newCultoTitle,
      service_date: fullDateTime,
      date: fullDateTime,
      branch_id: selectedBranchId
    };

    const { data, error } = await supabase.from("service_schedules").insert(cultoPayload).select();

    if (error) {
      delete cultoPayload.branch_id;
      const { data: retryData, error: retryError } = await supabase.from("service_schedules").insert(cultoPayload).select();
      
      if (retryError) {
        alert("Error al crear el culto: " + retryError.message);
        return;
      }
      if (retryData) setCultos((prev) => [...prev, retryData[0]]);
    } else {
      if (data) setCultos((prev) => [...prev, data[0]]);
    }

    alert("Culto programado con éxito.");
    setNewCultoTitle("");
    setNewCultoDate("");
    setNewCultoTime("10:00");
  };

  const handleDeleteCulto = async (id: string) => {
    if (!confirm("¿Seguro que deseas eliminar este culto?")) return;
    const { error } = await supabase.from("service_schedules").delete().eq("id", id);
    if (error) {
      alert("Error al eliminar: " + error.message);
    } else {
      setCultos((prev) => prev.filter((c) => c.id !== id));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <p className="text-slate-600 font-medium">Cargando la plataforma...</p>
      </div>
    );
  }

  const currentBranchName = branches.find(b => b.id === selectedBranchId)?.name || currentUserProfile?.branches?.name || "CFC Puente Alto";

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* ENCABEZADO */}
        <div className="bg-white p-6 rounded-2xl shadow-sm flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Bienvenido/a, {currentUserProfile?.full_name || "Servidor"}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 uppercase">
                ROL: {currentUserProfile?.role || "servidor"}
              </span>
              
              {/* SELECTOR DE SEDE EXCLUSIVO PARA LÍDERES Y ADMINS */}
              {isLiderOrAdmin ? (
                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full text-xs font-bold text-amber-900">
                  <span>📍 Cambiar Sede:</span>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="bg-transparent font-bold text-amber-950 focus:outline-none cursor-pointer"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
                  📍 Sede: {currentBranchName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* REGISTRO MANUAL DE HERMANOS (EXCLUSIVO LÍDERES / ADMINS) */}
        {isLiderOrAdmin && (
          <div className="bg-white p-6 rounded-2xl shadow-sm space-y-4 border border-amber-200 bg-amber-50/20">
            <div>
              <h2 className="text-lg font-bold text-slate-800">👤 Anotar Hermano Manual (Sin App)</h2>
              <p className="text-xs text-slate-500">
                Guarda al hermano en el directorio y lo asigna al culto seleccionado en <strong className="text-amber-800">{currentBranchName}</strong>.
              </p>
            </div>

            <form onSubmit={handleAddManualServer} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Emilio Rubio"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-sm text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Culto / Fecha</label>
                <select
                  value={manualCultoId}
                  onChange={(e) => setManualCultoId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-sm text-slate-800"
                >
                  {cultos.length === 0 ? (
                    <option value="">Sin cultos en esta sede</option>
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">Área / Ministerio</label>
                <select
                  value={manualTeamId}
                  onChange={(e) => setManualTeamId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-sm text-slate-800"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={cultos.length === 0}
                className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors"
              >
                + Guardar y Anotar al Culto
              </button>
            </form>
          </div>
        )}

        {/* ANOTARME PARA SERVIR (PARA TODOS LOS SERVIDORES Y LÍDERES) */}
        <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-bold text-emerald-950">✋ ¡Anotarme para Servir!</h2>
            <p className="text-xs text-emerald-800">Selecciona el culto en {currentBranchName} y la función donde servirás.</p>
          </div>

          <form onSubmit={handleSelfAssign} className="grid gap-3 sm:grid-cols-3 items-end">
            <div>
              <label className="block text-xs font-semibold text-emerald-900 mb-1">Culto / Fecha</label>
              <select
                value={selfCultoId}
                onChange={(e) => setSelfCultoId(e.target.value)}
                className="w-full bg-white border border-emerald-300 rounded-xl p-2.5 text-sm text-slate-700"
              >
                {cultos.length === 0 ? (
                  <option value="">No hay cultos disponibles</option>
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
              <label className="block text-xs font-semibold text-emerald-900 mb-1">Área / Ministerio</label>
              <select
                value={selfTeamId}
                onChange={(e) => setSelfTeamId(e.target.value)}
                className="w-full bg-white border border-emerald-300 rounded-xl p-2.5 text-sm text-slate-700"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={cultos.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors"
            >
              Confirmar mi Asistencia
            </button>
          </form>
        </div>

        {/* CRONOGRAMA DE CULTOS Y ASIGNACIONES */}
        <div className="bg-white p-6 rounded-2xl shadow-sm space-y-6">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">📅 Cronograma de Servicios</h2>
              <p className="text-xs text-slate-500">Mostrando cultos de {currentBranchName}</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Filtrar vista por área:</span>
              <select
                value={selectedFilterTeam}
                onChange={(e) => setSelectedFilterTeam(e.target.value)}
                className="bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold p-2 text-slate-700"
              >
                <option value="all">Ver Todas las Áreas</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* FORMULARIO PARA CREAR CULTO (SOLO LÍDERES O ADMINS) */}
          {isLiderOrAdmin && (
            <form onSubmit={handleCreateCulto} className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid gap-3 md:grid-cols-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nuevo Culto</label>
                <input
                  type="text"
                  placeholder="Ej: Culto Dominical"
                  value={newCultoTitle}
                  onChange={(e) => setNewCultoTitle(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha</label>
                <input
                  type="date"
                  value={newCultoDate}
                  onChange={(e) => setNewCultoDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Hora</label>
                <input
                  type="time"
                  value={newCultoTime}
                  onChange={(e) => setNewCultoTime(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm text-slate-800"
                />
              </div>

              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
              >
                + Programar Culto
              </button>
            </form>
          )}

          {cultos.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <p className="text-sm font-semibold text-slate-600">No hay cultos programados para {currentBranchName}.</p>
              {isLiderOrAdmin && (
                <p className="text-xs text-slate-400 mt-1">Puedes programar un nuevo culto con el formulario superior.</p>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {cultos.map((culto) => {
                const assignedPeople = assignments.filter((a) => {
                  const isCultoMatch = a.service_schedule_id === culto.id;
                  if (!isCultoMatch) return false;
                  if (selectedFilterTeam === "all") return true;

                  const teamObj = teams.find(t => t.id === selectedFilterTeam);
                  const isTeamIdMatch = a.team_id === selectedFilterTeam;
                  const isAreaNameMatch = teamObj && a.area?.toLowerCase().includes(teamObj.name?.toLowerCase());

                  return isTeamIdMatch || isAreaNameMatch;
                });

                return (
                  <div key={culto.id} className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm space-y-4 relative">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-slate-800 text-base">{culto.title || culto.service_type}</h3>
                        <p className="text-xs font-semibold text-indigo-600 mt-0.5">
                          🗓️ {formatDateTime(culto.service_date || culto.date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isLiderOrAdmin && (
                          <button
                            onClick={() => handleAssignPastorDaniel(culto.id)}
                            className="text-[11px] bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold px-2 py-1 rounded-md transition-colors"
                          >
                            + Pastor Daniel
                          </button>
                        )}
                        {isLiderOrAdmin && (
                          <button
                            onClick={() => handleDeleteCulto(culto.id)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-xs font-bold text-slate-600 mb-2">
                        Servidores Anotados {selectedFilterTeam !== "all" && "(Filtrados por Área)"}:
                      </p>
                      {assignedPeople.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Nadie anotado en esta área aún.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {assignedPeople.map((asgn) => {
                            const isMe = asgn.profile_id === currentUserProfile?.id;
                            let personName = asgn.user_name || "";

                            if (!personName) {
                              if (isMe) {
                                personName = currentUserProfile?.full_name || "Tú";
                              } else {
                                const foundProf = servidores.find(s => s.id === asgn.profile_id);
                                const foundMem = churchMembers.find(m => m.id === asgn.member_id);
                                if (foundProf) personName = foundProf.full_name;
                                else if (foundMem) personName = foundMem.full_name;
                                else personName = "Servidor Confirmado";
                              }
                            }

                            const teamObj = teams.find(t => t.id === asgn.team_id);
                            const areaLabel = asgn.area || teamObj?.name || "Servicio General";
                            const isDeletable = isLiderOrAdmin || isMe;

                            return (
                              <div key={asgn.id} className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded-lg border border-slate-200">
                                <div>
                                  <span className="font-semibold text-slate-800">👤 {personName}</span>
                                  <span className="ml-2 font-bold text-indigo-600">({areaLabel})</span>
                                </div>
                                {isDeletable && (
                                  <button
                                    onClick={() => handleRemoveAssignment(asgn.id)}
                                    className="text-[10px] text-red-500 hover:text-red-700 font-bold"
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
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* DIRECTORIO DE LA IGLESIA (PARA LÍDERES / ADMINS) */}
        {isLiderOrAdmin && (
          <div className="bg-white p-6 rounded-2xl shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800">Directorio General de Servidores</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {servidores.map((item) => (
                <div key={item.id} className="p-4 border border-slate-200 rounded-xl flex items-center justify-between bg-slate-50">
                  <div>
                    <p className="font-semibold text-slate-800">{item.full_name}</p>
                    <p className="text-xs text-slate-500 capitalize">Usuario App — {item.role}</p>
                  </div>
                  <span className="text-xs font-medium bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-slate-700">
                    📍 {item.branches?.name || "CFC Puente Alto"}
                  </span>
                </div>
              ))}

              {churchMembers.map((member) => (
                <div key={member.id} className="p-4 border border-amber-200 rounded-xl flex items-center justify-between bg-amber-50/50">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800">{member.full_name}</p>
                      <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.5 rounded">Manual</span>
                    </div>
                    <p className="text-xs text-slate-500 capitalize">
                      {member.role} — <span className="font-semibold text-indigo-600">{member.teams?.name || "Sin Área"}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-slate-700">
                      📍 {member.branches?.name || "CFC Puente Alto"}
                    </span>
                    <button
                      onClick={() => handleDeleteMember(member.id, member.full_name)}
                      className="text-xs text-red-600 hover:text-red-800 font-bold p-1 transition-colors"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}