/**
 * Motor de precios determinista de YKONO Quote Studio.
 *
 * Es la ÚNICA fuente de verdad para importes: lo usan el editor (vista en vivo), las
 * acciones de servidor (que recalculan y guardan el snapshot) y la plantilla PDF (que
 * solo pinta el snapshot guardado). La IA nunca calcula ni escribe importes.
 *
 * Orden de aplicación (ver docs/motor-de-precios.md):
 *  1. Importe bruto de cada partida según su método.
 *  2. Descuento de partida (pb) → neto de partida.
 *  3. Se separan partidas opcionales no incluidas, costes externos y trabajo propio.
 *  4. Descuento global (pb) SOLO sobre el trabajo propio incluido.
 *  5. Base imponible = trabajo propio − descuento global + externos refacturados.
 *  6. IVA por tipo impositivo, sobre cada grupo de base.
 *  7. Total = base imponible + IVA + suplidos. Los externos informativos no suman.
 * Cada operación redondea al céntimo (half away from zero) una sola vez.
 */
import { applyBp, divRound, mulHundredths, type BasisPoints, type Cents } from "./money";
import { PricingLineInput, type PricingLine, type PricingLineInput as LineIn } from "./schemas";

export type LineResult = {
  id: string;
  /** null = no se puede calcular (pendiente de valoración o faltan datos) */
  gross: Cents | null;
  discount: Cents;
  net: Cents | null;
  vatRateBp: BasisPoints;
  bucket: "own" | "resale" | "suplido" | "informative" | "optional_excluded";
  /** importe neto + IVA, para mostrar opcionales e informativos */
  netWithVat: Cents | null;
};

export type VatGroup = { rateBp: BasisPoints; base: Cents; vat: Cents };

export type QuoteIssue = {
  code:
    | "pending_valuation"
    | "estimate_pending"
    | "missing_price"
    | "payments_percent_mismatch"
    | "payments_amount_mismatch"
    | "payments_missing"
    | "negative_total";
  message: string;
  lineId?: string;
  paymentId?: string;
};

export type QuoteTotals = {
  lines: Record<string, LineResult>;
  ownGross: Cents;
  lineDiscounts: Cents;
  ownSubtotal: Cents;
  globalDiscountBp: BasisPoints;
  globalDiscount: Cents;
  resaleSubtotal: Cents;
  taxableBase: Cents;
  vatGroups: VatGroup[];
  vatTotal: Cents;
  suplidos: Cents;
  /** total a pagar con impuestos */
  total: Cents;
  /** importe sin IVA sobre el que se reparte el calendario de pagos (base + suplidos) */
  netAgreed: Cents;
  optionalExcluded: { net: Cents; netWithVat: Cents; count: number };
  informativeExternal: { net: Cents; count: number };
  issues: QuoteIssue[];
};

export type QuoteInput = {
  lines: LineIn[];
  defaultVatBp: BasisPoints;
  globalDiscountBp?: BasisPoints;
};

/** Importe bruto de una partida, o null si no se puede determinar. */
export function lineGross(line: PricingLine): Cents | null {
  if (line.price_status === "pending_valuation") return null;
  const q = line.quantity;
  switch (line.method) {
    case "fixed":
    case "per_unit":
    case "manual":
    case "external":
      if (line.unit_price == null) return null;
      return mulHundredths(line.unit_price, q);
    case "hourly":
      if (line.hourly_rate == null || line.hours == null) return null;
      return mulHundredths(line.hourly_rate, line.hours);
    case "base_plus_addons": {
      if (line.unit_price == null) return null;
      const addons = line.addons.reduce((acc, a) => acc + mulHundredths(a.price, a.qty), 0);
      return mulHundredths(line.unit_price + addons, q);
    }
    case "complexity": {
      if (line.unit_price == null) return null;
      const factor = line.complexity_factor_bp ?? 10000;
      return mulHundredths(applyBp(line.unit_price, factor), q);
    }
  }
}

function bucketOf(line: PricingLine): LineResult["bucket"] {
  if (line.is_optional && !line.optional_included) return "optional_excluded";
  if (line.kind === "external" || line.method === "external") {
    return line.external_treatment ?? "informative";
  }
  return "own";
}

/**
 * Reparte `amount` entre pesos enteros de forma proporcional. La suma del resultado
 * es exactamente `amount`; la diferencia de redondeo va a la última posición con peso.
 */
export function allocateProportionally(amount: Cents, weights: number[]): Cents[] {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return weights.map(() => 0);
  const out = weights.map((w) => divRound(amount * w, totalWeight));
  const diff = amount - out.reduce((a, b) => a + b, 0);
  if (diff !== 0) {
    let last = weights.length - 1;
    while (last > 0 && weights[last] === 0) last--;
    out[last] += diff;
  }
  return out;
}

