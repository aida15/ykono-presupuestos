import { z } from "zod";
import {
  Addon,
  ExternalTreatment,
  PaymentMode,
  PriceStatus,
  PricingMethod,
  QuoteStatus,
  SectionContent,
  SectionType,
} from "./schemas";
import { blockingIssues, computeQuote, type QuoteTotals } from "./pricing";
import { computePayments, type PaymentSchedule } from "./payments";

const id = z.string().min(1).max(64);

export const QuoteSectionDraft = z.object({
  id,
  type: SectionType,
  title: z.string().max(200),
  content: SectionContent,
  visible: z.boolean().default(true),
});
export type QuoteSectionDraft = z.infer<typeof QuoteSectionDraft>;

export const QuotePhaseDraft = z.object({
  id,
  name: z.string().max(200),
  description: z.string().max(2000).default(""),
  deliverables: z.array(z.string().max(300)).max(40).default([]),
  timing: z.string().max(120).default(""),
});
export type QuotePhaseDraft = z.infer<typeof QuotePhaseDraft>;

export const QuoteItemDraft = z.object({
  id,
  phase_id: z.string().nullable().default(null),
  service_id: z.string().nullable().default(null),
  pricing_rule_id: z.string().nullable().default(null),
  name: z.string().min(1, "La partida necesita un nombre").max(300),
  description: z.string().max(2000).default(""),
  unit: z.string().max(40).default("ud."),
  method: PricingMethod,
  quantity: z.number().int().min(0).default(100),
  unit_price: z.number().int().nullable().default(null),
  hours: z.number().int().min(0).nullable().default(null),
  hourly_rate: z.number().int().nullable().default(null),
  addons: z.array(Addon).default([]),
  complexity_level: z.string().nullable().default(null),
  complexity_factor_bp: z.number().int().min(0).nullable().default(null),
  discount_bp: z.number().int().min(0).max(10000).default(0),
  vat_rate_bp: z.number().int().min(0).max(10000).nullable().default(null),
  kind: z.enum(["own", "external"]).default("own"),
  external_treatment: ExternalTreatment.nullable().default(null),
  price_status: PriceStatus,
  is_optional: z.boolean().default(false),
  optional_included: z.boolean().default(false),
  /** copia de la regla de tarifa usada al añadir la partida (precio histórico) */
  rule_snapshot: z.record(z.string(), z.unknown()).nullable().default(null),
});
export type QuoteItemDraft = z.infer<typeof QuoteItemDraft>;

export const QuotePaymentDraft = z.object({
  id,
  label: z.string().max(200),
  milestone: z.string().max(500).default(""),
  due_hint: z.string().max(200).default(""),
  planned_date: z.string().nullable().default(null),
  percent_bp: z.number().int().min(0).max(10000).nullable().default(null),
  amount: z.number().int().min(0).nullable().default(null),
});
export type QuotePaymentDraft = z.infer<typeof QuotePaymentDraft>;

export const QuoteDraft = z.object({
  id,
  number: z.string(),
  version: z.number().int().min(1),
  status: QuoteStatus,
  client_id: z.string().nullable(),
  project_id: z.string().nullable(),
  title: z.string().max(200),
  subtitle: z.string().max(400).default(""),
  addressee: z.string().max(200).default(""),
  issue_date: z.string(),
  validity_days: z.number().int().min(1).max(365),
  vat_rate_bp: z.number().int().min(0).max(10000),
  global_discount_bp: z.number().int().min(0).max(10000).default(0),
  payment_mode: PaymentMode,
  payment_terms: z.string().max(1000).default(""),
  conditions: z.array(z.object({ title: z.string().max(120), text: z.string().max(1500) })).max(12).default([]),
  exclusions: z.array(z.string().max(300)).max(40).default([]),
  notes_internal: z.string().max(4000).default(""),
  sections: z.array(QuoteSectionDraft).max(40),
  phases: z.array(QuotePhaseDraft).max(20),
  items: z.array(QuoteItemDraft).max(150),
  payments: z.array(QuotePaymentDraft).max(20),
});
export type QuoteDraft = z.infer<typeof QuoteDraft>;

export type ComputedQuote = {
  totals: QuoteTotals;
  schedule: PaymentSchedule;
};

