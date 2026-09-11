"use client";

import { useOrganization } from "@/context/OrganizationContext";
import { PLANES, planNormalizado } from "@/lib/plans";

export default function PlanDisabled({ modulo }: { modulo: string }) {
  const { org } = useOrganization();
  const planInfo = PLANES[planNormalizado(org?.plan)];

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center p-4">
      <div className="w-full rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm">
        <div className="text-3xl">🔒</div>
        <h1 className="mt-3 text-lg font-bold text-slate-800">Módulo no disponible en tu plan</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          La sección <strong>{modulo}</strong> no está incluida en el plan{" "}
          <strong>
            {planInfo.emoji} {planInfo.nombre}
          </strong>{" "}
          de esta iglesia.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">{planInfo.descripcion}</p>
        <p className="mt-3 text-xs text-slate-500">
          Contacta al administrador para cambiar el plan y habilitar esta sección.
        </p>
      </div>
    </div>
  );
}