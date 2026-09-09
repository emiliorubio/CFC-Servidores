import type { MetadataRoute } from "next";

// El logo institucional es blanco sobre fondo transparente; para que se vea
// bien al instalar la app (el tile usa fondo oscuro propio de cada sistema),
// los iconos del manifest llevan el logo centrado sobre #0F172A (color de la
// barra de navegación). La variante "maskable" deja margen de seguridad.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CFC-Servidores",
    short_name: "CFC",
    description:
      "Organiza los servicios, equipos de adoración, escuela dominical y servidores de tu iglesia.",
    start_url: "/",
    display: "standalone",
    background_color: "#0F172A",
    theme_color: "#0F172A",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}