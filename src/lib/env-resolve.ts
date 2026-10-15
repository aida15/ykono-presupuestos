/**
 * Resolución tolerante de las variables de Supabase. Sin dependencias para poder
 * usarse también desde next.config.ts.
 *
 * Acepta los nombres de la convención de Next.js, los de la integración de Supabase
 * en Vercel y las claves nuevas «publishable». Limpia espacios y comillas y añade
 * https:// si falta.
 */

export const URL_VARS = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"] as const;
export const KEY_VARS = [
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
] as const;

type Env = Record<string, string | undefined>;

const clean = (v: string | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "").trim();

export function normalizeUrl(raw: string | undefined): string {
  let v = clean(raw);
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  return v.replace(/\/+$/, "");
}

function firstSet(env: Env, names: readonly string[]) {
  for (const n of names) {
    const v = clean(env[n]);
    if (v) return { name: n, value: v };
  }
  return null;
}

export type SupabaseResolution = {
  url: string;
  anonKey: string;
  urlSource: string | null;
  keySource: string | null;
  problems: string[];
};

export function resolveSupabase(env: Env): SupabaseResolution {
  const u = firstSet(env, URL_VARS);
  const k = firstSet(env, KEY_VARS);
  const problems: string[] = [];
  const url = normalizeUrl(u?.value);

  if (!u) {
    problems.push(`No se encuentra la URL de Supabase. Crea la variable ${URL_VARS[1]} (o ${URL_VARS[0]}).`);
  } else {
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.includes(".")) throw new Error();
      if (parsed.pathname !== "/" && parsed.pathname !== "") {
        problems.push(`${u.name} debe ser solo la URL del proyecto (https://xxxx.supabase.co), sin rutas como ${parsed.pathname}.`);
      }
    } catch {
      problems.push(`${u.name} no es una URL válida. Debe tener la forma https://xxxx.supabase.co.`);
    }
  }

  if (!k) {
    problems.push(`No se encuentra la clave pública de Supabase. Crea la variable ${KEY_VARS[1]} (o ${KEY_VARS[0]}).`);
  } else if (k.value.length < 20) {
    problems.push(`${k.name} parece incompleta (demasiado corta). Copia la clave «anon» o «publishable» entera.`);
  }

  return {
    url: url.replace(/\/$/, ""),
    anonKey: k?.value ?? "",
    urlSource: u?.name ?? null,
    keySource: k?.name ?? null,
    problems,
  };
}
