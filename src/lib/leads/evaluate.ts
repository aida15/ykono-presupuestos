/**
 * De señales a criterios «cumple / no cumple» con evidencia. Función pura.
 */
import type { CriterionResult } from "./criteria";
import { isOldTech, type SiteSignals } from "./html-signals";

export type PlaceInfo = { website: string | null; photoCount: number; hasHours: boolean } | null;

export type BrandAssessment = {
  logo_quality: { met: boolean | null; evidence: string };
  visual_consistency: { met: boolean | null; evidence: string };
  photo_quality: { met: boolean | null; evidence: string };
};

export type EvaluateInput = {
  website: string | null;
  site: SiteSignals | null;
  fetchError: string | null;
  httpsWorks: boolean;
  /** null = no se ha consultado Google (sin clave); undefined no se usa. */
  place: PlaceInfo | "not_found" | null;
  performance: number | null;
  viewportOk: boolean | null;
  basqueArea: boolean;
  brand: BrandAssessment | null;
  now?: Date;
};

const SOCIAL_AS_WEB = /(instagram|facebook|fb|linktr|linkin\.bio|tiktok)\./i;

export function evaluate(input: EvaluateInput): { results: CriterionResult[]; autoTriggers: string[] } {
  const now = input.now ?? new Date();
  const r: CriterionResult[] = [];
  const push = (id: string, met: boolean | null, evidence: string, source: CriterionResult["source"] = "auto") => r.push({ id, met, evidence, source });
  const s = input.site;

  // Web propia
  if (!input.website) {
    push("has_website", false, "No tiene web: ni enlazada en Google ni conocida.");
  } else if (SOCIAL_AS_WEB.test(input.website)) {
    push("has_website", false, `Su «web» es un perfil de redes (${new URL(input.website).hostname}).`);
  } else if (!s) {
    push("has_website", false, input.fetchError ? `${input.fetchError}.` : "La web no carga.");
  } else {
    push("has_website", true, new URL(s.finalUrl).hostname);
  }

  if (s) {
    if (!s.https || !input.httpsWorks) push("https", false, "La web se sirve sin HTTPS: el navegador avisa de «No seguro».");
    else if (s.mixedContent) push("https", false, "Tiene HTTPS, pero carga recursos inseguros (contenido mixto).");
    else push("https", true, "HTTPS correcto.");

    const mobileOk = input.viewportOk ?? s.viewport;
    push("mobile", mobileOk, mobileOk ? "Preparada para pantallas de móvil." : "No está preparada para móvil (falta la configuración de pantalla).");

    if (s.copyrightYear) {
      const age = now.getFullYear() - s.copyrightYear;
      push("updated", age < 3, age < 3 ? `© ${s.copyrightYear} en el pie.` : `El pie de la web dice © ${s.copyrightYear}: lleva ${age} años sin actualizarse.`);
    } else {
      push("updated", null, "No indica año en el pie.");
    }

    const old = isOldTech(s);
    push("modern_tech", !old, old ?? (s.wordpressVersion ? `WordPress ${s.wordpressVersion}.` : "Sin señales de tecnología antigua."));

    push("own_domain", !s.freeBuilder, s.freeBuilder ? `Usa un subdominio de ${s.freeBuilder}.` : new URL(s.finalUrl).hostname);

    if (!s.emails.length) push("pro_email", null, "No se ve ningún email en la portada.");
    else push("pro_email", !s.genericEmail, s.genericEmail ? `El contacto es ${s.emails[0]}.` : `Contacto: ${s.emails[0]}.`);

    if (input.performance === null) push("performance", null, "No se ha podido medir la velocidad.");
    else push("performance", input.performance >= 50, `PageSpeed móvil: ${input.performance}/100.`);

    const missing = [!s.title && "título", !s.metaDescription && "descripción", !s.h1 && "encabezado principal (H1)"].filter(Boolean);
    push("seo_basics", missing.length === 0, missing.length ? `Le falta: ${missing.join(", ")}.` : "Título, descripción y H1 presentes.");

    const legalMissing = [!s.legal.avisoLegal && "aviso legal", !s.legal.privacidad && "política de privacidad", !s.legal.cookies && "aviso de cookies"].filter(Boolean);
    push("legal", legalMissing.length === 0, legalMissing.length ? `No se encuentra: ${legalMissing.join(", ")}.` : "Textos legales enlazados.");

    if (s.sellsProducts) {
      push("shop", !!s.shopPlatform, s.shopPlatform ? `Tienda con ${s.shopPlatform}.` : s.orderByWhatsapp ? "Vende productos pero los pedidos van por WhatsApp." : "Muestra productos pero no se pueden comprar online.");
    } else {
      push("shop", null, "No parece vender productos.");
    }

    if (input.basqueArea) push("basque", s.basque, s.basque ? "Tiene versión en euskera." : "Está en Euskadi/Navarra y la web solo está en castellano.");
    else push("basque", null, "Fuera de Euskadi y Navarra.");

    push("favicon", s.favicon, s.favicon ? "Tiene favicon." : "Sin favicon: en la pestaña sale el icono genérico.");
    const nets = Object.keys(s.social);
    push("social", nets.length > 0, nets.length ? `Enlaza ${nets.join(", ")}.` : "La web no enlaza ninguna red social.");
  } else {
    for (const id of ["https", "mobile", "updated", "modern_tech", "own_domain", "pro_email", "performance", "seo_basics", "legal", "shop", "basque", "favicon", "social"]) {
      push(id, null, "Sin web que analizar.");
    }
  }

  // Marca (valoración visual de la IA)
  const b = input.brand;
  push("logo_quality", b?.logo_quality.met ?? null, b?.logo_quality.evidence || "Sin valoración visual.", b ? "ai" : "auto");
  push("visual_consistency", b?.visual_consistency.met ?? null, b?.visual_consistency.evidence || "Sin valoración visual.", b ? "ai" : "auto");
  push("photo_quality", b?.photo_quality.met ?? null, b?.photo_quality.evidence || "Sin valoración visual.", b ? "ai" : "auto");

  // Google
  const p = input.place;
  if (p === null) {
    for (const id of ["gbp_exists", "gbp_website", "gbp_photos", "gbp_hours"]) push(id, null, "Google no consultado (falta la clave de Google).");
  } else if (p === "not_found") {
    push("gbp_exists", false, "No aparece con ficha en Google Maps.");
    for (const id of ["gbp_website", "gbp_photos", "gbp_hours"]) push(id, null, "Sin ficha.");
  } else {
    push("gbp_exists", true, "Tiene ficha en Google Maps.");
    push("gbp_website", !!p.website, p.website ? "La ficha enlaza a la web." : "La ficha no enlaza ninguna web.");
    push("gbp_photos", p.photoCount >= 5, `${p.photoCount === 0 ? "Ninguna foto" : `${p.photoCount}${p.photoCount >= 10 ? "+" : ""} fotos`} en la ficha.`);
    push("gbp_hours", p.hasHours, p.hasHours ? "Horario publicado." : "La ficha no tiene horario.");
  }

  const autoTriggers: string[] = [];
  if (s?.copyrightYear && now.getFullYear() - s.copyrightYear >= 4) autoTriggers.push("stale_site");
  if (s?.mentionsOpening) autoTriggers.push("opening");
  if (s?.mentionsHiring) autoTriggers.push("hiring");

  return { results: r, autoTriggers };
}
