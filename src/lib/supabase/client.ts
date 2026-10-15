"use client";
import { createBrowserClient } from "@supabase/ssr";

/** Cliente de navegador: solo para autenticación (login/logout). Los datos van por el servidor. */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
