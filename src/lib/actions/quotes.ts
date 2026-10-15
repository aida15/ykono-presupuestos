"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMember } from "@/lib/auth";
import { copyQuote, createQuote, loadQuote, saveQuoteDraft } from "@/lib/data/quotes";
import { validateForFinalize, type ValidationProblem } from "@/lib/domain/quote";
import { QuoteStatus } from "@/lib/domain/schemas";
import { run, type ActionResult } from "./result";

export async function saveQuote(draft: unknown): Promise<ActionResult<{ savedAt: string }>> {
  const res = await run(async () => {
    const ctx = await getMember();
    await saveQuoteDraft(ctx, draft);
    return { savedAt: new Date().toISOString() };
  });
  if (res.ok && draft && typeof draft === "object" && "id" in draft) {
    revalidatePath(`/presupuestos/${(draft as { id: string }).id}`);
  }
  return res;
}

export async function createManualQuote(fd: FormData) {
  const res = await run(async () => {
    const ctx = await getMember();
    return createQuote(ctx, {
      clientId: (fd.get("client_id") as string) || null,
      title: String(fd.get("title") ?? "").slice(0, 200),
    });
  });
  if (!res.ok) throw new Error(res.error);
  redirect(`/presupuestos/${res.data}`);
}

/**
 * Cambia el estado. Para salir de borrador valida en servidor (nunca solo en el
 * navegador) y congela una copia de los datos del cliente.
 */
export async function setQuoteStatus(
  id: string,
  status: string,
): Promise<ActionResult<{ problems: ValidationProblem[] }>> {
  const res = await run(async () => {
    const ctx = await getMember();
    const next = QuoteStatus.parse(status);
    const loaded = await loadQuote(ctx, id);
    if (!loaded) throw new Error("Presupuesto no encontrado");
    const { draft, meta } = loaded;

    const allowed: Record<string, string[]> = {
      draft: ["ready", "archived"],
      ready: ["draft", "sent", "archived"],
      sent: ["accepted", "rejected", "archived"],
      accepted: ["archived"],
      rejected: ["archived"],
      archived: ["draft"],
    };
    if (!allowed[draft.status]?.includes(next)) {
      throw new Error(`No se puede pasar de «${draft.status}» a «${next}»`);
    }

    const patch: Record<string, unknown> = { status: next };
    if (draft.status === "draft" && next === "ready") {
      const problems = validateForFinalize(draft, meta.client);
      if (problems.length) return { problems };
      patch.finalized_at = new Date().toISOString();
      patch.client_snapshot = meta.client;
    }
    if (next === "draft") patch.finalized_at = null;
    if (next === "sent") patch.sent_at = new Date().toISOString();
    // Volver a borrador desde archivado solo si nunca se cerró.
    if (draft.status === "archived" && next === "draft" && meta.finalized_at) {
      throw new Error("Este presupuesto ya se cerró. Crea una nueva versión para modificarlo.");
    }

    const { error } = await ctx.supabase.from("quotes").update(patch).eq("id", id).eq("studio_id", ctx.studioId);
    if (error) throw new Error(error.message);
    return { problems: [] };
  });
  revalidatePath(`/presupuestos/${id}`);
  revalidatePath("/presupuestos");
  return res;
}

export async function newQuoteVersion(id: string) {
  const res = await run(async () => copyQuote(await getMember(), id, true));
  if (!res.ok) return res;
  redirect(`/presupuestos/${res.data}`);
}

export async function duplicateQuote(id: string) {
  const res = await run(async () => copyQuote(await getMember(), id, false));
  if (!res.ok) return res;
  redirect(`/presupuestos/${res.data}`);
}

export async function deleteDraftQuote(id: string) {
  const res = await run(async () => {
    const ctx = await getMember();
    const { data } = await ctx.supabase.from("quotes").select("status").eq("id", id).eq("studio_id", ctx.studioId).single();
    if (!data) throw new Error("Presupuesto no encontrado");
    if (data.status !== "draft") throw new Error("Solo se pueden eliminar borradores. Archiva los demás.");
    const { count } = await ctx.supabase.from("generated_documents").select("id", { count: "exact", head: true }).eq("quote_id", id);
    if (count) throw new Error("Este borrador ya generó documentos. Archívalo en lugar de borrarlo.");
    const { error } = await ctx.supabase.from("quotes").delete().eq("id", id);
    if (error) throw new Error(error.message);
  });
  if (!res.ok) return res;
  revalidatePath("/presupuestos");
  redirect("/presupuestos");
}
