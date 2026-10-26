/**
 * Criterios con los que se valora un lead.
 *
 * Cada criterio es una buena práctica. Si el negocio NO la cumple, es una
 * oportunidad: suma a la puntuación, aporta un argumento de venta y apunta a
 * uno o varios servicios del catálogo.
 *
 * No se usan reseñas, valoraciones, empleados ni facturación (decisión de negocio).
 */

export type Axis = "web" | "brand" | "google";

export const AXIS_LABEL: Record<Axis, string> = {
  web: "Web",
  brand: "Marca",
  google: "Google",
};

/** Claves de servicio del catálogo inicial (src/lib/catalog/seed-data.ts). */
export type ServiceKey =
  | "web-design-template"
  | "web-dev-template"
  | "landing"
  | "ecommerce"
  | "extra-language"
  | "seo-basic"
  | "web-refresh"
  | "google-business"
  | "pro-email"
  | "logo"
  | "visual-system"
  | "brand-manual"
  | "brand-applications"
  | "social-templates"
  | "photography";

export type CriterionDef = {
  id: string;
  axis: Axis;
  /** Buena práctica, en positivo: «Web segura (HTTPS)». */
  label: string;
  weight: number;
  /** Por qué es una oportunidad, para el estudio. */
  internal: string;
  /** El beneficio contado al cliente. */
  client: string;
};

export const CRITERIA: CriterionDef[] = [
  // Web -----------------------------------------------------------------------
  { id: "has_website", axis: "web", label: "Tiene web propia", weight: 4,
    internal: "No tiene web: depende de terceros (redes o Google) para que le conozcan.",
    client: "Una web propia es el único escaparate que controláis vosotros: lo que se dice, cómo se ve y cómo os contactan." },
  { id: "https", axis: "web", label: "Web segura (HTTPS)", weight: 2,
    internal: "La web no es segura: el navegador muestra «No seguro» a cada visita.",
    client: "Hoy los navegadores avisan de «sitio no seguro» y mucha gente se va antes de leer nada. Es fácil de resolver." },
  { id: "mobile", axis: "web", label: "Adaptada a móvil", weight: 3,
    internal: "La web no está adaptada a móvil, donde llega la mayoría de visitas.",
    client: "La mayoría de la gente os busca desde el móvil. Una web que se ve bien ahí se traduce en más llamadas y visitas." },
  { id: "updated", axis: "web", label: "Web actualizada", weight: 2,
    internal: "La web lleva años sin tocarse: transmite abandono.",
    client: "Una web al día transmite que el negocio está vivo y cuidado; una desactualizada, lo contrario." },
  { id: "modern_tech", axis: "web", label: "Tecnología actual", weight: 2,
    internal: "Está hecha con tecnología antigua o un constructor gratuito: difícil de mantener y de posicionar.",
    client: "Una base moderna permite actualizar la web vosotros mismos y crecer sin tener que rehacerla." },
  { id: "own_domain", axis: "web", label: "Dominio propio", weight: 2,
    internal: "No tiene dominio propio (subdominio gratuito o solo redes).",
    client: "Un dominio propio da credibilidad y es vuestro: no depende de ninguna plataforma." },
  { id: "pro_email", axis: "web", label: "Correo con dominio propio", weight: 1,
    internal: "Usa un correo genérico (gmail, hotmail…) para el negocio.",
    client: "Escribir desde nombre@vuestronegocio da una imagen mucho más profesional que una cuenta de Gmail." },
  { id: "performance", axis: "web", label: "Carga rápida en móvil", weight: 1,
    internal: "La web carga lenta en móvil.",
    client: "Cada segundo de espera hace que parte de las visitas se vaya. Una web rápida retiene más clientes." },
  { id: "seo_basics", axis: "web", label: "SEO básico (título, descripción y encabezado)", weight: 1,
    internal: "Le falta lo básico para aparecer bien en Google.",
    client: "Con unos ajustes básicos, Google entiende qué hacéis y dónde, y os muestra a quien os busca." },
  { id: "legal", axis: "web", label: "Aviso legal, privacidad y cookies", weight: 1,
    internal: "Le faltan los textos legales obligatorios.",
    client: "Tener la web en regla os evita problemas y da confianza a quien os deja sus datos." },
  { id: "shop", axis: "web", label: "Venta online", weight: 2,
    internal: "Vende productos pero no tiene tienda online.",
    client: "Una tienda online vende también cuando el local está cerrado y llega a clientes fuera de la zona." },
  { id: "basque", axis: "web", label: "Disponible en euskera", weight: 1,
    internal: "Está en Euskadi o Navarra y la web no está en euskera.",
    client: "Tener la web en euskera acerca el negocio a parte de vuestro público y abre la puerta a clientes públicos." },
  // Marca ---------------------------------------------------------------------
  { id: "favicon", axis: "brand", label: "Icono propio en el navegador (favicon)", weight: 1,
    internal: "Ni siquiera tiene favicon: la marca no está cuidada en los detalles.",
    client: "Son los detalles los que hacen que una marca se reconozca: en la pestaña del navegador, en Google, en el móvil." },
  { id: "logo_quality", axis: "brand", label: "Logotipo nítido y profesional", weight: 3,
    internal: "El logotipo se ve poco profesional o de baja calidad.",
    client: "El logotipo es lo primero que se ve y lo que más se repite. Uno sólido hace que el negocio parezca lo que es." },
  { id: "visual_consistency", axis: "brand", label: "Imagen visual coherente", weight: 2,
    internal: "Colores, tipografías y estilo no siguen un sistema.",
    client: "Cuando todo comparte colores, letra y estilo, el negocio se reconoce a la primera y transmite confianza." },
  { id: "photo_quality", axis: "brand", label: "Fotografía propia y de calidad", weight: 1,
    internal: "Usa fotos de banco o de baja calidad.",
    client: "Las fotos propias y bien hechas enseñan vuestro trabajo real y venden más que cualquier imagen de banco." },
  { id: "social", axis: "brand", label: "Redes sociales enlazadas", weight: 1,
    internal: "No enlaza redes sociales desde la web.",
    client: "Unas redes cuidadas y enlazadas desde la web mantienen la marca presente entre visita y visita." },
  // Google --------------------------------------------------------------------
  { id: "gbp_exists", axis: "google", label: "Ficha de Google Business", weight: 3,
    internal: "No aparece con ficha en Google Maps.",
    client: "Cuando alguien busca lo que hacéis cerca, Google enseña primero las fichas del mapa. Sin ficha, no estáis." },
  { id: "gbp_website", axis: "google", label: "Web enlazada en la ficha de Google", weight: 1,
    internal: "La ficha de Google no enlaza a la web.",
    client: "Enlazar la web desde Google lleva a la gente directamente a vuestra información y servicios." },
  { id: "gbp_photos", axis: "google", label: "Fotos suficientes en la ficha", weight: 1,
    internal: "La ficha de Google tiene pocas fotos.",
    client: "Las fichas con buenas fotos reciben muchas más visitas y llamadas que las que no tienen." },
  { id: "gbp_hours", axis: "google", label: "Horario publicado en Google", weight: 1,
    internal: "La ficha no tiene horario.",
    client: "Con el horario a la vista, nadie se encuentra la puerta cerrada ni os llama a deshora." },
];

