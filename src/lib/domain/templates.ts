import type { QuoteSectionDraft, QuotePaymentDraft } from "./quote";
import { SECTION_TYPE_LABEL, type SectionType } from "./schemas";

type Defaults = {
  default_payments: { label: string; milestone?: string; due_hint?: string; percent_bp?: number | null; amount?: number | null }[];
};

/** Antetítulo por defecto, al estilo de las propuestas de YKONO. */
export const SECTION_KICKER: Partial<Record<SectionType, string>> = {
  summary: "El proyecto",
  starting_point: "Punto de partida",
  objectives: "Objetivo",
  solution: "La propuesta",
  services: "Qué incluye",
  phases: "Fases de trabajo",
  methodology: "Cómo trabajaremos",
  timeline: "Calendario",
  client_responsibilities: "Vuestra parte",
  exclusions: "Para que no haya sorpresas",
  investment: "Inversión",
  payment: "Forma de pago",
  conditions: "Condiciones",
};

export function makeSection(type: SectionType, id: string, over: Partial<QuoteSectionDraft> = {}): QuoteSectionDraft {
  return {
    id,
    type,
    title: over.title ?? SECTION_TYPE_LABEL[type],
    content: over.content ?? { kicker: SECTION_KICKER[type] },
    visible: over.visible ?? true,
  };
}

/** Estructura sencilla para un presupuesto manual (en la línea del presupuesto de pantallas). */
export function defaultSections(newId: () => string): QuoteSectionDraft[] {
  return [
    makeSection("cover", newId(), { title: "Portada", content: {} }),
    makeSection("summary", newId(), { title: "Objetivo del proyecto" }),
    makeSection("phases", newId(), { title: "Qué incluye" }),
    makeSection("exclusions", newId(), { title: "Lo que no incluye esta propuesta" }),
    makeSection("investment", newId(), { title: "Inversión" }),
    makeSection("payment", newId(), { title: "Forma de pago" }),
    makeSection("conditions", newId(), { title: "Lo que conviene tener claro" }),
    makeSection("closing", newId(), { title: "¿Empezamos?", content: {} }),
  ];
}

export function defaultPayments(settings: Defaults, newId: () => string): QuotePaymentDraft[] {
  return settings.default_payments.map((p) => ({
    id: newId(),
    label: p.label,
    milestone: p.milestone ?? "",
    due_hint: p.due_hint ?? "",
    planned_date: null,
    percent_bp: p.percent_bp ?? null,
    amount: p.amount ?? null,
  }));
}