export function computeDraft(draft: Pick<QuoteDraft, "items" | "payments" | "vat_rate_bp" | "global_discount_bp" | "payment_mode">): ComputedQuote {
  const totals = computeQuote({
    lines: draft.items.map((i) => ({
      id: i.id,
      method: i.method,
      quantity: i.quantity,
      unit_price: i.unit_price,
      hours: i.hours,
      hourly_rate: i.hourly_rate,
      addons: i.addons,
      complexity_factor_bp: i.complexity_factor_bp,
      discount_bp: i.discount_bp,
      vat_rate_bp: i.vat_rate_bp,
      kind: i.kind,
      external_treatment: i.external_treatment,
      price_status: i.price_status,
      is_optional: i.is_optional,
      optional_included: i.optional_included,
    })),
    defaultVatBp: draft.vat_rate_bp,
    globalDiscountBp: draft.global_discount_bp,
  });
  const schedule = computePayments(draft.payment_mode, draft.payments, totals.netAgreed, totals.total);
  return { totals, schedule };
}

export type ClientForValidation = {
  trade_name: string | null;
  legal_name: string | null;
  tax_id: string | null;
  address_line: string | null;
  city: string | null;
} | null;

export type ValidationProblem = { scope: "client" | "quote" | "item" | "payment"; message: string; ref?: string };

/** Comprueba que el presupuesto se puede marcar como definitivo o exportar a PDF. */
export function validateForFinalize(draft: QuoteDraft, client: ClientForValidation): ValidationProblem[] {
  const problems: ValidationProblem[] = [];
  const { totals, schedule } = computeDraft(draft);

  if (!client) {
    problems.push({ scope: "client", message: "Asigna un cliente al presupuesto" });
  } else {
    if (!client.legal_name && !client.trade_name)
      problems.push({ scope: "client", message: "Falta el nombre o la razón social del cliente" });
    if (!client.tax_id) problems.push({ scope: "client", message: "Falta el NIF/CIF del cliente" });
    if (!client.address_line || !client.city)
      problems.push({ scope: "client", message: "Falta la dirección fiscal del cliente" });
  }

  if (!draft.title.trim()) problems.push({ scope: "quote", message: "El presupuesto necesita un título" });

  const counted = Object.values(totals.lines).filter((l) => ["own", "resale", "suplido"].includes(l.bucket));
  if (counted.length === 0) problems.push({ scope: "quote", message: "No hay ninguna partida incluida en el total" });

  for (const issue of blockingIssues(totals)) {
    const item = issue.lineId ? draft.items.find((i) => i.id === issue.lineId) : undefined;
    problems.push({
      scope: issue.lineId ? "item" : "quote",
      message: item ? `«${item.name}»: ${issue.message.toLowerCase()}` : issue.message,
      ref: issue.lineId,
    });
  }
  for (const issue of schedule.issues) problems.push({ scope: "payment", message: issue.message });

  return problems;
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDateES(isoDate: string, style: "long" | "short" = "long"): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "UTC",
    ...(style === "long" ? { day: "numeric", month: "long", year: "numeric" } : { day: "2-digit", month: "2-digit", year: "numeric" }),
  }).format(d);
}

/** Subtotal (neto, sin IVA) de cada fase con las partidas que cuentan para el total. */
export function phaseSubtotals(draft: Pick<QuoteDraft, "phases" | "items">, totals: QuoteTotals): Map<string | null, number> {
  const out = new Map<string | null, number>();
  for (const item of draft.items) {
    const r = totals.lines[item.id];
    if (!r || r.net == null || !["own", "resale", "suplido"].includes(r.bucket)) continue;
    const key = item.phase_id && draft.phases.some((p) => p.id === item.phase_id) ? item.phase_id : null;
    out.set(key, (out.get(key) ?? 0) + r.net);
  }
  return out;
}

/** Paquete que recibe la función SQL save_quote_bundle: borrador + importes calculados. */
export function toSaveBundle(input: unknown) {
  const draft = QuoteDraft.parse(input);
  const { totals, schedule } = computeDraft(draft);
  const payments = draft.payments.map((p) => {
    const r = schedule.payments.find((x) => x.id === p.id);
    return { ...p, net: r?.net ?? null, total: r?.total ?? null };
  });
  return {
    bundle: { ...draft, payments, totals: { ...totals, schedule: { sumNet: schedule.sumNet, sumTotal: schedule.sumTotal, issues: schedule.issues } } },
    totals,
    schedule,
  };
}
