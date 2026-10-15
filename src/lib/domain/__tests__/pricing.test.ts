import { describe, expect, it } from "vitest";
import { computeQuote, lineGross, allocateProportionally, blockingIssues } from "../pricing";
import { computePayments } from "../payments";
import { divRound, applyBp, formatEUR, formatBp, toHundredths, formatHundredths } from "../money";
import { PricingLineInput } from "../schemas";

const L = (over: Record<string, unknown>) =>
  PricingLineInput.parse({
    id: String(Math.random()),
    method: "per_unit",
    quantity: 100,
    unit_price: 10000,
    price_status: "approved_rate",
    ...over,
  });

describe("money", () => {
  it("redondea half away from zero", () => {
    expect(divRound(5, 10)).toBe(1);
    expect(divRound(4, 10)).toBe(0);
    expect(divRound(-5, 10)).toBe(-1);
    expect(divRound(15, 10)).toBe(2);
    expect(applyBp(1, 5000)).toBe(1); // 0,5 cént → 1
  });
  it("formatea en español", () => {
    expect(formatEUR(992200).replace(/ /g, " ")).toBe("9.922,00 €");
    expect(formatEUR(820000, { compact: true }).replace(/ /g, " ")).toBe("8.200 €");
    expect(formatEUR(250470).replace(/ /g, " ")).toBe("2.504,70 €");
    expect(formatBp(2100)).toBe("21 %");
    expect(formatHundredths(150)).toBe("1,5");
  });
  it("interpreta cantidades en formato español y de input", () => {
    expect(toHundredths("1,5")).toBe(150);
    expect(toHundredths("1.5")).toBe(150);
    expect(toHundredths("1.234,56")).toBe(123456);
    expect(toHundredths(0.1 + 0.2)).toBe(30);
  });
});

describe("lineGross por método", () => {
  it("fijo y por unidad", () => {
    expect(lineGross(L({ method: "fixed", unit_price: 207000 }))).toBe(207000);
    expect(lineGross(L({ method: "per_unit", unit_price: 4500, quantity: 4800 }))).toBe(216000);
  });
  it("por horas", () => {
    expect(lineGross(L({ method: "hourly", hours: 150, hourly_rate: 5000 }))).toBe(7500);
  });
  it("base + complementos", () => {
    expect(
      lineGross(
        L({ method: "base_plus_addons", unit_price: 90000, addons: [{ label: "Extra", price: 25000, qty: 200 }] }),
      ),
    ).toBe(140000);
  });
  it("complejidad", () => {
    expect(lineGross(L({ method: "complexity", unit_price: 120000, complexity_factor_bp: 14000 }))).toBe(168000);
  });
  it("pendiente de valoración o sin precio → null", () => {
    expect(lineGross(L({ price_status: "pending_valuation" }))).toBeNull();
    expect(lineGross(L({ unit_price: null }))).toBeNull();
  });
});

describe("presupuestos de referencia", () => {
  it("Pantallas interactivas: 2.070 € + 21 % = 2.504,70 €", () => {
    const t = computeQuote({
      lines: [{ id: "a", method: "fixed", quantity: 100, unit_price: 207000, price_status: "manual_approved" }],
      defaultVatBp: 2100,
    });
    expect(t.taxableBase).toBe(207000);
    expect(t.vatTotal).toBe(43470);
    expect(t.total).toBe(250470);
    const s = computePayments(
      "percent",
      [
        { id: "1", label: "Inicio", percent_bp: 5000 },
        { id: "2", label: "Entrega", percent_bp: 5000 },
      ],
      t.netAgreed,
      t.total,
    );
    expect(s.payments.map((p) => p.total)).toEqual([125235, 125235]);
    expect(s.issues).toEqual([]);
  });

  it("Almirall: 8.200 € + IVA = 9.922 €, cuatro pagos de 1.800 € y uno de 1.000 €", () => {
    const t = computeQuote({
      lines: [
        { id: "d", method: "fixed", unit_price: 200000, quantity: 100, price_status: "approved_rate" },
        { id: "w", method: "fixed", unit_price: 350000, quantity: 100, price_status: "approved_rate" },
        { id: "a", method: "fixed", unit_price: 170000, quantity: 100, price_status: "approved_rate" },
        { id: "t", method: "fixed", unit_price: 100000, quantity: 100, price_status: "approved_rate" },
        // Coste de terceros a nombre del cliente: se muestra, no suma.
        { id: "e", method: "external", kind: "external", external_treatment: "informative", unit_price: 8400, quantity: 100, price_status: "approved_rate" },
        { id: "p", method: "external", kind: "external", external_treatment: "informative", unit_price: null, quantity: 100, price_status: "pending_valuation" },
      ],
      defaultVatBp: 2100,
    });
    expect(t.taxableBase).toBe(820000);
    expect(t.total).toBe(992200);
    expect(t.informativeExternal).toEqual({ net: 8400, count: 1 });
    expect(blockingIssues(t)).toEqual([]); // "A determinar" informativo no bloquea

    const s = computePayments(
      "fixed",
      [1, 2, 3, 4].map((n) => ({ id: String(n), label: `Pago ${n}`, amount: 180000 })).concat([
        { id: "5", label: "Tienda", amount: 100000 },
      ]),
      t.netAgreed,
      t.total,
    );
    expect(s.issues).toEqual([]);
    expect(s.payments.map((p) => p.total)).toEqual([217800, 217800, 217800, 217800, 121000]);
    expect(s.sumTotal).toBe(t.total);
  });
});

