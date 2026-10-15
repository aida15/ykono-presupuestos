import "server-only";
import type { MemberContext } from "@/lib/auth";
import type { StudioSettings } from "./types";

export async function getSettings(ctx: MemberContext): Promise<StudioSettings> {
  const { data, error } = await ctx.supabase
    .from("studio_settings")
    .select("*")
    .eq("studio_id", ctx.studioId)
    .single();
  if (error || !data) throw new Error("No se encontró la configuración del estudio. ¿Has ejecutado supabase/seed.sql?");
  return data as StudioSettings;
}
