import type { NextConfig } from "next";

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
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
