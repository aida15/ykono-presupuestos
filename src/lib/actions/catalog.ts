"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getMember } from "@/lib/auth";
import { ExternalTreatment, PriceStatus, PricingMethod } from "@/lib/domain/schemas";
import { run, type ActionResult } from "./result";

const lines = (v: string | undefined) =>
  (v ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

const ServiceInput = z.object({
  name: z.string().trim().min(1, "Nombre obligatorio").max(200),
  category_id: z.string().uuid().nullable(),
  unit: z.string().trim().min(1).max(40),
  commercial_description: z.string().max(2000),
  internal_description: z.string().max(2000),
  is_external_cost: z.boolean(),
  default_external_treatment: ExternalTreatment.nullable(),
  is_optional_default: z.boolean(),
  default_exclusions: z.array(z.string().max(300)),
  default_deliverables: z.array(z.string().max(300)),
  complements: z.array(z.string().uuid()),
  active: z.boolean(),
});

export async function saveService(id: string | null, _prev: unknown, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await run(async () => {
    const ctx = await getMember();
    const external = fd.get("is_external_cost") === "on";
    const data = ServiceInput.parse({
      name: fd.get("name"),
      category_id: (fd.get("category_id") as string) || null,
      unit: fd.get("unit"),
      commercial_description: fd.get("commercial_description") ?? "",
      internal_description: fd.get("internal_description") ?? "",
      is_external_cost: external,
      default_external_treatment: external ? (fd.get("default_external_treatment") as string) || "informative" : null,
      is_optional_default: fd.get("is_optional_default") === "on",
      default_exclusions: lines(fd.get("default_exclusions") as string),
      default_deliverables: lines(fd.get("default_deliverables") as string),
      complements: fd.getAll("complements").map(String),
      active: fd.get("active") === "on",
    });
    if (id) {
      const { error } = await ctx.supabase.from("services").update(data).eq("id", id).eq("studio_id", ctx.studioId);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await ctx.supabase.from("services").insert({ ...data, studio_id: ctx.studioId }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });
  revalidatePath("/catalogo");
  if (res.ok && !id) redirect(`/catalogo/servicios/${res.data.id}`);
  return res;
}

const eurosToCents = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : v;
}, z.number().int().min(0).nullable());

const RuleInput = z.object({
  method: PricingMethod,
  unit_price_cents: eurosToCents,
  hourly_rate_cents: eurosToCents,
  estimated_hours: eurosToCents, // mismas centésimas
  default_quantity: eurosToCents.transform((v) => v ?? 100),
  default_price_status: PriceStatus,
  notes: z.string().max(1000).nullable(),
  addons: z.array(z.object({ label: z.string().min(1).max(200), price: z.number().int().min(0), qty: z.number().int().min(0) })),
  complexity: z
    .object({
      levels: z.array(z.object({ key: z.string().min(1), label: z.string().min(1), factor_bp: z.number().int().min(0) })).min(1),
      default_level: z.string().optional(),
    })
    .nullable(),
});

/** Crea una versión nueva de la tarifa. Las versiones anteriores quedan intactas. */
export async function savePricingRule(serviceId: string, input: unknown): Promise<ActionResult<{ version: number }>> {
  const res = await run(async () => {
    const ctx = await getMember();
    const rule = RuleInput.parse(input);
    if (["fixed", "per_unit", "base_plus_addons", "complexity"].includes(rule.method) && rule.unit_price_cents == null) {
      throw new Error("Indica el precio base o unitario");
    }
    if (rule.method === "hourly" && (rule.hourly_rate_cents == null || rule.estimated_hours == null)) {
      throw new Error("Indica tarifa horaria y horas estimadas");
    }
    if (rule.method === "complexity" && !rule.complexity) throw new Error("Define al menos un nivel de complejidad");

    const { data: svc } = await ctx.supabase.from("services").select("id").eq("id", serviceId).eq("studio_id", ctx.studioId).single();
    if (!svc) throw new Error("Servicio no encontrado");

    const { data: last } = await ctx.supabase
      .from("pricing_rules")
      .select("id, version")
      .eq("service_id", serviceId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: current } = await ctx.supabase
      .from("pricing_rules")
      .select("id")
      .eq("service_id", serviceId)
      .eq("is_current", true)
      .maybeSingle();

    const version = (last?.version ?? 0) + 1;
    if (current) await ctx.supabase.from("pricing_rules").update({ is_current: false }).eq("id", current.id);
    const { error } = await ctx.supabase.from("pricing_rules").insert({
      ...rule,
      studio_id: ctx.studioId,
      service_id: serviceId,
      version,
      is_current: true,
    });
    if (error) {
      if (current) await ctx.supabase.from("pricing_rules").update({ is_current: true }).eq("id", current.id);
      throw new Error(error.message);
    }
    return { version };
  });
  revalidatePath(`/catalogo/servicios/${serviceId}`);
  revalidatePath("/catalogo");
  return res;
}

export async function toggleServiceActive(id: string, active: boolean): Promise<ActionResult> {
  const res = await run(async () => {
    const ctx = await getMember();
    const { error } = await ctx.supabase.from("services").update({ active }).eq("id", id).eq("studio_id", ctx.studioId);
    if (error) throw new Error(error.message);
    return undefined;
  });
  revalidatePath("/catalogo");
  revalidatePath(`/catalogo/servicios/${id}`);
  return res;
}

const CategoryInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).nullable(),
  parent_id: z.string().uuid().nullable(),
  sort_order: z.coerce.number().int(),
  active: z.boolean(),
});

