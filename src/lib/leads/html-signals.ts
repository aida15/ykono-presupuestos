/**
 * Lectura de señales a partir del HTML de la portada. Función pura (sin red)
 * para poder probarla con HTML de ejemplo.
 */

export type SiteSignals = {
  finalUrl: string;
  https: boolean;
  title: string | null;
  metaDescription: boolean;
  h1: boolean;
  viewport: boolean;
  copyrightYear: number | null;
  generator: string | null;
  wordpressVersion: string | null;
  jqueryVersion: string | null;
  flash: boolean;
  tableLayout: boolean;
  freeBuilder: string | null;
  mixedContent: boolean;
  emails: string[];
  genericEmail: boolean;
  phones: string[];
  contactForm: boolean;
  social: { instagram?: string; facebook?: string; linkedin?: string; tiktok?: string; youtube?: string };
  favicon: boolean;
  logoUrl: string | null;
  logoIsSvg: boolean;
  shopPlatform: string | null;
  sellsProducts: boolean;
  orderByWhatsapp: boolean;
  legal: { avisoLegal: boolean; privacidad: boolean; cookies: boolean };
  basque: boolean;
  agencyCredit: string | null;
  mentionsOpening: boolean;
  mentionsHiring: boolean;
  textSample: string;
};

const FREE_BUILDERS: [RegExp, string][] = [
  [/\.wixsite\.com$/i, "Wix (gratuito)"],
  [/\.jimdo(free|site)?\.com$/i, "Jimdo (gratuito)"],
  [/\.webnode\.(es|com)$/i, "Webnode (gratuito)"],
  [/\.blogspot\.com$/i, "Blogger"],
  [/\.wordpress\.com$/i, "WordPress.com (gratuito)"],
  [/sites\.google\.com$/i, "Google Sites"],
  [/\.weebly\.com$/i, "Weebly (gratuito)"],
  [/\.godaddysites\.com$/i, "GoDaddy (gratuito)"],
  [/\.site123\.me$/i, "Site123 (gratuito)"],
  [/\.business\.site$/i, "Web de Google Business (cerrada por Google)"],
];

const GENERIC_MAIL = /@(gmail|googlemail|hotmail|outlook|live|yahoo|ymail|icloud|me|msn|telefonica|terra)\.[a-z.]+$/i;

function decode(s: string) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&copy;|&#169;|&#xa9;/gi, "©")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Texto visible aproximado (sin scripts ni estilos). */
export function visibleText(html: string): string {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[1] ?? m[2] ?? m[3] ?? "") : null;
}

