import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return "*.supabase.co";
  }
})();

const dev = process.env.NODE_ENV !== "production";

// CSP: o Next injeta scripts inline (hidratação, tema), então 'unsafe-inline' em script-src é necessário
// sem nonce por request. O resto fica restrito à própria origem e ao Supabase.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://${supabaseHost}`,
  "font-src 'self' data:",
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=()" },
  // Sistema interno: nada de indexação.
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

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
  // Bibliotecas com dependências nativas/dinâmicas ficam fora do bundle do servidor.
  serverExternalPackages: ["exceljs"],
  images: {
    // Logo da empresa (bucket público "empresa" do Supabase Storage).
    remotePatterns: [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // O token do link de assinatura/acesso está na URL: não vaza em Referer e não fica em cache.
      {
        source: "/assinar/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/acesso",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
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
