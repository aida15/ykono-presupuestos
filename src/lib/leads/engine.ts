import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import type { MemberContext } from "@/lib/auth";
import { aiAvailable, callStructured } from "@/lib/ai/claude";
import { getCatalog } from "@/lib/data/catalog";
import { getSettings } from "@/lib/data/settings";
import type { ServiceWithRule } from "@/lib/data/types";
import { itemFromService } from "@/lib/domain/catalog-items";
import { computeQuote } from "@/lib/domain/pricing";
import { describeRule } from "@/lib/domain/describe";
import { scoreLead, suggestProducts, CRITERIA_BY_ID, type CriterionResult, type ServiceKey } from "./criteria";
import { evaluate, type BrandAssessment } from "./evaluate";
import { analyzeHtml, type SiteSignals } from "./html-signals";
import { fetchImage, fetchSite, normalizeWebsite } from "./fetch-site";
import { findPlace, getPlace, googleKey, inBasqueArea, pageSpeed, type PlaceLite } from "./google";
import { LeadPitch, pitchSystemPrompt, templatePitch, type PitchContext } from "./pitch";

export type LeadStatus = "new" | "analyzed" | "contacted" | "replied" | "converted" | "discarded";

export type LeadOffer = {
  key: ServiceKey;
  service_id: string;
  name: string;
  reasons: string[];
  net_cents: number | null;
  price_label: string;
};

export type LeadContact = {
  emails: string[];
  phones: string[];
  contactForm: boolean;
  social: SiteSignals["social"];
};

