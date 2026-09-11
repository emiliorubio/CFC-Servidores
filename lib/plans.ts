export type Plan = "basico" | "plata" | "gold";

export type ModuleKey =
  | "inicio"
  | "consolidacion"
  | "finanzas"
  | "configuracion"
  | "adoracion"
  | "escuela"
  | "servidores"
  | "directorio"
  | "usuarios"
  | "cafeteria";

export interface PlanInfo {
  nombre: string;
  emoji: string;
  descripcion: string;
  modulos: ModuleKey[];
  color: string;
}

export const PLANES: Record<Plan, PlanInfo> = {
  basico: {
    nombre: "Básico",
    emoji: "🌱",
    color: "#94A3B8",
    descripcion:
      "Cronograma de cultos con fechas y horarios, registro de consolidación, finanzas y configuración de la iglesia.",
    modulos: ["inicio", "consolidacion", "finanzas", "configuracion"],
  },
  plata: {
    nombre: "Plata · Ministerios",
    emoji: "🔥",
    color: "#4F46E5",
    descripcion:
      "Todo lo del plan Básico más Adoración, Escuela Dominical, inscripción de Servidores, Directorio y Usuarios.",
    modulos: [
      "inicio",
      "consolidacion",
      "finanzas",
      "configuracion",
      "adoracion",
      "escuela",
      "servidores",
      "directorio",
      "usuarios",
    ],
  },
  gold: {
    nombre: "Gold · Premium",
    emoji: "👑",
    color: "#D97706",
    descripcion: "Todos los módulos de la plataforma, incluida la Cafetería.",
    modulos: [
      "inicio",
      "consolidacion",
      "finanzas",
      "configuracion",
      "adoracion",
      "escuela",
      "servidores",
      "directorio",
      "usuarios",
      "cafeteria",
    ],
  },
};

const MODULOS_PLAN: Record<Plan, ModuleKey[]> = {
  basico: PLANES.basico.modulos,
  plata: PLANES.plata.modulos,
  gold: PLANES.gold.modulos,
};

/** Normaliza el plan de la organización. Valores desconocidos ('free', null)
 * conservan acceso completo (gold) para no romper iglesias existentes. */
export function planNormalizado(plan?: string | null): Plan {
  if (plan === "basico" || plan === "plata" || plan === "gold") return plan;
  return "gold";
}

export function moduloActivo(plan: string | null | undefined, modulo: ModuleKey): boolean {
  return MODULOS_PLAN[planNormalizado(plan)].includes(modulo);
}

export const LISTA_PLANES: Plan[] = ["basico", "plata", "gold"];