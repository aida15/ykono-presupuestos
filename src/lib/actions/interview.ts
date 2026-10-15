"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getMember } from "@/lib/auth";
import { buildQuoteFromInterview, loadSession, persistSession, runTurn, type Session } from "@/lib/interview/engine";
import { InterviewState, OPENING_QUESTION, emptyState } from "@/lib/interview/state";
import { run, type ActionResult } from "./result";

export async function startInterview(fd: FormData) {
  const res = await run(async () => {
    const ctx = await getMember();
    const clientId = (fd.get("client_id") as string) || null;
    const state = emptyState();
    if (clientId) {
      const { data } = await ctx.supabase.from("clients").select("id, trade_name, sector").eq("id", clientId).eq("studio_id", ctx.studioId).single();
      if (data) {
        state.common.client_id = data.id;
        state.common.client_name = data.trade_name;
        state.common.sector = data.sector ?? "";
      }
    }
    const { data, error } = await ctx.supabase
      .from("interview_sessions")
      .insert({
        studio_id: ctx.studioId,
        client_id: clientId,
        state,
        messages: [{ role: "assistant", content: OPENING_QUESTION, at: new Date().toISOString() }],
        created_by: ctx.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id as string;
  });
  if (!res.ok) throw new Error(res.error);
  redirect(`/entrevistas/${res.data}`);
}

export async function sendInterviewMessage(sessionId: string, message: string): Promise<ActionResult<Pick<Session, "state" | "messages">>> {
  return run(async () => {
    const text = z.string().trim().min(1, "Escribe algo").max(6000).parse(message);
    const ctx = await getMember();
    const s = await runTurn(ctx, sessionId, text);
    return { state: s.state, messages: s.messages };
  });
}

/** La usuaria edita el estado (clasificación, resumen, servicios, recomendaciones). */
export async function saveInterviewState(sessionId: string, state: unknown, status?: "active" | "summary"): Promise<ActionResult<InterviewState>> {
  return run(async () => {
    const ctx = await getMember();
    const parsed = InterviewState.parse(state);
    const session = await loadSession(ctx, sessionId);
    if (!session) throw new Error("Entrevista no encontrada");
    if (session.status === "completed") throw new Error("Esta entrevista ya generó un presupuesto");
    // Los servicios deben existir en el catálogo del estudio.
    const ids = [...new Set([...parsed.services.map((s) => s.service_id), ...parsed.recommendations.map((r) => r.service_id)])];
    if (ids.length) {
      const { data } = await ctx.supabase.from("services").select("id").eq("studio_id", ctx.studioId).in("id", ids);
      const valid = new Set((data ?? []).map((d) => d.id as string));
      parsed.services = parsed.services.filter((s) => valid.has(s.service_id));
      parsed.recommendations = parsed.recommendations.filter((r) => valid.has(r.service_id));
    }
    await persistSession(ctx, { id: sessionId, state: parsed, ...(status ? { status } : {}) });
    return parsed;
  });
}

export async function generateQuoteFromInterview(sessionId: string): Promise<ActionResult<never>> {
  const res = await run(async () => buildQuoteFromInterview(await getMember(), sessionId));
  if (!res.ok) return res;
  revalidatePath("/presupuestos");
  redirect(`/presupuestos/${res.data}`);
}

export async function abandonInterview(sessionId: string) {
  const ctx = await getMember();
  await persistSession(ctx, { id: sessionId, status: "abandoned" });
  redirect("/");
}

