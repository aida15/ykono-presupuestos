"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMember } from "@/lib/auth";
import { PaymentMode } from "@/lib/domain/schemas";
import { run, type ActionResult } from "./result";

const nullable = z
  .string()
  .trim()
  .max(300)
  .transform((v) => (v === "" ? null : v))
  .nullable();

const pct = z.preprocess((v) => Math.round(Number(String(v).replace(",", ".")) * 100), z.number().int().min(0).max(10000));

const SettingsInput = z.object({
  product_name: z.string().trim().min(1).max(80),
  trade_name: z.string().trim().min(1).max(120),
  tagline: z.string().trim().max(120),
  legal_name: nullable,
  tax_id: nullable,
  address_line: nullable,
  postal_code: nullable,
  city: nullable,
  province: nullable,
  phone: nullable,
  email: nullable,
  website: nullable,
  quote_prefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,6}$/, "Prefijo: 1-6 letras o números"),
  default_vat_rate_bp: pct,
  default_validity_days: z.coerce.number().int().min(1).max(365),
  default_payment_mode: PaymentMode,
  default_payment_terms: z.string().max(1000),
  closing_text: z.string().max(500),
  ai_enabled: z.boolean(),
  ai_model_interview: z.string().trim().min(1).max(80),
  ai_model_drafting: z.string().trim().min(1).max(80),
  archive_pdfs: z.boolean(),
  default_payments: z.array(
    z.object({ label: z.string().min(1).max(120), milestone: z.string().max(300), percent_bp: z.number().int().min(0).max(10000) }),
  ),
  default_conditions: z.array(z.object({ title: z.string().min(1).max(120), text: z.string().min(1).max(1500) })),
  default_exclusions: z.array(z.string().max(300)),
  pdf_preferences: z.object({
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    show_cover: z.boolean(),
    show_closing: z.boolean(),
  }),
});

export async function saveSettings(input: unknown): Promise<ActionResult> {
  const res = await run(async () => {
    const ctx = await getMember();
    const data = SettingsInput.parse(input);
    const sum = data.default_payments.reduce((a, p) => a + p.percent_bp, 0);
    if (data.default_payment_mode === "percent" && data.default_payments.length && sum !== 10000) {
      throw new Error("Los pagos por defecto deben sumar 100 %");
    }
    const { error } = await ctx.supabase
      .from("studio_settings")
      .update({ ...data, default_payments: data.default_payments.map((p) => ({ ...p, due_hint: "" })) })
      .eq("studio_id", ctx.studioId);
    if (error) throw new Error(error.message);
    return undefined;
  });
  revalidatePath("/", "layout");
  return res;
}

export async function uploadLogo(fd: FormData): Promise<ActionResult> {
  const res = await run(async () => {
    const ctx = await getMember();
    const file = fd.get("logo");
    if (!(file instanceof File) || file.size === 0) throw new Error("Selecciona un archivo");
    if (!["image/png", "image/jpeg"].includes(file.type)) throw new Error("El logotipo para el PDF debe ser PNG o JPG");
    if (file.size > 2 * 1024 * 1024) throw new Error("Máximo 2 MB");
    const ext = file.type === "image/png" ? "png" : "jpg";
    const path = `${ctx.studioId}/logo-${Date.now()}.${ext}`;
    const { error } = await ctx.supabase.storage.from("brand").upload(path, file, { contentType: file.type, upsert: true });
    if (error) throw new Error(error.message);
    const { error: e2 } = await ctx.supabase.from("studio_settings").update({ logo_path: path }).eq("studio_id", ctx.studioId);
    if (e2) throw new Error(e2.message);
    return undefined;
  });
  revalidatePath("/configuracion");
  return res;
}

export async function resetLogo(): Promise<ActionResult> {
  const res = await run(async () => {
    const ctx = await getMember();
    const { error } = await ctx.supabase.from("studio_settings").update({ logo_path: null }).eq("studio_id", ctx.studioId);
    if (error) throw new Error(error.message);
    return undefined;
  });
  revalidatePath("/configuracion");
  return res;
}
