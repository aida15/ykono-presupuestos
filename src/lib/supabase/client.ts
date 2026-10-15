"use client";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de navegador: solo para autenticación (login/logout). Los datos van por el servidor.
 * Los valores se incrustan al compilar desde next.config.ts (admite SUPABASE_URL o NEXT_PUBLIC_SUPABASE_URL).
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
