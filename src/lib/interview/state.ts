/**
 * Estado estructurado de la entrevista. La conversación es libre, pero todo lo que
 * se extrae vive aquí, en campos identificables, y la usuaria puede revisarlo.
 */
import { z } from "zod";

export const DISCIPLINES = ["strategy", "identity", "digital", "packaging", "editorial", "social", "recurring"] as const;
export const Discipline = z.enum(DISCIPLINES);

const str = z.string().max(2000).default("");
const list = z.array(z.string().max(500)).max(40).default([]);

export const Classification = z.object({
  project_type: str,
  main_need: str,
  brand_status: z.enum(["", "new", "existing", "transition"]).default(""),
  disciplines: z.array(Discipline).default([]),
  known_scope: str,
  missing_info: list,
  risks: list,
  confirmed: z.boolean().default(false),
});

export const Common = z.object({
  project_name: str,
  client_name: str,
  client_id: z.string().nullable().default(null),
  sector: str,
  business_context: str,
  objectives: list,
  target_audience: str,
  starting_point: str,
  needs_priorities: str,
  deliverables: list,
  available_materials: str,
  client_materials: str,
  languages: list,
  desired_deadline: str,
  external_dependencies: str,
  client_budget: str,
  validators: str,
});
export type Common = z.infer<typeof Common>;

export const ProposedService = z.object({
  id: z.string(),
  service_id: z.string(),
  /** centésimas; null = cantidad por defecto de la tarifa */
  quantity: z.number().int().min(0).nullable().default(null),
  complexity_level: z.string().nullable().default(null),
  phase: z.string().max(120).default(""),
  notes: z.string().max(500).default(""),
  /** frase de la usuaria que justifica incluirlo */
  evidence: z.string().max(500).default(""),
  source: z.enum(["user", "recommendation", "manual"]).default("user"),
});
export type ProposedService = z.infer<typeof ProposedService>;

export const Recommendation = z.object({
  id: z.string(),
  service_id: z.string(),
  reason: z.string().max(500),
  status: z.enum(["pending", "added", "dismissed", "deferred"]).default("pending"),
});
export type Recommendation = z.infer<typeof Recommendation>;

export const InterviewState = z.object({
  stage: z.enum(["intake", "questions", "summary", "done"]).default("intake"),
  classification: Classification.default(Classification.parse({})),
  common: Common.default(Common.parse({})),
  /** respuestas a preguntas del catálogo, por id de pregunta */
  answers: z.record(z.string(), z.string().max(2000)).default({}),
  asked_question_ids: z.array(z.string()).default([]),
  services: z.array(ProposedService).max(60).default([]),
  recommendations: z.array(Recommendation).max(30).default([]),
  exclusions: list,
  client_responsibilities: list,
  timeline_notes: str,
  open_questions: list,
  decisions_pending: list,
});
export type InterviewState = z.infer<typeof InterviewState>;

export const emptyState = (): InterviewState => InterviewState.parse({});

export type ChatMessage = { role: "user" | "assistant"; content: string; at: string };

export const OPENING_QUESTION = "Cuéntame qué necesita el cliente y qué queréis conseguir con el proyecto.";

/* ------------------------------------------------------------------ */
/* Parche que devuelve la IA                                           */
/* ------------------------------------------------------------------ */

export const StatePatch = z.object({
  classification: Classification.partial().optional(),
  common: Common.omit({ client_id: true }).partial().optional(),
  answers: z.record(z.string(), z.string().max(2000)).optional(),
  services: z
    .array(
      z.object({
        service_id: z.string(),
        quantity: z.number().min(0).nullable().optional(),
        complexity_level: z.string().nullable().optional(),
        phase: z.string().max(120).optional(),
        notes: z.string().max(500).optional(),
        evidence: z.string().max(500),
      }),
    )
    .optional(),
  remove_service_ids: z.array(z.string()).optional(),
  recommendations: z.array(z.object({ service_id: z.string(), reason: z.string().max(500) })).optional(),
  exclusions: z.array(z.string().max(500)).optional(),
  client_responsibilities: z.array(z.string().max(500)).optional(),
  timeline_notes: z.string().max(2000).optional(),
  open_questions: z.array(z.string().max(500)).optional(),
  decisions_pending: z.array(z.string().max(500)).optional(),
});
export type StatePatch = z.infer<typeof StatePatch>;

const nonEmpty = <T extends Record<string, unknown>>(o: T | undefined) =>
  Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)));

/**
 * Aplica el parche de la IA de forma conservadora:
 * - Nunca borra datos con valores vacíos.
 * - Solo acepta servicios del catálogo y con una frase de la usuaria que lo respalde.
 * - Las recomendaciones entran siempre como «pendiente»: la IA no puede añadirlas al presupuesto.
 * - No puede cambiar el cliente vinculado ni marcar la clasificación como confirmada.
 */
