/**
 * Utilidades monetarias.
 *
 * Política de representación (documentada en docs/motor-de-precios.md):
 * - Importes: céntimos enteros (number, siempre Number.isSafeInteger).
 * - Porcentajes y tipos (IVA, descuentos, pagos): puntos básicos enteros (1 % = 100 pb).
 * - Cantidades y horas: centésimas enteras (1,5 h = 150).
 * - Redondeo: "half away from zero" al céntimo, aplicado una sola vez por operación.
 */

export type Cents = number;
export type BasisPoints = number;
export type Hundredths = number;

export function assertCents(value: number, label = "importe"): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} debe ser un número entero de céntimos (recibido ${value})`);
  }
  return value;
}

/** Divide redondeando half away from zero. Ambos operandos enteros, divisor > 0. */
export function divRound(numerator: number, divisor: number): number {
  if (divisor <= 0 || !Number.isInteger(divisor)) throw new Error("Divisor inválido");
  if (!Number.isSafeInteger(numerator)) throw new Error("Desbordamiento en cálculo monetario");
  const sign = numerator < 0 ? -1 : 1;
  const abs = Math.abs(numerator);
  const q = Math.floor(abs / divisor);
  const r = abs - q * divisor;
  const rounded = r * 2 >= divisor ? q + 1 : q;
  return sign * rounded;
}

/** Aplica puntos básicos a un importe: amount * bp / 10000, redondeado. */
export function applyBp(amount: Cents, bp: BasisPoints): Cents {
  return divRound(amount * bp, 10000);
}

/** Multiplica un precio por una cantidad expresada en centésimas. */
export function mulHundredths(price: Cents, qty: Hundredths): Cents {
  return divRound(price * qty, 100);
}

/** Convierte un decimal (p. ej. 1,5 o "1,5") a centésimas enteras. */
export function toHundredths(value: number | string): Hundredths {
  // Admite "1,5", "1.234,5" (formato español) y "1.5" (formato de <input type=number>).
  const n =
    typeof value === "string"
      ? value.includes(",")
        ? Number(value.trim().replace(/\./g, "").replace(",", "."))
        : Number(value.trim())
      : value;
  if (!Number.isFinite(n)) throw new Error(`Cantidad inválida: ${value}`);
  return Math.round(n * 100);
}

/** Euros (number decimal, p. ej. de un input) a céntimos. */
export function eurosToCents(value: number | string): Cents {
  return toHundredths(value);
}

export function centsToEuros(cents: Cents): number {
  return cents / 100;
}

const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: "always",
});

const eurNoDecimals = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  useGrouping: "always",
});

/** 1234567 → "12.345,67 €". Si el importe es entero y compact=true → "12.346 €". */
export function formatEUR(cents: Cents, opts: { compact?: boolean } = {}): string {
  if (opts.compact && cents % 100 === 0) return eurNoDecimals.format(cents / 100);
  return eur.format(cents / 100);
}

const pct = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2, useGrouping: "always" });

/** 2100 → "21 %" */
export function formatBp(bp: BasisPoints): string {
  return `${pct.format(bp / 100)} %`;
}

const qtyFmt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2, useGrouping: "always" });

/** 150 → "1,5" */
export function formatHundredths(h: Hundredths): string {
  return qtyFmt.format(h / 100);
}
