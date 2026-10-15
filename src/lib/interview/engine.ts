import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { MemberContext } from "@/lib/auth";
import { aiAvailable, callStructured } from "@/lib/ai/claude";
import { getCatalog, getQuestions } from "@/lib/data/catalog";
import { getSettings } from "@/lib/data/settings";
import { createQuote, loadQuote, saveQuoteDraft } from "@/lib/data/quotes";
import { draftingSystemPrompt, historyForModel, interviewSystemPrompt } from "./prompts";
import {
  applyGuidedAnswer,
  COMMON_FIELDS,
  InterviewState,
  mergePatch,
  nextGuidedQuestion,
  StatePatch,
  type ChatMessage,
  type Common,
} from "./state";
import { composeDraft, fallbackText, ProposalText } from "./draft";

export type Session = {
  id: string;
  status: "active" | "summary" | "completed" | "abandoned";
  state: InterviewState;
  messages: ChatMessage[];
  quote_id: string | null;
  client_id: string | null;
};

export async function loadSession(ctx: MemberContext, id: string): Promise<Session | null> {
  const { data } = await ctx.supabase
    .from("interview_sessions")
    .select("id, status, state, messages, quote_id, client_id")
    .eq("id", id)
    .eq("studio_id", ctx.studioId)
    .maybeSingle();
  if (!data) return null;
  return { ...data, state: InterviewState.parse(data.state ?? {}), messages: (data.messages ?? []) as ChatMessage[] } as Session;
}

export async function persistSession(ctx: MemberContext, s: Pick<Session, "id"> & Partial<Session>) {
  const { id, ...rest } = s;
  const { error } = await ctx.supabase.from("interview_sessions").update(rest).eq("id", id).eq("studio_id", ctx.studioId);
  if (error) throw new Error(error.message);
}

const TurnOutput = z.object({
  reply: z.string().min(1).max(3000),
  patch: StatePatch,
  asked_question_ids: z.array(z.string()).default([]),
  ready_for_summary: z.boolean().default(false),
});

/** Procesa un mensaje de la usuaria y devuelve la sesión actualizada. */
export async function runTurn(ctx: MemberContext, sessionId: string, message: string): Promise<Session> {
  const session = await loadSession(ctx, sessionId);
  if (!session) throw new Error("Entrevista no encontrada");
  if (session.status === "completed") throw new Error("Esta entrevista ya generó un presupuesto");

  const now = () => new Date().toISOString();
  const messages: ChatMessage[] = [...session.messages, { role: "user", content: message, at: now() }];
  const settings = await getSettings(ctx);
  let state = session.state;
  let reply: string;

  if (settings.ai_enabled && aiAvailable()) {
    const [{ services, categories }, questions] = await Promise.all([getCatalog(ctx), getQuestions(ctx)]);
    const out = await callStructured({
      model: settings.ai_model_interview,
      system: interviewSystemPrompt({ services, categories, questions, state }),
      messages: historyForModel(messages),
      toolName: "update_interview",
      toolDescription: "Actualiza el estado estructurado de la entrevista y redacta la siguiente intervención.",
      schema: TurnOutput,
      maxTokens: 4000,
    });
    state = mergePatch(state, out.patch, {
      validServiceIds: new Set(services.map((s) => s.id)),
      validQuestionIds: new Set(questions.map((q) => q.id)),
      newId: randomUUID,
    });
    state.asked_question_ids = [...new Set([...state.asked_question_ids, ...out.asked_question_ids])];
    if (state.stage === "intake") state.stage = "questions";
    reply = out.reply;
    if (out.ready_for_summary && !reply.toLowerCase().includes("resumen")) {
      reply += "\n\nCon esto ya puedo prepararte el resumen cuando quieras.";
    }
  } else {
    // Modo guiado sin IA: guarda la respuesta en el campo que se preguntó y pasa al siguiente.
    const lastAsked = [...state.asked_question_ids].reverse().find((q) => q.startsWith("common:"));
    if (state.stage === "intake") {
      state = { ...state, stage: "questions", classification: { ...state.classification, known_scope: message, main_need: message.slice(0, 300) } };
    } else if (lastAsked) {
      const key = lastAsked.slice("common:".length) as keyof Common;
      if (!isAnswered(state, key)) state = applyGuidedAnswer(state, key, message);
    }
    const next = nextGuidedQuestion(state);
    if (next) {
      state = { ...state, asked_question_ids: [...state.asked_question_ids, `common:${next.key}`] };
      reply = `Anotado. ${next.question}`;
    } else {
      reply = "Tengo los datos básicos. Revisa el resumen, añade los servicios del catálogo y genera el borrador.";
    }
    if (!aiAvailable()) reply += "\n\n(Modo guiado: la IA no está configurada en el servidor.)";
  }

  messages.push({ role: "assistant", content: reply, at: now() });
  await persistSession(ctx, { id: sessionId, state, messages });
  return { ...session, state, messages };
}

