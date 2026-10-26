import "server-only";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth";

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

/** Ejecuta una acción de servidor y convierte errores en mensajes legibles (sin filtrar trazas). */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    // redirect()/notFound() de Next se relanzan.
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    if (e instanceof AuthError) return { ok: false, error: e.message };
    if (e instanceof ZodError) {
      const first = e.issues[0];
      return { ok: false, error: first ? `${first.path.join(".") || "Datos"}: ${first.message}` : "Datos no válidos" };
    }
    console.error("[action]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}
