"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getMember } from "@/lib/auth";
import { createQuote, loadQuote, saveQuoteDraft } from "@/lib/data/quotes";
import { getCatalog } from "@/lib/data/catalog";
import { itemFromService } from "@/lib/domain/catalog-items";
import { makeSection } from "@/lib/domain/templates";
import { CRITERIA_BY_ID, TRIGGERS } from "@/lib/leads/criteria";
import { searchPlaces, googleKey } from "@/lib/leads/google";
import { normalizeWebsite } from "@/lib/leads/fetch-site";
import { collectLead, loadLead, overrideCriterion, pitchLead, setManualTriggers, type LeadStatus } from "@/lib/leads/engine";
import { run, type ActionResult } from "./result";

const Search = z.object({
  query: z.string().trim().min(2, "Indica qué tipo de negocio buscas").max(120),
  location: z.string().trim().min(2, "Indica dónde").max(120),
  pageToken: z.string().max(500).optional(),
});

/** Busca en Google Places y guarda los negocios nuevos como leads. */
export async function searchLeads(input: unknown): Promise<ActionResult<{ found: number; added: number; nextPageToken: string | null; fresh: { id: string; name: string }[] }>> {
  return run(async () => {
    const ctx = await getMember();
    if (!googleKey()) throw new Error("Falta la variable GOOGLE_API_KEY en Vercel para buscar en Google.");
    const { query, location, pageToken } = Search.parse(input);
    const { places, nextPageToken } = await searchPlaces(`${query} en ${location}`, pageToken);

    const { data: search } = await ctx.supabase
      .from("lead_searches")
      .insert({ studio_id: ctx.studioId, query, location, results_count: places.length, created_by: ctx.userId })
      .select("id")
      .single();

    const placeIds = places.map((p) => p.placeId);
    const { data: existing } = placeIds.length
      ? await ctx.supabase.from("leads").select("id, place_id").eq("studio_id", ctx.studioId).in("place_id", placeIds)
      : { data: [] as { id: string; place_id: string }[] };
    const known = new Map((existing ?? []).map((e) => [e.place_id as string, e.id as string]));

    const fresh = places.filter((p) => !known.has(p.placeId));
    const rows = fresh.map((p) => ({
      id: randomUUID(),
      studio_id: ctx.studioId,
      search_id: search?.id ?? null,
      source: "google_places",
      place_id: p.placeId,
      name: p.name,
      category: p.category,
      website: p.website,
      phone: p.phone,
      address: p.address,
      city: p.city,
      maps_url: p.mapsUrl,
      google: p,
      status: p.businessStatus === "CLOSED_PERMANENTLY" ? "discarded" : "new",
      discard_reason: p.businessStatus === "CLOSED_PERMANENTLY" ? "Cerrado definitivamente según Google" : null,
      created_by: ctx.userId,
    }));
    if (rows.length) {
      const { error } = await ctx.supabase.from("leads").insert(rows);
      if (error) throw new Error(error.message);
    }
    revalidatePath("/leads");
    return { found: places.length, added: rows.length, nextPageToken, fresh: rows.filter((r) => r.status === "new").map((r) => ({ id: r.id, name: r.name })) };
  });
}

const Manual = z.object({
  name: z.string().trim().min(2, "Nombre obligatorio").max(200),
  website: z.string().trim().max(300).optional(),
  city: z.string().trim().max(120).optional(),
});

export async function addManualLead(input: unknown): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await getMember();
    const d = Manual.parse(input);
    const website = d.website ? normalizeWebsite(d.website) : null;
    if (d.website && !website) throw new Error("La dirección web no es válida");
    const id = randomUUID();
    const { error } = await ctx.supabase.from("leads").insert({
      id,
      studio_id: ctx.studioId,
      source: "manual",
      name: d.name,
      website,
      city: d.city || null,
      created_by: ctx.userId,
    });
    if (error) throw new Error(error.message.includes("duplicate") ? "Ya tienes un lead con esa web" : error.message);
    revalidatePath("/leads");
    return { id };
  });
}

/** Paso 1 del análisis: web, Google y velocidad. */
export async function analyzeLeadData(id: string): Promise<ActionResult<{ score: number | null }>> {
  return run(async () => {
    const lead = await collectLead(await getMember(), z.string().uuid().parse(id));
    revalidatePath("/leads");
    return { score: lead.score };
  });
}

/** Paso 2 del análisis: valoración de marca y argumentario. */
export async function analyzeLeadPitch(id: string): Promise<ActionResult<{ score: number | null }>> {
  return run(async () => {
    const lead = await pitchLead(await getMember(), z.string().uuid().parse(id));
    revalidatePath("/leads");
    revalidatePath(`/leads/${id}`);
    return { score: lead.score };
  });
}

export async function setCriterion(id: string, criterionId: string, met: boolean | null): Promise<ActionResult> {
  const res = await run(async () => {
    await overrideCriterion(await getMember(), id, criterionId, met);
  });
  revalidatePath(`/leads/${id}`);
  return res;
}