function isAnswered(state: InterviewState, key: keyof Common) {
  const v = state.common[key];
  return Array.isArray(v) ? v.length > 0 : Boolean(v);
}

export { COMMON_FIELDS };

/**
 * Genera el presupuesto: cliente y proyecto (si faltan), partidas desde el catálogo
 * con el motor de precios y textos redactados por la IA (o de respaldo).
 */
export async function buildQuoteFromInterview(ctx: MemberContext, sessionId: string): Promise<string> {
  const session = await loadSession(ctx, sessionId);
  if (!session) throw new Error("Entrevista no encontrada");
  if (session.quote_id) return session.quote_id;
  const state = session.state;
  if (!state.services.length && !state.recommendations.some((r) => r.status === "added")) {
    throw new Error("Añade al menos un servicio antes de generar el borrador");
  }

  const settings = await getSettings(ctx);
  const { services, categories } = await getCatalog(ctx);

  // Cliente: el vinculado, o uno nuevo con el nombre recogido (datos fiscales se completan después).
  let clientId = state.common.client_id ?? session.client_id;
  if (!clientId && state.common.client_name.trim()) {
    const { data, error } = await ctx.supabase
      .from("clients")
      .insert({ studio_id: ctx.studioId, trade_name: state.common.client_name.trim().slice(0, 200), sector: state.common.sector || null })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    clientId = data.id as string;
  }

  const { data: project, error: pe } = await ctx.supabase
    .from("projects")
    .insert({
      studio_id: ctx.studioId,
      client_id: clientId,
      name: (state.common.project_name || state.classification.project_type || "Proyecto").slice(0, 200),
      sector: state.common.sector || null,
      context: state.common.business_context || state.classification.main_need || null,
      objectives: state.common.objectives,
      target_audience: state.common.target_audience || null,
      starting_point: state.common.starting_point || null,
      languages: state.common.languages.length ? state.common.languages : ["Castellano"],
      desired_deadline: state.common.desired_deadline || null,
      status: "quoting",
    })
    .select("id")
    .single();
  if (pe) throw new Error(pe.message);

  let text: ProposalText;
  if (settings.ai_enabled && aiAvailable()) {
    try {
      text = await callStructured({
        model: settings.ai_model_drafting,
        system: draftingSystemPrompt({ services, state, studioName: settings.trade_name }),
        messages: [{ role: "user", content: "Redacta la propuesta con los datos confirmados. Devuélvela con la herramienta." }],
        toolName: "write_proposal",
        toolDescription: "Devuelve los textos estructurados de la propuesta (sin importes).",
        schema: ProposalText,
        maxTokens: 6000,
      });
    } catch (e) {
      console.error("[drafting] fallback", e);
      text = fallbackText(state, services, categories);
    }
  } else {
    text = fallbackText(state, services, categories);
  }

  const quoteId = await createQuote(ctx, { clientId, projectId: project.id as string, title: text.title });
  const loaded = await loadQuote(ctx, quoteId);
  if (!loaded) throw new Error("No se pudo abrir el presupuesto creado");
  const draft = composeDraft({ base: { ...loaded.draft, addressee: state.common.validators }, state, text, services, newId: randomUUID });
  await saveQuoteDraft(ctx, draft);

  await persistSession(ctx, { id: sessionId, status: "completed", quote_id: quoteId, client_id: clientId, state: { ...state, stage: "done" } });
  return quoteId;
}
