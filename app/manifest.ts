import type { MetadataRoute } from "next";

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
      { src: "/logo.png", sizes: "any", type: "image/png", purpose: "any" },
      { src: "/logo.png", sizes: "192x192", type: "image/png" },
      { src: "/logo.png", sizes: "512x512", type: "image/png" },
    ],
  };
}