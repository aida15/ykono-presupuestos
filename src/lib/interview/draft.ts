/**
 * Construcción del borrador de presupuesto a partir del estado de la entrevista.
 * Parte determinista y testeable: la IA solo aporta textos; partidas e importes
 * salen del catálogo y del motor de precios.
 */
import { z } from "zod";
import type { QuoteDraft, QuoteItemDraft, QuotePhaseDraft, QuoteSectionDraft } from "@/lib/domain/quote";
import { itemFromService } from "@/lib/domain/catalog-items";
import { makeSection, SECTION_KICKER } from "@/lib/domain/templates";
import { SectionCard } from "@/lib/domain/schemas";
import type { ServiceWithRule, ServiceCategory } from "@/lib/data/types";
import type { InterviewState } from "./state";

const NARRATIVE = ["summary", "starting_point", "objectives", "solution", "services", "methodology", "timeline", "client_responsibilities", "custom"] as const;

export const ProposalText = z.object({
  title: z.string().max(200),
  subtitle: z.string().max(400).default(""),
  sections: z
    .array(
      z.object({
        type: z.enum(NARRATIVE),
        kicker: z.string().max(80).default(""),
        title: z.string().max(200),
        body: z.string().max(4000).default(""),
        bullets: z.array(z.string().max(400)).max(12).default([]),
        cards: z.array(SectionCard).max(8).default([]),
        note: z.string().max(600).default(""),
      }),
    )
    .max(10),
  phases: z
    .array(
      z.object({
        name: z.string().max(120),
        description: z.string().max(600).default(""),
        deliverables: z.array(z.string().max(300)).max(15).default([]),
        timing: z.string().max(80).default(""),
      }),
    )
    .max(8),
  assignments: z.array(z.object({ key: z.string(), phase: z.string() })).default([]),
  exclusions: z.array(z.string().max(300)).max(15).default([]),
});
export type ProposalText = z.infer<typeof ProposalText>;

/**
 * Elimina frases con importes que la IA pudiera haber colado en los textos:
 * los precios del documento solo pueden venir del motor de precios.
 */
