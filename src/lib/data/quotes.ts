import "server-only";
import { randomUUID } from "node:crypto";
import type { MemberContext } from "@/lib/auth";
import { QuoteDraft, toSaveBundle, type QuoteItemDraft } from "@/lib/domain/quote";
import { defaultPayments, defaultSections } from "@/lib/domain/templates";
import type { SectionContent } from "@/lib/domain/schemas";
import { getSettings } from "./settings";
import { num, type Client, type QuoteListRow } from "./types";

export type QuoteMeta = {
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
  valid_until: string;
  parent_quote_id: string | null;
  client: Client | null;
  project: { id: string; name: string } | null;
  client_snapshot: Client | null;
};

export async function loadQuote(ctx: MemberContext, id: string): Promise<{ draft: QuoteDraft; meta: QuoteMeta } | null> {
  const { data: q, error } = await ctx.supabase
    .from("quotes")
    .select(
      "*, client:clients(*), project:projects(id,name), quote_sections(*), quote_phases(*), quote_items(*), quote_payments(*)",
    )
    .eq("id", id)
    .eq("studio_id", ctx.studioId)
    .maybeSingle();
  if (error) throw error;
  if (!q) return null;

  const bySort = <T extends { sort_order: number }>(rows: T[] | null) => [...(rows ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  type Row = Record<string, unknown> & { sort_order: number };
  const draft: QuoteDraft = {
    id: q.id,
    number: q.number,
    version: q.version,
    status: q.status,
    client_id: q.client_id,
    project_id: q.project_id,
    title: q.title,
    subtitle: q.subtitle,
    addressee: q.addressee,
    issue_date: q.issue_date,
    validity_days: q.validity_days,
    vat_rate_bp: q.vat_rate_bp,
    global_discount_bp: q.global_discount_bp,
    payment_mode: q.payment_mode,
    payment_terms: q.payment_terms,
    conditions: q.conditions ?? [],
    exclusions: q.exclusions ?? [],
    notes_internal: q.notes_internal ?? "",
    sections: bySort(q.quote_sections as Row[]).map((s) => ({
      id: s.id as string,
      type: s.type as QuoteDraft["sections"][number]["type"],
      title: s.title as string,
      content: (s.content ?? {}) as SectionContent,
      visible: s.visible as boolean,
    })),
    phases: bySort(q.quote_phases as Row[]).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      description: (p.description as string) ?? "",
      deliverables: (p.deliverables as string[]) ?? [],
      timing: (p.timing as string) ?? "",
    })),
    items: bySort(q.quote_items as Row[]).map(
      (i): QuoteItemDraft => ({
        id: i.id as string,
        phase_id: (i.phase_id as string) ?? null,
        service_id: (i.service_id as string) ?? null,
        pricing_rule_id: (i.pricing_rule_id as string) ?? null,
        name: i.name as string,
        description: (i.description as string) ?? "",
        unit: (i.unit as string) ?? "ud.",
        method: i.method as QuoteItemDraft["method"],
        quantity: num(i.quantity) ?? 100,
        unit_price: num(i.unit_price_cents),
        hours: num(i.hours),
        hourly_rate: num(i.hourly_rate_cents),
        addons: ((i.addons as QuoteItemDraft["addons"]) ?? []).map((a) => ({ ...a, price: Number(a.price), qty: Number(a.qty) })),
        complexity_level: (i.complexity_level as string) ?? null,
        complexity_factor_bp: num(i.complexity_factor_bp),
        discount_bp: num(i.discount_bp) ?? 0,
        vat_rate_bp: num(i.vat_rate_bp),
        kind: (i.kind as "own" | "external") ?? "own",
        external_treatment: (i.external_treatment as QuoteItemDraft["external_treatment"]) ?? null,
        price_status: i.price_status as QuoteItemDraft["price_status"],
        is_optional: Boolean(i.is_optional),
        optional_included: Boolean(i.optional_included),
        rule_snapshot: (i.rule_snapshot as Record<string, unknown>) ?? null,
      }),
    ),
    payments: bySort(q.quote_payments as Row[]).map((p) => ({
      id: p.id as string,
      label: p.label as string,
      milestone: (p.milestone as string) ?? "",
      due_hint: (p.due_hint as string) ?? "",
      planned_date: (p.planned_date as string) ?? null,
      percent_bp: num(p.percent_bp),
      amount: num(p.amount_cents),
    })),
  };

  return {
    draft: QuoteDraft.parse(draft),
    meta: {
      created_at: q.created_at,
      updated_at: q.updated_at,
      finalized_at: q.finalized_at,
      valid_until: q.valid_until,
      parent_quote_id: q.parent_quote_id,
      client: (q.client as Client) ?? null,
      project: (q.project as { id: string; name: string }) ?? null,
      client_snapshot: (q.client_snapshot as Client) ?? null,
    },
  };
}

