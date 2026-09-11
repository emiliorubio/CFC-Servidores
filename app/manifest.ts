import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { supabase } from "@/lib/supabase";

// El manifest es dinámico: al instalar la app (PWA) cada iglesia se identifica
// con su propio nombre, colores y logo según el subdominio (ej. cfcvida.miiglesia.cl).
export const dynamic = "force-dynamic";

function normalizeSlug(slug: string) {
  return slug.toLowerCase().replace(/-/g, "");
}

function slugFromHost(host: string): string | null {
  const cleaned = host.toLowerCase().split(":")[0];
  if (cleaned === "localhost" || cleaned === "127.0.0.1") return null;
  const [sub] = cleaned.split(".");
  return sub && sub !== "www" ? sub : null;
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  interface OrgRow {
    name: string;
    slug: string;
    primary_color: string;
    secondary_color: string;
    logo_url?: string | null;
  }
  let org: OrgRow | null = null;

  try {
    const headersList = await headers();
    const host = headersList.get("x-forwarded-host") || headersList.get("host") || "";
    const slug = slugFromHost(host);
    if (slug) {
      const { data } = await supabase
        .from("organizations")
        .select("name, slug, primary_color, secondary_color, logo_url");
      const rows = (data || []) as OrgRow[];
      org = rows.find((o) => normalizeSlug(o.slug) === normalizeSlug(slug)) || null;
    }
  } catch {
    // Sin organización detectable: se usan los valores por defecto.
  }

  // El logo institucional suele ser blanco sobre fondo transparente; la
  // variante "maskable" deja margen de seguridad sobre el color de la iglesia.
  const name = org ? `${org.name} · Organización de Cultos` : "CFC-Servidores";
  const shortName = org ? org.name.split(" ")[0].slice(0, 12) : "CFC";
  const theme = org?.secondary_color || "#0F172A";

  const staticIcons: NonNullable<MetadataRoute.Manifest["icons"]> = [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ];

  const icons = org?.logo_url
    ? [{ src: org.logo_url, sizes: "512x512", purpose: "any" } as const, ...staticIcons]
    : staticIcons;

  return {
    name,
    short_name: shortName,
    description: `Organiza los servicios, equipos de adoración, escuela dominical y servidores de ${org ? org.name : "tu iglesia"}.`,
    start_url: "/",
    display: "standalone",
    background_color: theme,
    theme_color: theme,
    icons,
  };
}