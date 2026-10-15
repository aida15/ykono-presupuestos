import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Enumeraciones de negocio                                            */
/* ------------------------------------------------------------------ */

export const PRICING_METHODS = [
  "fixed",
  "per_unit",
  "hourly",
  "base_plus_addons",
  "complexity",
  "manual",
  "external",
] as const;
export const PricingMethod = z.enum(PRICING_METHODS);
export type PricingMethod = z.infer<typeof PricingMethod>;

export const PRICING_METHOD_LABEL: Record<PricingMethod, string> = {
  fixed: "Precio fijo",
  per_unit: "Precio por unidad",
  hourly: "Por horas",
  base_plus_addons: "Base + complementos",
  complexity: "Por complejidad",
  manual: "Precio manual",
  external: "Coste externo",
};

export const PRICE_STATUSES = [
  "approved_rate",
  "estimate_pending",
  "manual_approved",
  "pending_valuation",
] as const;
export const PriceStatus = z.enum(PRICE_STATUSES);
export type PriceStatus = z.infer<typeof PriceStatus>;

export const PRICE_STATUS_LABEL: Record<PriceStatus, string> = {
  approved_rate: "Tarifa aprobada",
  estimate_pending: "Estimación pendiente de aprobación",
  manual_approved: "Precio manual aprobado",
  pending_valuation: "Pendiente de valoración",
};

/**
 * Tratamiento fiscal de los costes de terceros.
 * - informative: el cliente lo contrata y paga directamente (p. ej. licencias "a vuestro nombre").
 *   Se muestra en el documento pero NO suma al total. Es el comportamiento de los presupuestos de referencia.
 * - resale: YKONO lo compra y lo refactura. Suma a la base imponible y lleva IVA.
 * - suplido: YKONO lo paga en nombre del cliente y lo repercute sin IVA (art. 78.Tres.3.º LIVA).
 *   Suma al total, pero fuera de la base imponible.
 */
export const EXTERNAL_TREATMENTS = ["informative", "resale", "suplido"] as const;
export const ExternalTreatment = z.enum(EXTERNAL_TREATMENTS);
export type ExternalTreatment = z.infer<typeof ExternalTreatment>;

export const EXTERNAL_TREATMENT_LABEL: Record<ExternalTreatment, string> = {
  informative: "Informativo (lo paga el cliente directamente)",
  resale: "Refacturado con IVA",
  suplido: "Suplido (sin IVA)",
};

export const QUOTE_STATUSES = ["draft", "ready", "sent", "accepted", "rejected", "archived"] as const;
export const QuoteStatus = z.enum(QUOTE_STATUSES);
export type QuoteStatus = z.infer<typeof QuoteStatus>;

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: "Borrador",
  ready: "Definitivo",
  sent: "Enviado",
  accepted: "Aceptado",
  rejected: "Rechazado",
  archived: "Archivado",
};

export const SECTION_TYPES = [
  "cover",
  "summary",
  "starting_point",
  "objectives",
  "solution",
  "services",
  "phases",
  "methodology",
  "timeline",
  "client_responsibilities",
  "exclusions",
  "investment",
  "payment",
  "conditions",
  "closing",
  "custom",
] as const;
export const SectionType = z.enum(SECTION_TYPES);
export type SectionType = z.infer<typeof SectionType>;

export const SECTION_TYPE_LABEL: Record<SectionType, string> = {
  cover: "Portada",
  summary: "Resumen del proyecto",
  starting_point: "Punto de partida",
  objectives: "Objetivos",
  solution: "Solución propuesta",
  services: "Servicios y entregables",
  phases: "Fases de trabajo",
  methodology: "Metodología y revisiones",
  timeline: "Calendario",
  client_responsibilities: "Responsabilidades del cliente",
  exclusions: "Exclusiones y costes externos",
  investment: "Inversión",
  payment: "Forma de pago",
  conditions: "Condiciones",
  closing: "Contacto y cierre",
  custom: "Sección libre",
};