export function stripMoney(text: string): string {
  const money = /(\d[\d.,]*\s?(€|eur\b|euros?\b))|((€|EUR)\s?\d)/i;
  return text
    .split(/(?<=[.!?])\s+|\n/)
    .filter((sentence) => !money.test(sentence))
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Textos de respaldo cuando no hay IA: se componen con los datos tal cual se dieron. */
export function fallbackText(state: InterviewState, services: ServiceWithRule[], categories: ServiceCategory[]): ProposalText {
  const c = state.common;
  const sections: ProposalText["sections"] = [];
  const summaryBody = [state.classification.main_need, c.business_context].filter(Boolean).join("\n\n");
  sections.push({ type: "summary", kicker: "El proyecto", title: c.project_name || state.classification.project_type || "Objetivo del proyecto", body: summaryBody, bullets: [], cards: [], note: "" });
  if (c.starting_point) sections.push({ type: "starting_point", kicker: "Punto de partida", title: "Dónde estamos", body: c.starting_point, bullets: [], cards: [], note: "" });
  if (c.objectives.length) sections.push({ type: "objectives", kicker: "Objetivo", title: "Qué queremos conseguir", body: "", bullets: c.objectives, cards: [], note: "" });
  if (state.client_responsibilities.length)
    sections.push({ type: "client_responsibilities", kicker: "Vuestra parte", title: "Lo que necesitamos de vosotros", body: "", bullets: state.client_responsibilities, cards: [], note: "" });

  // Una fase por categoría del catálogo, en el orden del catálogo.
  const byCat = new Map<string, string>();
  for (const p of state.services) {
    const svc = services.find((s) => s.id === p.service_id);
    const cat = categories.find((x) => x.id === svc?.category_id);
    byCat.set(p.id, p.phase || cat?.name || "Servicios");
  }
  const phaseNames = [...new Set(byCat.values())];
  return {
    title: c.project_name || state.classification.project_type || "Propuesta",
    subtitle: "",
    sections,
    phases: phaseNames.map((name) => ({
      name,
      description: "",
      deliverables: state.services
        .filter((p) => byCat.get(p.id) === name)
        .flatMap((p) => services.find((s) => s.id === p.service_id)?.default_deliverables ?? []),
      timing: "",
    })),
    assignments: [...byCat.entries()].map(([key, phase]) => ({ key, phase })),
    exclusions: [],
  };
}

/** Compone el borrador completo (secciones, fases, partidas) para guardarlo. */
export function composeDraft(args: {
  base: QuoteDraft;
  state: InterviewState;
  text: ProposalText;
  services: ServiceWithRule[];
  newId: () => string;
}): QuoteDraft {
  const { base, state, text, services, newId } = args;

  const phases: QuotePhaseDraft[] = text.phases.map((p) => ({
    id: newId(),
    name: p.name,
    description: stripMoney(p.description),
    deliverables: p.deliverables.map(stripMoney).filter(Boolean),
    // El calendario solo se conserva si el estado tenía información de plazos.
    timing: state.timeline_notes || state.common.desired_deadline ? p.timing : "",
  }));
  const phaseByName = new Map(phases.map((p) => [p.name.toLowerCase(), p.id]));

  const accepted = [
    ...state.services,
    ...state.recommendations
      .filter((r) => r.status === "added")
      .map((r) => ({ id: r.id, service_id: r.service_id, quantity: null, complexity_level: null, phase: "", notes: "", evidence: "", source: "recommendation" as const })),
  ];

  const items: QuoteItemDraft[] = [];
  for (const p of accepted) {
    const svc = services.find((s) => s.id === p.service_id);
    if (!svc) continue;
    const assigned = text.assignments.find((a) => a.key === p.id)?.phase ?? p.phase;
    const phaseId = phaseByName.get(assigned.toLowerCase()) ?? phases[phases.length - 1]?.id ?? null;
    const item = itemFromService(svc, {
      id: newId(),
      phaseId,
      quantity: p.quantity ?? undefined,
      complexityLevel: p.complexity_level,
    });
    if (p.notes) item.description = [item.description, p.notes].filter(Boolean).join(" ");
    items.push(item);
  }

  // Recomendaciones pendientes de valoración: entran como opcionales no incluidas y sin valorar.
  for (const r of state.recommendations.filter((x) => x.status === "deferred")) {
    const svc = services.find((s) => s.id === r.service_id);
    if (!svc) continue;
    const item = itemFromService(svc, { id: newId(), phaseId: null, optional: true });
    item.price_status = "pending_valuation";
    item.description = r.reason;
    items.push(item);
  }

  const narrative: QuoteSectionDraft[] = text.sections.map((s) =>
    makeSection(s.type, newId(), {
      title: stripMoney(s.title) || s.title,
      content: {
        kicker: s.kicker || SECTION_KICKER[s.type],
        body: stripMoney(s.body) || undefined,
        bullets: s.bullets.map(stripMoney).filter(Boolean),
        cards: s.cards.map((c) => ({ title: c.title, text: stripMoney(c.text) })).filter((c) => c.title),
        note: stripMoney(s.note) || undefined,
      },
    }),
  );

  const sections: QuoteSectionDraft[] = [
    makeSection("cover", newId(), { title: "Portada", content: {} }),
    ...narrative,
    makeSection("phases", newId(), { title: phases.length > 1 ? `${phaseCountWord(phases.length)} fases, un mismo equipo` : "Qué incluye" }),
    makeSection("exclusions", newId(), { title: "Lo que no incluye esta propuesta" }),
    makeSection("investment", newId(), { title: "Inversión" }),
    makeSection("payment", newId(), { title: "Forma de pago" }),
    makeSection("conditions", newId(), { title: "Lo que conviene tener claro" }),
    makeSection("closing", newId(), { title: "¿Empezamos?", content: {} }),
  ];

  const exclusions = [
    ...new Set([...base.exclusions, ...state.exclusions, ...text.exclusions.map(stripMoney), ...items.flatMap((i) => services.find((s) => s.id === i.service_id)?.default_exclusions ?? [])]),
  ].filter(Boolean);

  return {
    ...base,
    title: text.title || base.title,
    subtitle: text.subtitle,
    sections,
    phases,
    items,
    exclusions,
  };
}

function phaseCountWord(n: number) {
  return ["", "Una", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho"][n] ?? String(n);
}
