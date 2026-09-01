"use client";

import Link from "next/link";
import { useOrganization } from "@/context/OrganizationContext";

export default function Navbar() {
  const { org, allOrgs, userRole, switchOrganization } = useOrganization();

  const isAdmin = userRole === "admin" || userRole === "superadmin";
  const isLiderOrAdmin = isAdmin || userRole === "lider";

  return (
    <header
      style={{ backgroundColor: org?.secondary_color || "#0F172A" }}
      className="text-white px-6 py-4 shadow-md transition-colors duration-300"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* LOGO Y NOMBRE DE LA IGLESIA */}
        <div className="flex items-center gap-3">
          {org?.logo_url ? (
            <img
              src={org.logo_url}
              alt={org.name}
              className="w-10 h-10 rounded-xl object-cover bg-white"
            />
          ) : (
            <div
              style={{ backgroundColor: org?.primary_color || "#4F46E5" }}
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg"
            >
              {org?.name?.charAt(0) || "I"}
            </div>
          )}

          <div>
            <h1 className="font-extrabold text-base leading-tight">
              {org?.name || "Cargando..."}
            </h1>
            <span className="text-[10px] uppercase font-semibold text-slate-300 tracking-wider">
              Rol: <span className="text-amber-400">{userRole}</span>
            </span>
          </div>
        </div>

        {/* MENÚ DE NAVEGACIÓN SEGÚN ROL */}
        <nav className="flex items-center gap-4 text-xs font-bold">
          <Link href="/" className="hover:text-indigo-300 transition-colors">
            Inicio
          </Link>

          <Link href="/servidores" className="hover:text-indigo-300 transition-colors">
            Servidores
          </Link>

          {/* Módulos visibles solo para Líderes o Admins */}
          {isLiderOrAdmin && (
            <>
              <Link href="/adoracion" className="hover:text-indigo-300 transition-colors">
                Adoración
              </Link>
              <Link href="/escuela-dominical" className="hover:text-indigo-300 transition-colors">
                Escuela Dominical
              </Link>
            </>
          )}

          {/* Configuración accesible SOLO para Administradores de la iglesia */}
          {isAdmin && (
            <Link
              href="/configuracion"
              className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl border border-white/20 transition-colors text-amber-300"
            >
              ⚙️ Configuración
            </Link>
          )}
        </nav>

        {/* SELECTOR/SWITCHER DE IGLESIA (Para desarrollo y pruebas) */}
        {allOrgs.length > 0 && (
          <div className="flex items-center gap-2 bg-black/20 p-1.5 rounded-2xl border border-white/10">
            <span className="text-[10px] text-slate-300 font-medium px-2">Iglesia:</span>
            <select
              value={org?.id || ""}
              onChange={(e) => switchOrganization(e.target.value)}
              className="bg-slate-800 text-white text-xs font-semibold py-1 px-2 rounded-xl focus:outline-none border border-slate-700 cursor-pointer"
            >
              {allOrgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        )}

      </div>
    </header>
  );
}