/** Secciones cuyo contenido principal sale de los datos (partidas, fases, pagos), no del texto. */
export const DATA_DRIVEN_SECTIONS: ReadonlySet<SectionType> = new Set([
  "cover",
  "phases",
  "investment",
  "payment",
  "exclusions",
]);

/* ------------------------------------------------------------------ */
/* Contenido de secciones                                             */
/* ------------------------------------------------------------------ */

export const SectionCard = z.object({
  title: z.string().max(200),
  text: z.string().max(2000).default(""),
});
export type SectionCard = z.infer<typeof SectionCard>;

export const SectionContent = z.object({
  /** Antetítulo en versalitas (p. ej. "PUNTO DE PARTIDA"). */
  kicker: z.string().max(80).optional(),
  /** Párrafos separados por línea en blanco. */
  body: z.string().max(8000).optional(),
  bullets: z.array(z.string().max(500)).max(30).optional(),
  cards: z.array(SectionCard).max(12).optional(),
  /** Nota al pie en cursiva. */
  note: z.string().max(1000).optional(),
});
export type SectionContent = z.infer<typeof SectionContent>;

/* ------------------------------------------------------------------ */
/* Partidas y reglas de precio                                        */
/* ------------------------------------------------------------------ */

export const Addon = z.object({
  label: z.string().max(200),
  /** céntimos */
  price: z.number().int(),
  /** centésimas */
  qty: z.number().int().min(0).default(100),
});
export type Addon = z.infer<typeof Addon>;

export const ComplexityLevel = z.object({
  key: z.string(),
  label: z.string(),
  /** multiplicador en puntos básicos (10000 = x1) */
  factor_bp: z.number().int().min(0),
});
export type ComplexityLevel = z.infer<typeof ComplexityLevel>;

export const ComplexityConfig = z.object({
  levels: z.array(ComplexityLevel).min(1),
  default_level: z.string().optional(),
});
export type ComplexityConfig = z.infer<typeof ComplexityConfig>;

/** Datos de entrada de una partida para el motor de precios. */
export const PricingLineInput = z.object({
  id: z.string(),
  method: PricingMethod,
  /** centésimas; 100 = 1 unidad */
  quantity: z.number().int().min(0).default(100),
  /** céntimos: precio unitario (per_unit/manual/external) o precio fijo (fixed) o base (base_plus_addons/complexity) */
  unit_price: z.number().int().nullable().default(null),
  /** centésimas de hora */
  hours: z.number().int().min(0).nullable().default(null),
  hourly_rate: z.number().int().nullable().default(null),
  addons: z.array(Addon).default([]),
  complexity_factor_bp: z.number().int().min(0).nullable().default(null),
  discount_bp: z.number().int().min(0).max(10000).default(0),
  /** null = usa el IVA por defecto del presupuesto */
  vat_rate_bp: z.number().int().min(0).max(10000).nullable().default(null),
  kind: z.enum(["own", "external"]).default("own"),
  external_treatment: ExternalTreatment.nullable().default(null),
  price_status: PriceStatus,
  is_optional: z.boolean().default(false),
  optional_included: z.boolean().default(false),
});
export type PricingLineInput = z.input<typeof PricingLineInput>;
export type PricingLine = z.output<typeof PricingLineInput>;

export const PAYMENT_MODES = ["percent", "fixed"] as const;
export const PaymentMode = z.enum(PAYMENT_MODES);
export type PaymentMode = z.infer<typeof PaymentMode>;

export const PaymentInput = z.object({
  id: z.string(),
  label: z.string().max(200),
  milestone: z.string().max(500).default(""),
  due_hint: z.string().max(200).default(""),
  planned_date: z.string().nullable().default(null),
  /** puntos básicos sobre el total (modo percent) */
  percent_bp: z.number().int().min(0).max(10000).nullable().default(null),
  /** base imponible del pago en céntimos (modo fixed) */
  amount: z.number().int().min(0).nullable().default(null),
});
export type PaymentInput = z.input<typeof PaymentInput>;