export type LeadRow = {
  id: string;
  studio_id: string;
  source: string;
  place_id: string | null;
  name: string;
  category: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  maps_url: string | null;
  google: (PlaceLite & { not_found?: boolean }) | null;
  status: LeadStatus;
  score: number | null;
  criteria: CriterionResult[];
  triggers: string[];
  manual_triggers: string[];
  site: (Omit<SiteSignals, "textSample"> & { fetchError: string | null; httpsWorks: boolean; performance: number | null; speedError?: string | null }) | null;
  offers: LeadOffer[];
  pitch: LeadPitch | null;
  contact: LeadContact | null;
  discard_reason: string | null;
  screenshot: string | null;
  notes: string;
  client_id: string | null;
  quote_id: string | null;
  analyzed_at: string | null;
  contacted_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Mismo id determinista que scripts/build-seed.mts para los servicios del catálogo inicial. */
export function seedServiceId(key: string) {
  const h = createHash("md5").update(`ykono:service:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export async function loadLead(ctx: MemberContext, id: string): Promise<LeadRow | null> {
  const { data } = await ctx.supabase.from("leads").select("*").eq("id", id).eq("studio_id", ctx.studioId).maybeSingle();
  return (data as LeadRow) ?? null;
}

async function saveLead(ctx: MemberContext, id: string, patch: Partial<LeadRow>) {
  const { error } = await ctx.supabase.from("leads").update(patch).eq("id", id).eq("studio_id", ctx.studioId);
  if (error) throw new Error(error.message);
}

/** Productos con precio orientativo calculado por el motor de precios con la tarifa vigente. */
export function priceProducts(suggestions: { key: ServiceKey; reasons: string[] }[], services: ServiceWithRule[]): LeadOffer[] {
  const out: LeadOffer[] = [];
  for (const s of suggestions) {
    const svc = services.find((x) => x.id === seedServiceId(s.key) && x.active);
    if (!svc) continue;
    const item = itemFromService(svc, { id: svc.id });
    const totals = computeQuote({
      lines: [{ ...item, id: "x" }],
      defaultVatBp: 2100,
    });
    const net = totals.lines.x?.net ?? null;
    out.push({
      key: s.key,
      service_id: svc.id,
      name: svc.name,
      reasons: s.reasons,
      net_cents: item.kind === "external" ? null : net,
      price_label: svc.rule ? describeRule(svc.rule, svc.unit) : "Sin tarifa",
    });
  }
  return out;
}

/** Aplica las correcciones manuales sobre los resultados automáticos. */
function mergeManual(auto: CriterionResult[], previous: CriterionResult[]): CriterionResult[] {
  const manual = new Map(previous.filter((r) => r.source === "manual").map((r) => [r.id, r]));
  return auto.map((r) => manual.get(r.id) ?? r);
}

function brandFromCriteria(results: CriterionResult[]): BrandAssessment | null {
  const get = (id: string) => results.find((r) => r.id === id && r.source !== "auto");
  const l = get("logo_quality");
  const v = get("visual_consistency");
  const p = get("photo_quality");
  if (!l && !v && !p) return null;
  const pick = (r: CriterionResult | undefined) => ({ met: r?.met ?? null, evidence: r?.evidence ?? "" });
  return { logo_quality: pick(l), visual_consistency: pick(v), photo_quality: pick(p) };
}

export async function recompute(ctx: MemberContext, lead: LeadRow, criteria: CriterionResult[]) {
  const { services } = await getCatalog(ctx);
  const triggers = [...lead.triggers, ...lead.manual_triggers];
  const score = scoreLead(criteria, triggers).score;
  const offers = priceProducts(suggestProducts(criteria, { sellsProducts: !!lead.site?.sellsProducts }), services);
  return { criteria, score, offers };
}

/* ------------------------------------------------------------------ */
/* Paso 1 · Datos: web, Google y PageSpeed                              */
/* ------------------------------------------------------------------ */

export async function collectLead(ctx: MemberContext, id: string): Promise<LeadRow> {
  const lead = await loadLead(ctx, id);
  if (!lead) throw new Error("Lead no encontrado");

  // Google: ficha fresca si la tenemos; si se añadió a mano, la buscamos.
  let place: PlaceLite | null = null;
  let placeState: "found" | "not_found" | "skipped" = "skipped";
  if (googleKey()) {
    place = lead.place_id ? await getPlace(lead.place_id) : await findPlace(lead.name, lead.city ?? lead.address).catch(() => null);
    placeState = place ? "found" : "not_found";
  }

  const website = normalizeWebsite(lead.website ?? place?.website ?? "") ;
  const isSocial = website ? /(instagram|facebook|fb|linktr|tiktok)\./i.test(website) : false;

  const [fetched, psi] = await Promise.all([
    website && !isSocial ? fetchSite(website) : Promise.resolve(null),
    website && !isSocial ? pageSpeed(website) : Promise.resolve(null),
  ]);

  const site = fetched?.html ? analyzeHtml(fetched.html, fetched.finalUrl) : null;
  const basqueArea = inBasqueArea(place?.address ?? lead.address, place?.postalCode ?? null, place?.province ?? null);

  const { results, autoTriggers } = evaluate({
    website,
    site,
    fetchError: fetched?.error ?? null,
    httpsWorks: fetched?.httpsWorks ?? false,
    place: placeState === "skipped" ? null : place ? { website: place.website, photoCount: place.photoCount, hasHours: place.hasHours } : "not_found",
    performance: psi?.performance ?? null,
    speedError: psi?.error ?? null,
    viewportOk: psi?.viewportOk ?? null,
    basqueArea,
    brand: brandFromCriteria(lead.criteria),
  });

  const criteria = mergeManual(results, lead.criteria);
  const leadForCalc = { ...lead, triggers: autoTriggers, site: site ? { ...site, fetchError: null, httpsWorks: false, performance: null } : null } as LeadRow;
  const { score, offers } = await recompute(ctx, leadForCalc, criteria);

  const closed = place?.businessStatus === "CLOSED_PERMANENTLY";
  const { textSample: _t, ...siteStored } = site ?? ({} as SiteSignals);
  void _t;

  const patch: Partial<LeadRow> = {
    place_id: place?.placeId ?? lead.place_id,
    website: website ?? lead.website,
    phone: lead.phone ?? place?.phone ?? site?.phones[0] ?? null,
    address: lead.address ?? place?.address ?? null,
    city: lead.city ?? place?.city ?? null,
    category: lead.category ?? place?.category ?? null,
    maps_url: place?.mapsUrl ?? lead.maps_url,
    google: place ? place : placeState === "not_found" ? ({ not_found: true } as LeadRow["google"]) : lead.google,
    site: site ? { ...(siteStored as Omit<SiteSignals, "textSample">), fetchError: fetched?.error ?? null, httpsWorks: fetched?.httpsWorks ?? false, performance: psi?.performance ?? null, speedError: psi?.error ?? null } : fetched ? ({ fetchError: fetched.error, speedError: psi?.error ?? null } as LeadRow["site"]) : null,
    criteria,
    triggers: autoTriggers,
    score,
    offers,
    contact: { emails: site?.emails ?? [], phones: site?.phones ?? [], contactForm: site?.contactForm ?? false, social: site?.social ?? {} },
    screenshot: psi?.screenshot ?? lead.screenshot,
    analyzed_at: new Date().toISOString(),
    status: closed ? "discarded" : lead.status === "new" ? "analyzed" : lead.status,
    discard_reason: closed ? "Cerrado definitivamente según Google" : lead.discard_reason,
  };
  await saveLead(ctx, id, patch);
  return { ...lead, ...patch } as LeadRow;
}

/* ------------------------------------------------------------------ */
/* Paso 2 · Argumentario (IA o plantillas)                              */
/* ------------------------------------------------------------------ */

function dataUrlToImage(dataUrl: string): Anthropic.ImageBlockParam | null {
  const m = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);
  if (!m) return null;
  return { type: "image", source: { type: "base64", media_type: m[1] as "image/jpeg", data: m[2] } };
}

export async function pitchLead(ctx: MemberContext, id: string): Promise<LeadRow> {
  const lead = await loadLead(ctx, id);
  if (!lead) throw new Error("Lead no encontrado");
  const settings = await getSettings(ctx);

  const pctx: PitchContext = {
    name: lead.name,
    category: lead.category,
    city: lead.city,
    website: lead.website,
    results: lead.criteria,
    triggers: [...lead.triggers, ...lead.manual_triggers],
    products: lead.offers.map((o) => ({ name: o.name, reasons: o.reasons })),
    agencyCredit: lead.site?.agencyCredit ?? null,
    studioName: settings.trade_name,
    studioCity: settings.city,
  };

  let pitch: LeadPitch = templatePitch(pctx);
  if (settings.ai_enabled && aiAvailable()) {
    const images: Anthropic.ImageBlockParam[] = [];
    const shot = lead.screenshot ? dataUrlToImage(lead.screenshot) : null;
    if (shot) images.push(shot);
    const logoUrl = lead.site?.logoUrl;
    if (logoUrl && /^https?:/.test(logoUrl) && !lead.site?.logoIsSvg) {
      const img = await fetchImage(logoUrl);
      if (img) images.push({ type: "image", source: { type: "base64", media_type: img.mediaType as "image/png", data: img.base64 } });
    }
    try {
      const out = await callStructured({
        model: settings.ai_model_drafting,
        system: pitchSystemPrompt(pctx, images.length > 0),
        messages: [
          {
            role: "user",
            content: [
              ...images,
              { type: "text", text: images.length ? "Imágenes: captura móvil de la web y, si hay segunda, el logotipo. Prepara el argumentario." : "Prepara el argumentario." },
            ],
          },
        ],
        toolName: "argumentario",
        toolDescription: "Valoración de marca, argumentos de venta y primer mensaje para el lead.",
        schema: LeadPitch,
        maxTokens: 3000,
      });
      pitch = { ...out, brand: images.length ? out.brand : null, generated_by: "ai" };
    } catch (e) {
      console.error("[leads] argumentario con IA", e);
    }
  }

  // La valoración de marca de la IA completa los criterios de marca (salvo correcciones manuales).
  let criteria = lead.criteria;
  if (pitch.brand) {
    criteria = criteria.map((r) => {
      const v = pitch.brand?.[r.id as keyof NonNullable<LeadPitch["brand"]>];
      return v && r.source !== "manual" ? { ...r, met: v.met, evidence: v.evidence || r.evidence, source: "ai" as const } : r;
    });
  }
  const { score, offers } = await recompute(ctx, lead, criteria);
  const patch: Partial<LeadRow> = { pitch, criteria, score, offers };
  await saveLead(ctx, id, patch);
  return { ...lead, ...patch };
}

/* ------------------------------------------------------------------ */
/* Correcciones manuales                                                */
/* ------------------------------------------------------------------ */

export async function overrideCriterion(ctx: MemberContext, id: string, criterionId: string, met: boolean | null) {
  const lead = await loadLead(ctx, id);
  if (!lead) throw new Error("Lead no encontrado");
  if (!CRITERIA_BY_ID[criterionId]) throw new Error("Criterio desconocido");
  const criteria = lead.criteria.map((r) =>
    r.id === criterionId ? { ...r, met, source: "manual" as const, evidence: r.evidence.startsWith("Corregido a mano") ? r.evidence : `Corregido a mano. ${r.evidence}` } : r,
  );
  const { score, offers } = await recompute(ctx, lead, criteria);
  await saveLead(ctx, id, { criteria, score, offers });
}

export async function setManualTriggers(ctx: MemberContext, id: string, triggers: string[]) {
  const lead = await loadLead(ctx, id);
  if (!lead) throw new Error("Lead no encontrado");
  const next = { ...lead, manual_triggers: triggers };
  const { score, offers } = await recompute(ctx, next, lead.criteria);
  await saveLead(ctx, id, { manual_triggers: triggers, score, offers });
}

export const newId = () => randomUUID();
