import { resolveSupabase } from "./env-resolve";

/**
 * Configuración de Supabase (URL y clave pública; nunca la service role).
 * Ver env-resolve.ts para los nombres de variable aceptados.
 */
function current() {
  // Acceso explícito para que el bundler no elimine ninguna variable.
  return resolveSupabase({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  });
}

export function supabaseEnv() {
  const r = current();
  if (r.problems.length) throw new Error(`Configuración de Supabase incompleta: ${r.problems.join(" ")}`);
  return { url: r.url, anonKey: r.anonKey };
}

export function isSupabaseConfigured(): boolean {
  return current().problems.length === 0;
}

/** Diagnóstico sin valores secretos, para la pantalla de puesta en marcha. */
export function supabaseDiagnostics() {
  const r = current();
  let host: string | null = null;
  try {
    host = r.url ? new URL(r.url).host : null;
  } catch {
    host = null;
  }
  return { urlSource: r.urlSource, keySource: r.keySource, host, problems: r.problems, vercelEnv: process.env.VERCEL_ENV ?? null };
}