describe("descuentos, IVA y externos", () => {
  it("aplica descuento de partida antes del global y del IVA", () => {
    const t = computeQuote({
      lines: [
        { id: "a", method: "fixed", unit_price: 100000, quantity: 100, discount_bp: 1000, price_status: "approved_rate" },
        { id: "b", method: "fixed", unit_price: 50000, quantity: 100, price_status: "approved_rate" },
      ],
      defaultVatBp: 2100,
      globalDiscountBp: 500,
    });
    expect(t.lineDiscounts).toBe(10000);
    expect(t.ownSubtotal).toBe(140000);
    expect(t.globalDiscount).toBe(7000);
    expect(t.taxableBase).toBe(133000);
    expect(t.vatTotal).toBe(27930);
    expect(t.total).toBe(160930);
  });

  it("agrupa IVA por tipo y reparte el descuento global sin perder céntimos", () => {
    const t = computeQuote({
      lines: [
        { id: "a", method: "fixed", unit_price: 33333, quantity: 100, price_status: "approved_rate" },
        { id: "b", method: "fixed", unit_price: 33333, quantity: 100, vat_rate_bp: 1000, price_status: "approved_rate" },
        { id: "c", method: "fixed", unit_price: 33334, quantity: 100, vat_rate_bp: 400, price_status: "approved_rate" },
      ],
      defaultVatBp: 2100,
      globalDiscountBp: 333,
    });
    const sumBases = t.vatGroups.reduce((a, g) => a + g.base, 0);
    expect(sumBases).toBe(t.taxableBase);
    expect(t.vatGroups.map((g) => g.rateBp)).toEqual([400, 1000, 2100]);
    expect(t.total).toBe(t.taxableBase + t.vatTotal);
  });

  it("suplidos suman al total sin IVA; refacturados llevan IVA; el descuento global no les afecta", () => {
    const t = computeQuote({
      lines: [
        { id: "own", method: "fixed", unit_price: 100000, quantity: 100, price_status: "approved_rate" },
        { id: "res", method: "external", kind: "external", external_treatment: "resale", unit_price: 20000, quantity: 100, price_status: "approved_rate" },
        { id: "sup", method: "external", kind: "external", external_treatment: "suplido", unit_price: 5000, quantity: 100, price_status: "approved_rate" },
      ],
      defaultVatBp: 2100,
      globalDiscountBp: 1000,
    });
    expect(t.globalDiscount).toBe(10000);
    expect(t.taxableBase).toBe(90000 + 20000);
    expect(t.vatTotal).toBe(23100);
    expect(t.suplidos).toBe(5000);
    expect(t.total).toBe(110000 + 23100 + 5000);
    expect(t.netAgreed).toBe(115000);
  });

  it("los opcionales solo suman si la usuaria los incluye expresamente", () => {
    const base = [{ id: "a", method: "fixed" as const, unit_price: 100000, quantity: 100, price_status: "approved_rate" as const }];
    const opt = { id: "o", method: "fixed" as const, unit_price: 50000, quantity: 100, price_status: "approved_rate" as const, is_optional: true };
    const excluded = computeQuote({ lines: [...base, opt], defaultVatBp: 2100 });
    expect(excluded.taxableBase).toBe(100000);
    expect(excluded.optionalExcluded).toEqual({ net: 50000, netWithVat: 60500, count: 1 });
    const included = computeQuote({ lines: [...base, { ...opt, optional_included: true }], defaultVatBp: 2100 });
    expect(included.taxableBase).toBe(150000);
  });

  it("marca estimaciones y valoraciones pendientes como bloqueantes", () => {
    const t = computeQuote({
      lines: [
        { id: "e", method: "hourly", hours: 1000, hourly_rate: 5000, price_status: "estimate_pending" },
        { id: "p", method: "fixed", unit_price: null, price_status: "pending_valuation" },
      ],
      defaultVatBp: 2100,
    });
    expect(t.taxableBase).toBe(50000); // la estimación se calcula, pero...
    expect(blockingIssues(t).map((i) => i.code).sort()).toEqual(["estimate_pending", "pending_valuation"]);
  });
});

describe("calendario de pagos", () => {
  it("modo porcentaje: el último pago absorbe los céntimos", () => {
    const s = computePayments(
      "percent",
      [
        { id: "1", label: "A", percent_bp: 3333 },
        { id: "2", label: "B", percent_bp: 3333 },
        { id: "3", label: "C", percent_bp: 3334 },
      ],
      100001,
      121001,
    );
    expect(s.sumNet).toBe(100001);
    expect(s.sumTotal).toBe(121001);
    expect(s.issues).toEqual([]);
  });

  it("modo porcentaje: avisa si no suma 100 %", () => {
    const s = computePayments("percent", [{ id: "1", label: "A", percent_bp: 4000 }], 1000, 1210);
    expect(s.issues[0].code).toBe("payments_percent_mismatch");
  });

  it("modo importes: avisa si no cuadra con el acordado", () => {
    const s = computePayments("fixed", [{ id: "1", label: "A", amount: 900 }], 1000, 1210);
    expect(s.issues[0].code).toBe("payments_amount_mismatch");
  });

  it("sin pagos es incidencia", () => {
    expect(computePayments("percent", [], 1000, 1210).issues[0].code).toBe("payments_missing");
  });
});

describe("allocateProportionally", () => {
  it("conserva la suma exacta", () => {
    const parts = allocateProportionally(1000, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(allocateProportionally(10, [0, 0])).toEqual([0, 0]);
    expect(allocateProportionally(7, [3, 0])).toEqual([7, 0]);
  });
});
