import { z } from "zod";

/**
 * Configuración de Supabase. Acepta los dos juegos de nombres:
 *  - NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (convención de Next.js)
 *  - SUPABASE_URL / SUPABASE_ANON_KEY (los que crea la integración de Supabase en Vercel)
 * next.config.ts copia los segundos en los primeros al compilar, para que el
 * navegador (login) también los tenga. Solo URL y clave anónima: nunca la service role.
 */
const SupabaseEnv = z.object({
  url: z.string().url(),
  anonKey: z.string().min(20),
});

function read() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
  };
}

export function supabaseEnv() {
  const parsed = SupabaseEnv.safeParse(read());
  if (!parsed.success) {
    throw new Error("Faltan SUPABASE_URL y SUPABASE_ANON_KEY (o sus versiones NEXT_PUBLIC_). Revisa las variables de entorno.");
  }
  return parsed.data;
}

export function isSupabaseConfigured(): boolean {
  return SupabaseEnv.safeParse(read()).success;
}
