import { formatEUR, formatHundredths } from "./money";
import type { PricingMethod } from "./schemas";

type RuleLike = {
  method: PricingMethod;
  unit_price_cents?: number | null;
  unit_price?: number | null;
  hourly_rate_cents?: number | null;
  hourly_rate?: number | null;
  estimated_hours?: number | null;
  hours?: number | null;
  addons?: { label: string; price: number }[];
  complexity?: { levels: { label: string; factor_bp: number }[] } | null;
};

/** Resumen legible de una tarifa: "220 € / plantilla", "55 €/h · 10 h estimadas"… */
export function describeRule(rule: RuleLike, unit = "ud."): string {
  const price = rule.unit_price_cents ?? rule.unit_price ?? null;
  const rate = rule.hourly_rate_cents ?? rule.hourly_rate ?? null;
  const hours = rule.estimated_hours ?? rule.hours ?? null;
  const e = (c: number) => formatEUR(c, { compact: true });
  switch (rule.method) {
    case "fixed":
      return price == null ? "Sin precio" : `${e(price)} precio fijo`;
    case "per_unit":
      return price == null ? "Sin precio" : `${e(price)} / ${unit}`;
    case "hourly":
      return rate == null ? "Sin tarifa" : `${e(rate)}/h${hours != null ? ` · ${formatHundredths(hours)} h estimadas` : ""}`;
    case "base_plus_addons":
      return price == null
        ? "Sin precio"
        : `${e(price)} base${rule.addons?.length ? ` + ${rule.addons.length} complemento${rule.addons.length > 1 ? "s" : ""}` : ""}`;
    case "complexity": {
      if (price == null) return "Sin precio";
      const f = rule.complexity?.levels.map((l) => l.factor_bp) ?? [10000];
      const min = Math.min(...f);
      const max = Math.max(...f);
      return min === max ? `${e(price)}` : `${e(Math.round((price * min) / 10000))} – ${e(Math.round((price * max) / 10000))} según complejidad`;
    }
    case "manual":
      return price == null ? "Precio manual" : `${e(price)} (manual)`;
    case "external":
      return price == null ? "Coste de terceros · a determinar" : `${e(price)} coste de terceros`;
  }
}
