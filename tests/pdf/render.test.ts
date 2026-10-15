import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderQuotePdf, pdfFileName } from "@/lib/pdf/render";
import { computeDraft } from "@/lib/domain/quote";
import { phasedQuote, simpleQuote, toPdfData } from "../fixtures/sample-quotes";

const out = process.env.PDF_OUT_DIR;

describe("PDF", () => {
  it("renderiza un presupuesto sencillo", async () => {
    const buf = await renderQuotePdf(toPdfData(simpleQuote()));
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    if (out) {
      mkdirSync(out, { recursive: true });
      writeFileSync(path.join(out, "sencillo.pdf"), buf);
    }
  });

  it("renderiza una propuesta por fases y los pagos cuadran con el total", async () => {
    const draft = phasedQuote();
    const { totals, schedule } = computeDraft(draft);
    expect(schedule.issues).toEqual([]);
    expect(schedule.sumTotal).toBe(totals.total);
    const buf = await renderQuotePdf(toPdfData(draft, "preview"));
    expect(buf.length).toBeGreaterThan(5000);
    if (out) writeFileSync(path.join(out, "por-fases.pdf"), buf);
  });

  it("genera nombres de archivo significativos", () => {
    expect(pdfFileName("YK-2026-004", 2, "Nueva web Ortopedia L. Almirall")).toBe("YK-2026-004_v2_Nueva-web-Ortopedia-L-Almirall.pdf");
    expect(pdfFileName("YK-2026-004", 1, "Diseño · señalética", 3)).toBe("YK-2026-004_v1_Diseno-senaletica_doc3.pdf");
  });
});
