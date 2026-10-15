/**
 * Calendario de pagos.
 *
 * Cada pago tiene dos importes que cuadran al céntimo con el presupuesto:
 *  - net:   parte del importe acordado sin IVA (base imponible + suplidos).
 *  - total: parte del total con IVA.
 *
 * Modo "percent": cada pago es un % del acordado; el último absorbe los céntimos de redondeo.
 * Modo "fixed":   la usuaria fija el neto de cada pago; debe sumar exactamente el acordado.
 *                 El total con IVA de cada pago se reparte proporcionalmente (último ajusta).
 */
import { applyBp, type BasisPoints, type Cents } from "./money";
import { allocateProportionally, type QuoteIssue } from "./pricing";
import { PaymentInput, type PaymentMode, type PaymentInput as PaymentIn } from "./schemas";

export type PaymentResult = {
  id: string;
  label: string;
  milestone: string;
  due_hint: string;
  planned_date: string | null;
  percentBp: BasisPoints;
  net: Cents;
  total: Cents;
};

export type PaymentSchedule = {
  mode: PaymentMode;
  payments: PaymentResult[];
  sumNet: Cents;
  sumTotal: Cents;
  issues: QuoteIssue[];
};

export function computePayments(
  mode: PaymentMode,
  rawPayments: PaymentIn[],
  netAgreed: Cents,
  totalAgreed: Cents,
): PaymentSchedule {
  const payments = rawPayments.map((p) => PaymentInput.parse(p));
  const issues: QuoteIssue[] = [];

  if (payments.length === 0) {
    issues.push({ code: "payments_missing", message: "Define al menos un pago" });
    return { mode, payments: [], sumNet: 0, sumTotal: 0, issues };
  }

  let nets: Cents[];
  let totals: Cents[];

  if (mode === "percent") {
    const pcts = payments.map((p) => p.percent_bp ?? 0);
    const sumPct = pcts.reduce((a, b) => a + b, 0);
    if (sumPct !== 10000) {
      issues.push({
        code: "payments_percent_mismatch",
        message: `Los porcentajes suman ${(sumPct / 100).toLocaleString("es-ES")} % y deben sumar 100 %`,
      });
    }
    const split = (amount: Cents) => {
      const parts = pcts.map((p) => applyBp(amount, p));
      if (sumPct === 10000) {
        // El último pago absorbe la diferencia de céntimos.
        parts[parts.length - 1] += amount - parts.reduce((a, b) => a + b, 0);
      }
      return parts;
    };
    nets = split(netAgreed);
    totals = split(totalAgreed);
  } else {
    nets = payments.map((p) => p.amount ?? 0);
    const sumNet = nets.reduce((a, b) => a + b, 0);
    if (sumNet !== netAgreed) {
      issues.push({
        code: "payments_amount_mismatch",
        message: "La suma de los pagos no coincide con el importe acordado",
      });
      // Sin cuadre no se puede repartir el IVA con garantías: proporción directa.
      totals = nets.map((n) => (netAgreed === 0 ? 0 : Math.round((n * totalAgreed) / netAgreed)));
    } else {
      totals = allocateProportionally(totalAgreed, nets);
    }
  }

  const results: PaymentResult[] = payments.map((p, i) => ({
    id: p.id,
    label: p.label,
    milestone: p.milestone,
    due_hint: p.due_hint,
    planned_date: p.planned_date,
    percentBp:
      mode === "percent"
        ? (p.percent_bp ?? 0)
        : netAgreed === 0
          ? 0
          : Math.round((nets[i] * 10000) / netAgreed),
    net: nets[i],
    total: totals[i],
  }));

  return {
    mode,
    payments: results,
    sumNet: nets.reduce((a, b) => a + b, 0),
    sumTotal: totals.reduce((a, b) => a + b, 0),
    issues,
  };
}
