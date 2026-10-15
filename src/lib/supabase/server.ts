import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "@/lib/env";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * Usa la sesión de la usuaria (cookies) y la clave anónima: todas las consultas
 * pasan por RLS. La aplicación nunca usa la service role key.
 */
export async function createSupabaseServerClient() {
  // cookies() primero: marca la ruta como dinámica antes de validar el entorno.
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Desde un Server Component no se pueden escribir cookies; el proxy refresca la sesión.
        }
      },
    },
  });
}

export type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServerClient>>;