export function mergePatch(
  state: InterviewState,
  patch: StatePatch,
  catalog: { validServiceIds: Set<string>; validQuestionIds: Set<string>; newId: () => string },
): InterviewState {
  const next: InterviewState = structuredClone(state);

  if (patch.classification) {
    const { confirmed: _ignored, ...rest } = patch.classification;
    void _ignored;
    next.classification = { ...next.classification, ...nonEmpty(rest) } as InterviewState["classification"];
    if (rest.disciplines) next.classification.disciplines = [...new Set(rest.disciplines)];
  }
  if (patch.common) next.common = { ...next.common, ...nonEmpty(patch.common) } as Common;

  for (const [qid, ans] of Object.entries(patch.answers ?? {})) {
    if (catalog.validQuestionIds.has(qid) && ans.trim()) next.answers[qid] = ans.trim();
  }

  if (patch.remove_service_ids?.length) {
    const rm = new Set(patch.remove_service_ids);
    next.services = next.services.filter((s) => !rm.has(s.service_id) || s.source === "manual");
  }
  for (const s of patch.services ?? []) {
    if (!catalog.validServiceIds.has(s.service_id) || !s.evidence.trim()) continue;
    const qty = s.quantity == null ? null : Math.round(s.quantity * 100);
    const existing = next.services.find((x) => x.service_id === s.service_id);
    if (existing) {
      if (qty != null) existing.quantity = qty;
      if (s.complexity_level) existing.complexity_level = s.complexity_level;
      if (s.phase) existing.phase = s.phase;
      if (s.notes) existing.notes = s.notes;
    } else {
      next.services.push(
        ProposedService.parse({
          id: catalog.newId(),
          service_id: s.service_id,
          quantity: qty,
          complexity_level: s.complexity_level ?? null,
          phase: s.phase ?? "",
          notes: s.notes ?? "",
          evidence: s.evidence,
          source: "user",
        }),
      );
    }
  }

  for (const r of patch.recommendations ?? []) {
    if (!catalog.validServiceIds.has(r.service_id)) continue;
    if (next.services.some((s) => s.service_id === r.service_id)) continue;
    if (next.recommendations.some((x) => x.service_id === r.service_id)) continue;
    next.recommendations.push({ id: catalog.newId(), service_id: r.service_id, reason: r.reason, status: "pending" });
  }

  const mergeList = (a: string[], b?: string[]) => (b ? [...new Set([...a, ...b.map((x) => x.trim()).filter(Boolean)])].slice(0, 40) : a);
  next.exclusions = mergeList(next.exclusions, patch.exclusions);
  next.client_responsibilities = mergeList(next.client_responsibilities, patch.client_responsibilities);
  // Preguntas abiertas y decisiones: la IA devuelve la lista vigente completa.
  if (patch.open_questions) next.open_questions = patch.open_questions.slice(0, 40);
  if (patch.decisions_pending) next.decisions_pending = patch.decisions_pending.slice(0, 40);
  if (patch.timeline_notes) next.timeline_notes = patch.timeline_notes;

  return InterviewState.parse(next);
}

/** Campos comunes con su etiqueta, para el panel de progreso y el modo guiado. */
export const COMMON_FIELDS: { key: keyof Common; label: string; question: string; list?: boolean }[] = [
  { key: "client_name", label: "Cliente", question: "¿Para qué cliente es y cómo se llama el proyecto?" },
  { key: "sector", label: "Sector", question: "¿A qué se dedica el cliente y en qué contexto está?" },
  { key: "objectives", label: "Objetivos", question: "¿Qué quiere conseguir con el proyecto?", list: true },
  { key: "target_audience", label: "Público objetivo", question: "¿A quién se dirige?" },
  { key: "starting_point", label: "Situación de partida", question: "¿Qué tienen hoy? ¿Cuál es el punto de partida?" },
  { key: "deliverables", label: "Entregables", question: "¿Qué entregables espera recibir?", list: true },
  { key: "client_materials", label: "Materiales del cliente", question: "¿Qué materiales tiene ya y cuáles aportará?" },
  { key: "languages", label: "Idiomas", question: "¿En qué idiomas?", list: true },
  { key: "desired_deadline", label: "Fecha deseada", question: "¿Hay una fecha deseada de entrega o algún hito?" },
  { key: "external_dependencies", label: "Dependencias", question: "¿Depende de terceros (imprenta, programadores, permisos…)?" },
  { key: "client_budget", label: "Presupuesto orientativo", question: "¿Conoces el presupuesto orientativo del cliente?" },
  { key: "validators", label: "Quién valida", question: "¿Quién valida el trabajo por parte del cliente?" },
];

export function isFilled(state: InterviewState, key: keyof Common): boolean {
  const v = state.common[key];
  return Array.isArray(v) ? v.length > 0 : Boolean(v && String(v).trim());
}

/** Modo guiado (sin IA): siguiente pregunta común sin respuesta. */
export function nextGuidedQuestion(state: InterviewState): (typeof COMMON_FIELDS)[number] | null {
  return COMMON_FIELDS.find((f) => !isFilled(state, f.key) && !state.asked_question_ids.includes(`common:${f.key}`)) ?? null;
}

/** Guarda la respuesta del modo guiado en el campo correspondiente. */
export function applyGuidedAnswer(state: InterviewState, fieldKey: keyof Common, answer: string): InterviewState {
  const next = structuredClone(state);
  const f = COMMON_FIELDS.find((x) => x.key === fieldKey);
  if (!f) return next;
  const value = answer.trim();
  if (f.list) (next.common[fieldKey] as string[]) = value.split(/[\n;]|,\s(?=[A-ZÁÉÍÓÚ])/).map((s) => s.trim()).filter(Boolean);
  else (next.common[fieldKey] as string) = value;
  next.asked_question_ids = [...new Set([...next.asked_question_ids, `common:${fieldKey}`])];
  return next;
}
