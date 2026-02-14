// app/manifest.ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Communication Board",
    short_name: "Communication Board",
    description: "Communication Board PWA",
    start_url: "/topics",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#111111",
    icons: [
      { src: "/images/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/images/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
