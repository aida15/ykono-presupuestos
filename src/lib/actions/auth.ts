"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseEnv } from "@/lib/env";

const LoginInput = z.object({
  email: z.string().trim().toLowerCase().email("Email no válido"),
  password: z.string().min(1, "Escribe la contraseña"),
  next: z.string().optional(),
});

/** Ruta interna segura a la que volver tras entrar (evita redirecciones abiertas). */
function safeNext(next: string | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/**
 * Inicio de sesión en el servidor: la sesión queda en cookies httpOnly y el
 * navegador no necesita conocer la configuración de Supabase.
 */
export async function signIn(_prev: unknown, fd: FormData): Promise<{ error: string } | null> {
  const parsed = LoginInput.safeParse({ email: fd.get("email"), password: fd.get("password"), next: fd.get("next") ?? undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };

  const supabase = await createSupabaseServerClient();
  let error: { message: string; status?: number } | null = null;
  try {
    ({ error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password }));
  } catch (e) {
    // Respuesta no JSON: la URL configurada no es la API de Supabase.
    const host = (() => {
      try {
        return new URL(supabaseEnv().url).host;
      } catch {
        return "desconocida";
      }
    })();
    console.error("[login]", e);
    return { error: `No se puede conectar con Supabase en ${host}. Revisa que SUPABASE_URL sea la «Project URL» (https://xxxx.supabase.co).` };
  }

  if (error) {
    if (error.message === "Invalid login credentials") return { error: "Email o contraseña incorrectos" };
    if (error.message.includes("Email not confirmed")) return { error: "La usuaria no está confirmada. En Supabase → Authentication → Users, confírmala." };
    if (error.message.includes("JSON") || error.message.includes("<!DOCTYPE")) {
      return { error: "La URL de Supabase no responde como Supabase. Revisa SUPABASE_URL (debe ser https://xxxx.supabase.co)." };
    }
    if (error.message.toLowerCase().includes("api key")) return { error: "La clave de Supabase no es válida. Revisa SUPABASE_ANON_KEY (clave «anon» o «publishable»)." };
    return { error: error.message };
  }
  redirect(safeNext(parsed.data.next));
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