export const CRITERIA_BY_ID = Object.fromEntries(CRITERIA.map((c) => [c.id, c])) as Record<string, CriterionDef>;

/** met: true = cumple · false = no cumple (oportunidad) · null = no se ha podido comprobar o no aplica. */
export type CriterionResult = { id: string; met: boolean | null; evidence: string; source: "auto" | "ai" | "manual" };

/* ------------------------------------------------------------------ */
/* Señales de momento                                                   */
/* ------------------------------------------------------------------ */

export const TRIGGERS: { id: string; label: string; auto: boolean; argument: string }[] = [
  { id: "stale_site", label: "Web sin actualizar desde hace años", auto: true,
    argument: "Llevan tiempo sin invertir en su imagen: es un buen momento para plantear un cambio." },
  { id: "opening", label: "Anuncia apertura, traslado o novedad", auto: true,
    argument: "Están en un cambio (apertura, traslado, nueva sede): es cuando más se invierte en imagen." },
  { id: "hiring", label: "Busca personal", auto: true,
    argument: "Están contratando: el negocio crece y la imagen tiene que acompañar." },
  { id: "new_company", label: "Empresa de reciente creación", auto: false,
    argument: "Acaban de empezar: necesitan construir la marca desde el principio." },
  { id: "change", label: "Cambio de nombre, socios o relevo", auto: false,
    argument: "Hay un cambio de etapa: momento natural para renovar la marca." },
  { id: "grants", label: "Ayudas públicas disponibles (SPRI, Diputación…)", auto: false,
    argument: "Pueden acogerse a ayudas que cubran parte de la inversión." },
];

export const TRIGGER_BY_ID = Object.fromEntries(TRIGGERS.map((t) => [t.id, t]));

/* ------------------------------------------------------------------ */
/* Puntuación                                                           */
/* ------------------------------------------------------------------ */

export type ScoreBreakdown = {
  score: number;
  level: "alta" | "media" | "baja";
  byAxis: Record<Axis, { gaps: number; evaluated: number; pct: number | null }>;
  triggers: number;
};

/**
 * Oportunidad = peso de lo que NO cumple / peso de lo evaluado (0–85)
 *             + 5 puntos por señal de momento (máx. 15).
 */