export async function toggleTrigger(id: string, triggerId: string, on: boolean): Promise<ActionResult> {
  const res = await run(async () => {
    const ctx = await getMember();
    if (!TRIGGERS.some((t) => t.id === triggerId && !t.auto)) throw new Error("Señal desconocida");
    const lead = await loadLead(ctx, id);
    if (!lead) throw new Error("Lead no encontrado");
    const next = on ? [...new Set([...lead.manual_triggers, triggerId])] : lead.manual_triggers.filter((t) => t !== triggerId);
    await setManualTriggers(ctx, id, next);
  });
  revalidatePath(`/leads/${id}`);
  return res;
}

const StatusInput = z.enum(["new", "analyzed", "contacted", "replied", "converted", "discarded"]);

export async function setLeadStatus(id: string, status: string, discardReason?: string): Promise<ActionResult> {
  const res = await run(async () => {
    const ctx = await getMember();
    const s = StatusInput.parse(status) as LeadStatus;
    const patch: Record<string, unknown> = { status: s };
    if (s === "contacted") patch.contacted_at = new Date().toISOString();
    if (s === "discarded") patch.discard_reason = (discardReason ?? "").slice(0, 300) || "Descartado a mano";
    else patch.discard_reason = null;
    const { error } = await ctx.supabase.from("leads").update(patch).eq("id", id).eq("studio_id", ctx.studioId);
    if (error) throw new Error(error.message);
  });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  return res;
}

export async function saveLeadNotes(id: string, notes: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await getMember();
    const { error } = await ctx.supabase.from("leads").update({ notes: notes.slice(0, 4000) }).eq("id", id).eq("studio_id", ctx.studioId);
    if (error) throw new Error(error.message);
  });
}

export async function deleteLead(id: string) {
  const res = await run(async () => {
    const ctx = await getMember();
    const { error } = await ctx.supabase.from("leads").delete().eq("id", id).eq("studio_id", ctx.studioId);
    if (error) throw new Error(error.message);
  });
  if (!res.ok) return res;
  revalidatePath("/leads");
  redirect("/leads");
}

/**
 * Convierte el lead en cliente + presupuesto en borrador con los productos
 * ofertables como partidas (precios del catálogo) y los hallazgos como punto de partida.
 */
export async function convertLeadToQuote(id: string) {
  const res = await run(async () => {
    const ctx = await getMember();
    const lead = await loadLead(ctx, id);
    if (!lead) throw new Error("Lead no encontrado");
    if (lead.quote_id) return lead.quote_id;

    let clientId = lead.client_id;
    if (!clientId) {
      const email = lead.contact?.emails[0] ?? null;
      const { data, error } = await ctx.supabase
        .from("clients")
        .insert({
          studio_id: ctx.studioId,
          trade_name: lead.name.slice(0, 200),
          sector: lead.category,
          website: lead.website,
          phone: lead.phone,
          email,
          address_line: lead.address,
          city: lead.city,
          notes: "Creado desde Leads.",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      clientId = data.id as string;
    }

    const quoteId = await createQuote(ctx, { clientId, title: `Propuesta para ${lead.name}` });
    const loaded = await loadQuote(ctx, quoteId);
    if (!loaded) throw new Error("No se pudo abrir el presupuesto");
    const { services } = await getCatalog(ctx);
    const phaseId = randomUUID();
    const items = lead.offers
      .map((o) => services.find((s) => s.id === o.service_id))
      .filter((s): s is NonNullable<typeof s> => !!s)
      .map((s) => {
        const item = itemFromService(s, { id: randomUUID(), phaseId });
        const reasons = lead.offers.find((o) => o.service_id === s.id)?.reasons ?? [];
        item.description = [item.description, reasons.length ? `Motivo: ${reasons.join("; ")}.` : ""].filter(Boolean).join(" ");
        return item;
      });

    const gaps = lead.criteria.filter((c) => c.met === false && CRITERIA_BY_ID[c.id]);
    const sections = loaded.draft.sections.map((s) =>
      s.type === "summary"
        ? { ...s, title: "Qué podemos mejorar juntos", content: { ...s.content, body: lead.pitch?.summary ?? "", bullets: lead.pitch?.client_arguments ?? [] } }
        : s,
    );
    const summaryIdx = sections.findIndex((s) => s.type === "summary");
    sections.splice(summaryIdx + 1, 0, makeSection("starting_point", randomUUID(), {
      title: "Lo que hemos visto",
      content: { kicker: "Punto de partida", bullets: gaps.slice(0, 8).map((g) => `${CRITERIA_BY_ID[g.id].label}: ${g.evidence}`) },
    }));

    await saveQuoteDraft(ctx, {
      ...loaded.draft,
      sections,
      phases: [{ id: phaseId, name: "Propuesta inicial", description: "", deliverables: [], timing: "" }],
      items,
      notes_internal: `Creado desde el lead «${lead.name}». Puntuación ${lead.score ?? "–"}.`,
    });

    await ctx.supabase.from("leads").update({ status: "converted", client_id: clientId, quote_id: quoteId }).eq("id", id).eq("studio_id", ctx.studioId);
    return quoteId;
  });
  if (!res.ok) return res;
  revalidatePath("/leads");
  redirect(`/presupuestos/${res.data}`);
}
