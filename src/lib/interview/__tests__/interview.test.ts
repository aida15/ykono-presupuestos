import { describe, expect, it } from "vitest";
import { emptyState, mergePatch, applyGuidedAnswer, nextGuidedQuestion } from "../state";
import { composeDraft, fallbackText, stripMoney } from "../draft";
import type { ServiceWithRule } from "@/lib/data/types";
import type { QuoteDraft } from "@/lib/domain/quote";
import { computeDraft } from "@/lib/domain/quote";

let n = 0;
const newId = () => `id-${++n}`;

const svc = (id: string, over: Partial<ServiceWithRule> = {}): ServiceWithRule => ({
  id,
  category_id: "cat",
  name: `Servicio ${id}`,
  internal_description: null,
  commercial_description: `Descripción ${id}`,
  unit: "ud.",
  is_external_cost: false,
  default_external_treatment: null,
  is_optional_default: false,
  default_exclusions: [],
  default_deliverables: [`Entregable ${id}`],
  complements: [],
  active: true,
  sort_order: 0,
  rule: {
    id: `rule-${id}`,
    service_id: id,
    version: 1,
    method: "per_unit",
    unit_price_cents: 22000,
    hourly_rate_cents: null,
    estimated_hours: null,
    default_quantity: 100,
    addons: [],
    complexity: null,
    default_price_status: "approved_rate",
    notes: null,
    is_current: true,
    valid_from: "",
    created_at: "",
  },
  ...over,
});

const catalog = { validServiceIds: new Set(["web", "seo", "manual"]), validQuestionIds: new Set(["q1"]), newId };

describe("mergePatch", () => {
  it("extrae varios datos a la vez y no borra con vacíos", () => {
    let s = emptyState();
    s = mergePatch(s, { common: { client_name: "Ortopedia", sector: "Salud", objectives: ["Más pacientes"] } }, catalog);
    s = mergePatch(s, { common: { client_name: "", sector: undefined } }, catalog);
    expect(s.common.client_name).toBe("Ortopedia");
    expect(s.common.sector).toBe("Salud");
    expect(s.common.objectives).toEqual(["Más pacientes"]);
  });

  it("solo acepta servicios del catálogo con evidencia de la usuaria", () => {
    const s = mergePatch(
      emptyState(),
      {
        services: [
          { service_id: "web", quantity: 10, evidence: "necesitan 10 plantillas" },
          { service_id: "inventado", quantity: 1, evidence: "x" },
          { service_id: "seo", evidence: "" },
        ],
      },
      catalog,
    );
    expect(s.services.map((x) => x.service_id)).toEqual(["web"]);
    expect(s.services[0].quantity).toBe(1000);
  });

  it("las recomendaciones entran siempre pendientes y nunca como servicio", () => {
    const s = mergePatch(emptyState(), { recommendations: [{ service_id: "seo", reason: "Para que les encuentren" }] }, catalog);
    expect(s.services).toEqual([]);
    expect(s.recommendations[0].status).toBe("pending");
  });

  it("la IA no puede confirmar la clasificación ni ignorar preguntas inexistentes", () => {
    const s = mergePatch(emptyState(), { classification: { project_type: "Web", confirmed: true }, answers: { q1: "Sí", qx: "No" } }, catalog);
    expect(s.classification.confirmed).toBe(false);
    expect(s.answers).toEqual({ q1: "Sí" });
  });
});

describe("modo guiado", () => {
  it("recorre las preguntas comunes sin repetir", () => {
    let s = emptyState();
    const first = nextGuidedQuestion(s)!;
    s = applyGuidedAnswer(s, first.key, "Ortopedia Almirall");
    expect(nextGuidedQuestion(s)?.key).not.toBe(first.key);
  });
});

describe("borrador", () => {
  it("stripMoney quita frases con importes", () => {
    expect(stripMoney("Diseñamos la web. Cuesta 8.200 € más IVA. Lo lanzamos en dos fases.")).toBe("Diseñamos la web. Lo lanzamos en dos fases.");
    expect(stripMoney("Sin precios aquí")).toBe("Sin precios aquí");
  });

  it("compone partidas desde el catálogo y respeta las decisiones sobre sugerencias", () => {
    const services = [svc("web"), svc("seo"), svc("manual")];
    const state = emptyState();
    state.common.project_name = "Nueva web";
    state.services = [{ id: "p1", service_id: "web", quantity: 1000, complexity_level: null, phase: "", notes: "", evidence: "10 plantillas", source: "user" }];
    state.recommendations = [
      { id: "r1", service_id: "seo", reason: "SEO", status: "added" },
      { id: "r2", service_id: "manual", reason: "Manual", status: "dismissed" },
    ];
    const base: QuoteDraft = {
      id: "q",
      number: "YK-2026-001",
      version: 1,
      status: "draft",
      client_id: null,
      project_id: null,
      title: "",
      subtitle: "",
      addressee: "",
      issue_date: "2026-10-14",
      validity_days: 30,
      vat_rate_bp: 2100,
      global_discount_bp: 0,
      payment_mode: "percent",
      payment_terms: "",
      conditions: [],
      exclusions: [],
      notes_internal: "",
      sections: [],
      phases: [],
      items: [],
      payments: [{ id: "pay", label: "Único", milestone: "", due_hint: "", planned_date: null, percent_bp: 10000, amount: null }],
    };
    const text = fallbackText(state, services, [{ id: "cat", parent_id: null, name: "Diseño digital", slug: "d", description: null, sort_order: 0, active: true }]);
    const draft = composeDraft({ base, state, text, services, newId });
    expect(draft.items.map((i) => i.service_id)).toEqual(["web", "seo"]);
    expect(draft.items[0].quantity).toBe(1000);
    expect(draft.items[0].rule_snapshot).not.toBeNull();
    expect(draft.sections[0].type).toBe("cover");
    expect(draft.sections.some((s) => s.type === "investment")).toBe(true);
    // 10 × 220 € + 1 × 220 € = 2.420 €
    expect(computeDraft(draft).totals.taxableBase).toBe(242000);
  });
});