export function scoreLead(results: CriterionResult[], triggerIds: string[]): ScoreBreakdown {
  const byAxis = { web: { gaps: 0, evaluated: 0 }, brand: { gaps: 0, evaluated: 0 }, google: { gaps: 0, evaluated: 0 } } as Record<Axis, { gaps: number; evaluated: number }>;
  let gaps = 0;
  let evaluated = 0;
  for (const r of results) {
    const def = CRITERIA_BY_ID[r.id];
    if (!def || r.met === null) continue;
    evaluated += def.weight;
    byAxis[def.axis].evaluated += def.weight;
    if (!r.met) {
      gaps += def.weight;
      byAxis[def.axis].gaps += def.weight;
    }
  }
  const triggers = new Set(triggerIds).size;
  const base = evaluated === 0 ? 0 : (gaps / evaluated) * 85;
  const score = Math.min(100, Math.round(base + Math.min(triggers, 3) * 5));
  return {
    score,
    level: score >= 55 ? "alta" : score >= 30 ? "media" : "baja",
    byAxis: Object.fromEntries(
      (Object.keys(byAxis) as Axis[]).map((a) => [a, { ...byAxis[a], pct: byAxis[a].evaluated ? Math.round((byAxis[a].gaps / byAxis[a].evaluated) * 100) : null }]),
    ) as ScoreBreakdown["byAxis"],
    triggers,
  };
}

/* ------------------------------------------------------------------ */
/* De oportunidades a productos                                         */
/* ------------------------------------------------------------------ */

export type ProductSuggestion = { key: ServiceKey; reasons: string[] };

/**
 * Traduce lo que no cumple en servicios del catálogo. Reglas deterministas:
 * - Sin web, no adaptada a móvil o tecnología antigua → web nueva (diseño + desarrollo + SEO).
 * - Si la base sirve y solo hay fallos técnicos → puesta al día.
 * - Logotipo flojo → logotipo + sistema visual (si tampoco hay coherencia) + manual básico.
 */
export function suggestProducts(results: CriterionResult[], opts: { sellsProducts: boolean }): ProductSuggestion[] {
  const fails = new Set(results.filter((r) => r.met === false).map((r) => r.id));
  const out = new Map<ServiceKey, string[]>();
  const add = (k: ServiceKey, reason: string) => out.set(k, [...(out.get(k) ?? []), reason]);

  const needsNewWeb = fails.has("has_website") || fails.has("mobile") || fails.has("modern_tech") || fails.has("own_domain");
  if (needsNewWeb) {
    const why = fails.has("has_website")
      ? "No tiene web propia"
      : fails.has("mobile")
        ? "La web no se adapta al móvil"
        : fails.has("modern_tech")
          ? "La web está hecha con tecnología antigua"
          : "No tiene dominio propio";
    if (fails.has("has_website")) {
      add("landing", `${why}: una web sencilla de una página es el primer paso`);
    } else {
      add("web-design-template", why);
      add("web-dev-template", why);
    }
    add("seo-basic", "Que la web nueva aparezca bien en Google");
  } else {
    const tech = ["https", "performance", "legal", "updated"].filter((id) => fails.has(id));
    if (tech.length) add("web-refresh", `Poner al día: ${tech.map((id) => CRITERIA_BY_ID[id].label.toLowerCase()).join(", ")}`);
    if (fails.has("seo_basics")) add("seo-basic", "Le falta el SEO básico");
  }
  if (fails.has("shop") && opts.sellsProducts) add("ecommerce", "Vende productos y no tiene tienda online");
  if (fails.has("basque")) add("extra-language", "Web sin versión en euskera");
  if (fails.has("pro_email") || fails.has("own_domain")) add("pro-email", "Correo profesional con su dominio");

  if (fails.has("logo_quality")) {
    add("logo", "El logotipo no está a la altura");
    if (fails.has("visual_consistency")) add("visual-system", "La imagen no sigue un sistema");
    add("brand-manual", "Para que la nueva identidad se aplique bien");
  } else if (fails.has("visual_consistency")) {
    add("visual-system", "La imagen no sigue un sistema");
  }
  if (fails.has("favicon") && !fails.has("logo_quality")) add("brand-applications", "Aplicar la marca a los detalles (favicon, perfiles…)");
  if (fails.has("photo_quality")) add("photography", "Fotografía propia y de calidad");
  if (fails.has("social")) add("social-templates", "Redes sin línea visual ni enlace desde la web");

  if (fails.has("gbp_exists") || fails.has("gbp_website") || fails.has("gbp_photos") || fails.has("gbp_hours")) {
    const g = ["gbp_exists", "gbp_website", "gbp_photos", "gbp_hours"].filter((id) => fails.has(id)).map((id) => CRITERIA_BY_ID[id].label.toLowerCase());
    add("google-business", fails.has("gbp_exists") ? "No tiene ficha en Google" : `Mejorar la ficha: ${g.join(", ")}`);
  }
  return [...out.entries()].map(([key, reasons]) => ({ key, reasons }));
}
