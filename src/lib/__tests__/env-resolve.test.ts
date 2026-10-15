import { describe, expect, it } from "vitest";
import { resolveSupabase } from "../env-resolve";

const KEY = "eyJhbGciOiJIUzI1NiJ9.payload.signature";

describe("resolveSupabase", () => {
  it("acepta los nombres de la integración de Vercel", () => {
    const r = resolveSupabase({ SUPABASE_URL: "https://abc.supabase.co", SUPABASE_ANON_KEY: KEY });
    expect(r.problems).toEqual([]);
    expect(r.url).toBe("https://abc.supabase.co");
  });

  it("prioriza NEXT_PUBLIC_ y acepta claves publishable", () => {
    const r = resolveSupabase({ NEXT_PUBLIC_SUPABASE_URL: "https://a.supabase.co", SUPABASE_URL: "https://b.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_1234567890abcdef" });
    expect(r.url).toBe("https://a.supabase.co");
    expect(r.keySource).toBe("SUPABASE_PUBLISHABLE_KEY");
    expect(r.problems).toEqual([]);
  });

  it("limpia comillas, espacios, barra final y añade https://", () => {
    const r = resolveSupabase({ SUPABASE_URL: ' "abc.supabase.co/" ', SUPABASE_ANON_KEY: ` ${KEY}\n` });
    expect(r.url).toBe("https://abc.supabase.co");
    expect(r.anonKey).toBe(KEY);
    expect(r.problems).toEqual([]);
  });

  it("explica qué falta o está mal", () => {
    expect(resolveSupabase({}).problems).toHaveLength(2);
    expect(resolveSupabase({ SUPABASE_URL: "https://abc.supabase.co/rest/v1", SUPABASE_ANON_KEY: KEY }).problems[0]).toMatch(/sin rutas/);
    expect(resolveSupabase({ SUPABASE_URL: "https://abc.supabase.co", SUPABASE_ANON_KEY: "corta" }).problems[0]).toMatch(/incompleta/);
  });
});