export function computeQuote(input: QuoteInput): QuoteTotals {
  const lines = input.lines.map((l) => PricingLineInput.parse(l));
  const globalDiscountBp = input.globalDiscountBp ?? 0;
  const issues: QuoteIssue[] = [];
  const results: Record<string, LineResult> = {};

  let ownGross = 0;
  let lineDiscounts = 0;
  let ownSubtotal = 0;
  let resaleSubtotal = 0;
  let suplidos = 0;
  const optionalExcluded = { net: 0, netWithVat: 0, count: 0 };
  const informativeExternal = { net: 0, count: 0 };

  // base de trabajo propio por tipo de IVA (antes del descuento global)
  const ownByRate = new Map<number, number>();
  const resaleByRate = new Map<number, number>();

  for (const line of lines) {
    const vatRateBp = line.vat_rate_bp ?? input.defaultVatBp;
    const bucket = bucketOf(line);
    const gross = lineGross(line);
    const discount = gross == null ? 0 : applyBp(gross, line.discount_bp);
    const net = gross == null ? null : gross - discount;
    const netWithVat =
      net == null ? null : bucket === "suplido" ? net : net + applyBp(net, vatRateBp);

    results[line.id] = { id: line.id, gross, discount, net, vatRateBp, bucket, netWithVat };

    // Incidencias: solo bloquean si la partida cuenta para el total o es opcional pendiente.
    if (line.price_status === "pending_valuation") {
      issues.push({ code: "pending_valuation", message: "Partida pendiente de valoración", lineId: line.id });
    } else if (gross == null) {
      issues.push({ code: "missing_price", message: "Faltan datos para calcular el precio", lineId: line.id });
    } else if (line.price_status === "estimate_pending") {
      issues.push({ code: "estimate_pending", message: "Estimación pendiente de aprobación", lineId: line.id });
    }

    if (net == null) continue;

    switch (bucket) {
      case "optional_excluded":
        optionalExcluded.net += net;
        optionalExcluded.netWithVat += netWithVat ?? net;
        optionalExcluded.count += 1;
        break;
      case "informative":
        informativeExternal.net += net;
        informativeExternal.count += 1;
        break;
      case "suplido":
        suplidos += net;
        break;
      case "resale":
        resaleSubtotal += net;
        resaleByRate.set(vatRateBp, (resaleByRate.get(vatRateBp) ?? 0) + net);
        break;
      case "own":
        ownGross += gross ?? 0;
        lineDiscounts += discount;
        ownSubtotal += net;
        ownByRate.set(vatRateBp, (ownByRate.get(vatRateBp) ?? 0) + net);
        break;
    }
  }

  const globalDiscount = applyBp(ownSubtotal, globalDiscountBp);

  // Reparto exacto del descuento global entre grupos de IVA del trabajo propio.
  const ownRates = [...ownByRate.keys()].sort((a, b) => a - b);
  const discountByRate = allocateProportionally(
    globalDiscount,
    ownRates.map((r) => ownByRate.get(r) ?? 0),
  );

  const rates = [...new Set([...ownRates, ...resaleByRate.keys()])].sort((a, b) => a - b);
  const vatGroups: VatGroup[] = rates
    .map((rateBp) => {
      const idx = ownRates.indexOf(rateBp);
      const ownBase = (ownByRate.get(rateBp) ?? 0) - (idx >= 0 ? discountByRate[idx] : 0);
      const base = ownBase + (resaleByRate.get(rateBp) ?? 0);
      return { rateBp, base, vat: applyBp(base, rateBp) };
    })
    .filter((g) => g.base !== 0);

  const taxableBase = ownSubtotal - globalDiscount + resaleSubtotal;
  const vatTotal = vatGroups.reduce((a, g) => a + g.vat, 0);
  const total = taxableBase + vatTotal + suplidos;

  if (total < 0) issues.push({ code: "negative_total", message: "El total no puede ser negativo" });

  return {
    lines: results,
    ownGross,
    lineDiscounts,
    ownSubtotal,
    globalDiscountBp,
    globalDiscount,
    resaleSubtotal,
    taxableBase,
    vatGroups,
    vatTotal,
    suplidos,
    total,
    netAgreed: taxableBase + suplidos,
    optionalExcluded,
    informativeExternal,
    issues,
  };
}

/** Incidencias que impiden marcar un presupuesto como definitivo o exportarlo. */
export function blockingIssues(totals: QuoteTotals): QuoteIssue[] {
  return totals.issues.filter((i) => {
    if (!i.lineId) return true;
    // Un externo informativo sin precio puede figurar como "a determinar"; no bloquea.
    const r = totals.lines[i.lineId];
    if (r?.bucket === "informative" && i.code !== "estimate_pending") return false;
    return true;
  });
}
