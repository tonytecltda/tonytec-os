import type { MetadataRoute } from "next";

/** Permite "Adicionar à tela inicial" no celular: abre em tela cheia, como um aplicativo. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tonytec OS",
    short_name: "Tonytec OS",
    description: "Chamados e ordens de serviço — Tonytec Ltda",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#1a56b0",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
