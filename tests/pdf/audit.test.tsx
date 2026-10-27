import { describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { auditFileName, buildAuditData, renderAuditPdf } from "@/lib/leads/audit-pdf";
import { templateAuditClosing, templateAuditIntro } from "@/lib/leads/pitch";
import type { CriterionResult } from "@/lib/leads/criteria";

const out = process.env.PDF_OUT_DIR;
// Captura de ejemplo opcional (JPEG) para revisar el diseño a ojo.
const shot = process.env.AUDIT_SHOT ? `data:image/jpeg;base64,${readFileSync(process.env.AUDIT_SHOT).toString("base64")}` : null;

function sample(showPrices: boolean) {
  const r = (id: string, met: boolean | null, evidence: string): CriterionResult => ({ id, met, evidence, source: "auto" });
  const results = [
    r("has_website", true, "peluqueriaane.com"), r("https", false, "La web solo carga en http://."), r("mobile", false, "No tiene etiqueta viewport: en el móvil se ve como en un ordenador, en pequeño."),
    r("performance", false, "PageSpeed móvil: 31/100."), r("updated", false, "Último año en el pie: 2016."), r("modern_tech", false, "jQuery 1.8 y maquetación con tablas."),
    r("own_domain", true, "peluqueriaane.com"), r("pro_email", false, "El contacto es peluqueriaane@hotmail.com."), r("seo_basics", false, "Le falta: descripción, encabezado principal (H1)."),
    r("legal", false, "No se ven aviso legal ni política de privacidad."), r("basque", false, "Solo en castellano."), r("favicon", true, "Tiene icono propio."),
    r("logo_quality", false, "El logotipo es un texto en una tipografía decorativa, pixelado al ampliarse."), r("visual_consistency", false, "Mezcla tres tipografías y colores sin relación."),
    r("photo_quality", null, ""), r("social", true, "Enlaza Instagram y Facebook."), r("gbp_exists", true, "Tiene ficha en Google Maps."), r("gbp_website", true, "La ficha enlaza la web."),
    r("gbp_photos", false, "Solo 2 fotos en la ficha."), r("gbp_hours", true, "Horario publicado."),
  ];
  return buildAuditData({
    lead: { name: "Peluquería Ane", category: "Peluquería", city: "Getxo", website: "http://peluqueriaane.com/" },
    results, screenshot: showPrices ? shot : null, performance: 31,
    offers: [
      { name: "Diseño web (plantilla)", reasons: ["La web no se adapta al móvil"], price_label: "1.200 €", net_cents: 120000 },
      { name: "SEO básico", reasons: ["Que la web nueva aparezca bien en Google"], price_label: "350 €", net_cents: 35000 },
      { name: "Logotipo", reasons: ["El logotipo no está a la altura"], price_label: "900 €", net_cents: 90000 },
      { name: "Correo profesional con dominio propio", reasons: ["Correo profesional con su dominio"], price_label: "150 €", net_cents: 15000 },
    ],
    showPrices,
    intro: templateAuditIntro({ name: "Peluquería Ane", website: "http://peluqueriaane.com/", studioName: "YKONO" }),
    closing: templateAuditClosing({ name: "Peluquería Ane" }),
    studio: { trade_name: "YKONO", tagline: "Estudio creativo", email: "hola@ykono.com", phone: "600 000 000", website: "ykono.com", city: "Bilbao", accent: "#B4E600" },
    date: "2026-10-27",
    formatTotal: (c) => `${(c / 100).toLocaleString("es-ES")} €`,
  });
}

describe("Auditoría PDF", () => {
  it("no repite cifras y numera las fuentes", () => {
    const d = sample(false);
    const ids = d.findings.map((f) => f.stat?.id).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
    expect(d.sources.length).toBe(ids.length);
    expect(d.findings[0].id).toBe("mobile"); // el de más peso primero
    expect(d.proposal.every((p) => p.price === null)).toBe(true);
    expect(d.proposalTotal).toBeNull();
  });

  it("renderiza con y sin precios", async () => {
    for (const precios of [false, true]) {
      const buf = await renderAuditPdf(sample(precios));
      expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
      if (out) {
        mkdirSync(out, { recursive: true });
        writeFileSync(path.join(out, precios ? "auditoria-precios.pdf" : "auditoria.pdf"), buf);
      }
    }
    expect(auditFileName("Peluquería Ane")).toBe("Auditoria-presencia-digital_Peluqueria-Ane.pdf");
  });
});
