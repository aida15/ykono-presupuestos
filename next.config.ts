import type { NextConfig } from "next";

/**
 * Cache Components queda desactivado a propósito: toda la aplicación es privada y
 * cada vista depende de la sesión de Supabase (cookies), así que no hay shell estático
 * que aprovechar. Renderizado dinámico por petición = modelo más simple y seguro.
 */
const nextConfig: NextConfig = {
  cacheComponents: false,
  // La integración de Supabase en Vercel crea SUPABASE_URL / SUPABASE_ANON_KEY.
  // El login se hace en el navegador, así que se exponen con el prefijo público.
  // La clave anónima es pública por diseño (la seguridad la da RLS); nunca se expone la service role.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "",
  },
  // react-pdf usa módulos nativos de Node (fontkit, yoga); se ejecuta solo en servidor.
  serverExternalPackages: ["@react-pdf/renderer"],
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
