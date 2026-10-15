import type { QuoteItemDraft } from "./quote";
import type { ServiceWithRule } from "@/lib/data/types";

/**
 * Crea una partida de presupuesto a partir de un servicio del catálogo y su tarifa vigente.
 * Copia la tarifa en rule_snapshot: si el catálogo cambia después, el presupuesto conserva
 * el precio con el que se preparó.
 */
export function itemFromService(
  service: ServiceWithRule,
  opts: { id: string; phaseId?: string | null; quantity?: number; complexityLevel?: string | null; optional?: boolean } ,
): QuoteItemDraft {
  const rule = service.rule;
  const external = service.is_external_cost || rule?.method === "external";
  const level =
    rule?.complexity?.levels.find((l) => l.key === (opts.complexityLevel ?? rule.complexity?.default_level)) ??
    rule?.complexity?.levels[0] ??
    null;

  return {
    id: opts.id,
    phase_id: opts.phaseId ?? null,
    service_id: service.id,
    pricing_rule_id: rule?.id ?? null,
    name: service.name,
    description: service.commercial_description ?? "",
    unit: service.unit,
    method: rule?.method ?? "manual",
    quantity: opts.quantity ?? rule?.default_quantity ?? 100,
    unit_price: rule?.unit_price_cents ?? null,
    hours: rule?.estimated_hours ?? null,
    hourly_rate: rule?.hourly_rate_cents ?? null,
    addons: (rule?.addons ?? []).map((a) => ({ ...a })),
    complexity_level: level?.key ?? null,
    complexity_factor_bp: level?.factor_bp ?? null,
    discount_bp: 0,
    vat_rate_bp: null,
    kind: external ? "external" : "own",
    external_treatment: external ? (service.default_external_treatment ?? "informative") : null,
    // Sin tarifa en catálogo → pendiente de valoración, nunca un precio inventado.
    price_status: rule ? rule.default_price_status : "pending_valuation",
    is_optional: opts.optional ?? service.is_optional_default,
    optional_included: false,
    rule_snapshot: rule
      ? {
          rule_id: rule.id,
          version: rule.version,
          method: rule.method,
          unit_price_cents: rule.unit_price_cents,
          hourly_rate_cents: rule.hourly_rate_cents,
          estimated_hours: rule.estimated_hours,
          addons: rule.addons,
          complexity: rule.complexity,
          service_name: service.name,
          captured_at: new Date().toISOString(),
        }
      : null,
  };
}