export async function saveCategory(id: string | null, _prev: unknown, fd: FormData): Promise<ActionResult> {
  const res = await run(async () => {
    const ctx = await getMember();
    const data = CategoryInput.parse({
      name: fd.get("name"),
      description: (fd.get("description") as string) || null,
      parent_id: (fd.get("parent_id") as string) || null,
      sort_order: fd.get("sort_order") || 0,
      active: id ? fd.get("active") === "on" : true,
    });
    if (id) {
      const { error } = await ctx.supabase.from("service_categories").update(data).eq("id", id).eq("studio_id", ctx.studioId);
      if (error) throw new Error(error.message);
    } else {
      const slug =
        data.name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") + `-${Date.now().toString(36)}`;
      const { error } = await ctx.supabase.from("service_categories").insert({ ...data, slug, studio_id: ctx.studioId });
      if (error) throw new Error(error.message);
    }
    return undefined;
  });
  revalidatePath("/catalogo");
  return res;
}

const QuestionInput = z.object({
  discipline: z.string().min(1).max(40),
  question: z.string().trim().min(3).max(500),
  help_text: z.string().max(500).nullable(),
  answer_type: z.enum(["text", "number", "boolean", "choice", "multi"]),
  options: z.array(z.string().max(120)),
  service_id: z.string().uuid().nullable(),
  sort_order: z.coerce.number().int(),
  active: z.boolean(),
});

export async function saveQuestion(id: string | null, _prev: unknown, fd: FormData): Promise<ActionResult> {
  const res = await run(async () => {
    const ctx = await getMember();
    const data = QuestionInput.parse({
      discipline: fd.get("discipline"),
      question: fd.get("question"),
      help_text: (fd.get("help_text") as string) || null,
      answer_type: fd.get("answer_type") || "text",
      options: String(fd.get("options") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      service_id: (fd.get("service_id") as string) || null,
      sort_order: fd.get("sort_order") || 999,
      active: id ? fd.get("active") === "on" : true,
    });
    if (id) {
      const { error } = await ctx.supabase.from("service_questions").update(data).eq("id", id).eq("studio_id", ctx.studioId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await ctx.supabase.from("service_questions").insert({ ...data, studio_id: ctx.studioId });
      if (error) throw new Error(error.message);
    }
    return undefined;
  });
  revalidatePath("/catalogo");
  return res;
}

export async function deleteQuestion(id: string): Promise<ActionResult> {
  const res = await run(async () => {
    const ctx = await getMember();
    const { error } = await ctx.supabase.from("service_questions").delete().eq("id", id).eq("studio_id", ctx.studioId);
    if (error) throw new Error(error.message);
    return undefined;
  });
  revalidatePath("/catalogo");
  return res;
}