function absolute(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export function analyzeHtml(html: string, finalUrl: string, now = new Date()): SiteSignals {
  const url = new URL(finalUrl);
  const text = visibleText(html);
  const lower = text.toLowerCase();
  const tags = html.match(/<[a-z][^>]*>/gi) ?? [];

  const metas = tags.filter((t) => /^<meta\b/i.test(t));
  const meta = (key: string) => {
    const t = metas.find((m) => (attr(m, "name") ?? attr(m, "property") ?? "").toLowerCase() === key);
    return t ? attr(t, "content") : null;
  };
  const links = tags.filter((t) => /^<link\b/i.test(t));
  const anchors = [...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)].map((m) => m[0]);
  const hrefs = tags.filter((t) => /^<a\b/i.test(t)).map((t) => attr(t, "href") ?? "");

  // Copyright: el año más reciente cerca de «©» o «copyright».
  const years: number[] = [];
  for (const m of text.matchAll(/(?:©|copyright|\(c\))[^0-9]{0,40}((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?/gi)) {
    years.push(Number(m[2] ?? m[1]));
  }
  const thisYear = now.getFullYear();
  const copyrightYear = years.length ? Math.max(...years.filter((y) => y <= thisYear + 1)) : null;

  const generator = meta("generator");
  const wp = generator?.match(/wordpress\s*([\d.]+)/i)?.[1] ?? html.match(/wp-(?:includes|content)[^"']*\?ver=([\d.]+)/i)?.[1] ?? null;
  const isWp = /wp-content|wp-includes/i.test(html) || /wordpress/i.test(generator ?? "");
  const jq = html.match(/jquery[.-]?(\d+\.\d+(?:\.\d+)?)(?:\.min)?\.js/i)?.[1] ?? html.match(/jquery\.js\?ver=(\d+\.\d+(?:\.\d+)?)/i)?.[1] ?? null;

  const emails = [
    ...new Set(
      [...html.matchAll(/mailto:([^"'?\s>]+)/gi), ...text.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)]
        .map((m) => decode(m[1] ?? m[0]).toLowerCase())
        .filter((e) => !/\.(png|jpe?g|gif|webp|svg)$/.test(e) && !/sentry|wixpress|example\./.test(e)),
    ),
  ].slice(0, 6);
  const phones = [...new Set([...html.matchAll(/tel:([+\d\s().-]{9,})/gi)].map((m) => m[1].replace(/\s+/g, " ").trim()))].slice(0, 3);

  const social: SiteSignals["social"] = {};
  for (const h of hrefs) {
    const a = h.toLowerCase();
    if (!social.instagram && /instagram\.com\/[^/?#]+/.test(a)) social.instagram = h;
    else if (!social.facebook && /facebook\.com\/[^/?#]+/.test(a) && !/sharer/.test(a)) social.facebook = h;
    else if (!social.linkedin && /linkedin\.com\/(company|in)\//.test(a)) social.linkedin = h;
    else if (!social.tiktok && /tiktok\.com\/@/.test(a)) social.tiktok = h;
    else if (!social.youtube && /youtube\.com\/(c\/|channel\/|@)/.test(a)) social.youtube = h;
  }

  const favicon = links.some((l) => /icon/i.test(attr(l, "rel") ?? ""));

  // Logotipo: primera imagen con «logo» en src, class, id o alt.
  let logoUrl: string | null = null;
  for (const t of tags.filter((t) => /^<img\b/i.test(t))) {
    const hay = `${attr(t, "src") ?? ""} ${attr(t, "class") ?? ""} ${attr(t, "id") ?? ""} ${attr(t, "alt") ?? ""}`;
    if (/logo/i.test(hay)) {
      const src = attr(t, "src") ?? attr(t, "data-src");
      if (src && !src.startsWith("data:")) {
        logoUrl = absolute(src, finalUrl);
        break;
      }
    }
  }
  const inlineSvgLogo = /<svg[^>]*(class|id)=["'][^"']*logo/i.test(html);

  const shopPlatform = /woocommerce/i.test(html)
    ? "WooCommerce"
    : /cdn\.shopify\.com|shopify/i.test(html)
      ? "Shopify"
      : /prestashop/i.test(html)
        ? "PrestaShop"
        : /magento/i.test(html)
          ? "Magento"
          : /add-to-cart|añadir al carrito|anadir-al-carrito|carrito de compra/i.test(html)
            ? "Tienda propia"
            : null;
  const sellsProducts =
    !!shopPlatform || /\b(productos|catálogo de productos|nuestros productos|comprar|precio[s]?\s*:?\s*\d|€\s*\d|\d+[.,]\d{2}\s*€)/i.test(text);
  const orderByWhatsapp = /(pedidos?|encarg\w+|reserv\w+)[^.]{0,60}whatsapp|wa\.me\//i.test(html);

  const anchorText = anchors.map((a) => visibleText(a).toLowerCase() + " " + (attr(a, "href") ?? "").toLowerCase()).join(" | ");
  const legal = {
    avisoLegal: /aviso[\s-]legal|legal[\s-]notice|lege[\s-]oharra/.test(anchorText),
    privacidad: /privacidad|privacy|pribatutasun/.test(anchorText),
    cookies: /cookie/.test(anchorText) || /cookie(law|bot|yes|consent)|cmplz|borlabs/i.test(html),
  };

  const htmlLang = html.match(/<html[^>]*\blang=["']?([a-z-]+)/i)?.[1]?.toLowerCase() ?? "";
  const basque =
    htmlLang.startsWith("eu") ||
    links.some((l) => /alternate/i.test(attr(l, "rel") ?? "") && /^eu/i.test(attr(l, "hreflang") ?? "")) ||
    /(\/eu\/|[?&]lang=eu|\/eus\/)/i.test(hrefs.join(" ")) ||
    /\b(euskara|euskaraz)\b/i.test(anchorText) ||
    /(?:^|[\s|>])eus(?:[\s|<]|$)/i.test(anchorText);

  const credit = text.match(/(?:diseñ(?:o|ado)(?: web)?|desarrollad[oa]|realizad[oa]|web)\s+(?:por|by)\s*:?\s*([A-ZÁÉÍÓÚÑ0-9][\w&.\- ]{1,40})/i)?.[1]?.trim() ?? null;

  const freeBuilder = FREE_BUILDERS.find(([re]) => re.test(url.hostname))?.[1] ?? null;
  const mixedContent = url.protocol === "https:" && /<(img|script|iframe|link)\b[^>]+(src|href)=["']http:\/\//i.test(html);

  return {
    finalUrl,
    https: url.protocol === "https:",
    title: decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim() || null,
    metaDescription: (meta("description") ?? "").trim().length > 20,
    h1: /<h1\b[^>]*>[\s\S]*?\S[\s\S]*?<\/h1>/i.test(html),
    viewport: metas.some((m) => (attr(m, "name") ?? "").toLowerCase() === "viewport" && /width\s*=\s*device-width/i.test(attr(m, "content") ?? "")),
    copyrightYear: copyrightYear && Number.isFinite(copyrightYear) ? copyrightYear : null,
    generator,
    wordpressVersion: isWp ? wp : null,
    jqueryVersion: jq,
    flash: /\.swf\b|application\/x-shockwave-flash/i.test(html),
    tableLayout: (html.match(/<table\b/gi) ?? []).length >= 3 && /<td[^>]*width=/i.test(html),
    freeBuilder,
    mixedContent,
    emails,
    genericEmail: emails.length > 0 && emails.every((e) => GENERIC_MAIL.test(e)),
    phones,
    contactForm: /<form\b[\s\S]*?<textarea\b/i.test(html) || /wpcf7|contact-form|formulario de contacto/i.test(html),
    social,
    favicon,
    logoUrl: logoUrl ?? (inlineSvgLogo ? "inline-svg" : null),
    logoIsSvg: inlineSvgLogo || /\.svg(\?|$)/i.test(logoUrl ?? ""),
    shopPlatform,
    sellsProducts,
    orderByWhatsapp,
    legal,
    basque,
    agencyCredit: credit,
    mentionsOpening: /(nueva apertura|pr[oó]xima apertura|nos hemos (trasladado|mudado)|nueva (sede|tienda|ubicaci[oó]n|direcci[oó]n)|nuevo (local|centro)|reci[eé]n inaugurad)/i.test(lower),
    mentionsHiring: /(trabaja con nosotros|[uú]nete (a nuestro|al) equipo|ofertas? de empleo|estamos contratando|buscamos (personal|incorporar)|lan eskaintza)/i.test(lower),
    textSample: text.slice(0, 1500),
  };
}

/** Versiones "antiguas" a efectos comerciales. */
export function isOldTech(s: SiteSignals): string | null {
  if (s.flash) return "Usa Flash, que los navegadores ya no muestran";
  if (s.freeBuilder) return `Hecha con ${s.freeBuilder}`;
  if (s.wordpressVersion) {
    const major = Number(s.wordpressVersion.split(".")[0]);
    if (major && major < 6) return `WordPress ${s.wordpressVersion}, sin actualizar desde hace años`;
  }
  if (s.jqueryVersion) {
    const [maj, min] = s.jqueryVersion.split(".").map(Number);
    if (maj === 1 && min < 12) return `jQuery ${s.jqueryVersion}, una versión de hace más de diez años`;
  }
  if (s.tableLayout) return "Maquetada con tablas, técnica de los años 2000";
  return null;
}