/** Recalcula con el motor y guarda todo de forma atómica (RPC save_quote_bundle). */
export async function saveQuoteDraft(ctx: MemberContext, input: unknown) {
  const { bundle, totals, schedule } = toSaveBundle(input);
  const { error } = await ctx.supabase.rpc("save_quote_bundle", { p: bundle });
  if (error) throw new Error(error.message);
  return { totals, schedule };
}

export async function createQuote(
  ctx: MemberContext,
  opts: { clientId?: string | null; projectId?: string | null; title?: string },
): Promise<string> {
  const settings = await getSettings(ctx);
  const { data: number, error: e1 } = await ctx.supabase.rpc("next_quote_number", { p_studio_id: ctx.studioId });
  if (e1 || !number) throw new Error(e1?.message ?? "No se pudo numerar el presupuesto");

  const id = randomUUID();
  const { error: e2 } = await ctx.supabase.from("quotes").insert({
    id,
    studio_id: ctx.studioId,
    number,
    client_id: opts.clientId ?? null,
    project_id: opts.projectId ?? null,
    title: opts.title ?? "",
    validity_days: settings.default_validity_days,
    vat_rate_bp: settings.default_vat_rate_bp,
    payment_mode: settings.default_payment_mode,
    payment_terms: settings.default_payment_terms,
    conditions: settings.default_conditions,
    exclusions: settings.default_exclusions,
    created_by: ctx.userId,
  });
  if (e2) throw new Error(e2.message);

  const loaded = await loadQuote(ctx, id);
  if (!loaded) throw new Error("Presupuesto no encontrado tras crearlo");
  await saveQuoteDraft(ctx, {
    ...loaded.draft,
    sections: defaultSections(randomUUID),
    payments: defaultPayments(settings, randomUUID),
  });
  return id;
}

/**
 * Copia un presupuesto con ids nuevos. Si asNewVersion, conserva el número y sube la
 * versión (YK-2026-004 v2); si no, crea un número nuevo (duplicar).
 */
export async function copyQuote(ctx: MemberContext, sourceId: string, asNewVersion: boolean): Promise<string> {
  const source = await loadQuote(ctx, sourceId);
  if (!source) throw new Error("Presupuesto no encontrado");
  const s = source.draft;

  let number = s.number;
  let version = 1;
  if (asNewVersion) {
    const { data } = await ctx.supabase
      .from("quotes")
      .select("version")
      .eq("studio_id", ctx.studioId)
      .eq("number", s.number)
      .order("version", { ascending: false })
      .limit(1)
      .single();
    version = (data?.version ?? s.version) + 1;
  } else {
    const { data, error } = await ctx.supabase.rpc("next_quote_number", { p_studio_id: ctx.studioId });
    if (error || !data) throw new Error(error?.message ?? "No se pudo numerar");
    number = data as string;
  }

  const id = randomUUID();
  const { error } = await ctx.supabase.from("quotes").insert({
    id,
    studio_id: ctx.studioId,
    number,
    version,
    parent_quote_id: asNewVersion ? s.id : null,
    client_id: s.client_id,
    project_id: s.project_id,
    title: asNewVersion ? s.title : `${s.title} (copia)`,
    created_by: ctx.userId,
  });
  if (error) throw new Error(error.message);

  const phaseMap = new Map(s.phases.map((p) => [p.id, randomUUID()]));
  await saveQuoteDraft(ctx, {
    ...s,
    id,
    number,
    version,
    status: "draft",
    issue_date: new Date().toISOString().slice(0, 10),
    sections: s.sections.map((x) => ({ ...x, id: randomUUID() })),
    phases: s.phases.map((p) => ({ ...p, id: phaseMap.get(p.id)! })),
    items: s.items.map((i) => ({ ...i, id: randomUUID(), phase_id: i.phase_id ? (phaseMap.get(i.phase_id) ?? null) : null })),
    payments: s.payments.map((p) => ({ ...p, id: randomUUID() })),
  });
  return id;
}

export async function listQuotes(
  ctx: MemberContext,
  opts: { q?: string; status?: string; clientId?: string; limit?: number } = {},
): Promise<QuoteListRow[]> {
  let query = ctx.supabase
    .from("quotes")
    .select("id, number, version, status, title, issue_date, valid_until, total_cents, taxable_base_cents, updated_at, client:clients(id, trade_name)")
    .eq("studio_id", ctx.studioId)
    .order("updated_at", { ascending: false })
    .limit(opts.limit ?? 200);
  if (opts.status) query = query.eq("status", opts.status);
  if (opts.clientId) query = query.eq("client_id", opts.clientId);
  if (opts.q) {
    const term = opts.q.replace(/[%,()]/g, " ").trim();
    if (term) query = query.or(`title.ilike.%${term}%,number.ilike.%${term}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...(r as unknown as QuoteListRow),
    total_cents: num(r.total_cents) ?? 0,
    taxable_base_cents: num(r.taxable_base_cents) ?? 0,
  }));
}
