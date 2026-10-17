import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return "*.supabase.co";
  }
})();

// Premissa: app 100% autenticado e dinâmico. cacheComponents/partialPrefetching
// ficam desligados para não exigir <Suspense> em toda leitura de sessão.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    // Logo da empresa (bucket público "empresa" do Supabase Storage).
    remotePatterns: [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }],
  },
  experimental: {
    serverActions: {
      // Arquivos grandes (fotos/vídeos) vão direto ao Storage por URL assinada;
      // pela Server Action só passam arquivos pequenos (ex.: logo). A Vercel limita a 4,5 MB.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
