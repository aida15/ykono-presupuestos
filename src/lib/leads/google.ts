import "server-only";

/**
 * Google Places API (New) y PageSpeed Insights.
 * Una sola clave de servidor: GOOGLE_API_KEY, con ambas APIs activadas.
 * Nunca se piden reseñas ni valoraciones.
 */

export function googleKey(): string | null {
  return process.env.GOOGLE_API_KEY || process.env.GOOGLE_PLACES_API_KEY || null;
}

export type PlaceLite = {
  placeId: string;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  website: string | null;
  phone: string | null;
  category: string | null;
  mapsUrl: string | null;
  businessStatus: string | null;
  photoCount: number;
  hasHours: boolean;
};

const FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "addressComponents",
  "websiteUri",
  "nationalPhoneNumber",
  "businessStatus",
  "primaryTypeDisplayName",
  "googleMapsUri",
  "photos",
  "regularOpeningHours",
];

type RawPlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: { longText?: string; types?: string[] }[];
  websiteUri?: string;
  nationalPhoneNumber?: string;
  businessStatus?: string;
  primaryTypeDisplayName?: { text?: string };
  googleMapsUri?: string;
  photos?: unknown[];
  regularOpeningHours?: unknown;
};

function toLite(p: RawPlace): PlaceLite {
  const comp = (t: string) => p.addressComponents?.find((c) => c.types?.includes(t))?.longText ?? null;
  return {
    placeId: p.id,
    name: p.displayName?.text ?? "Sin nombre",
    address: p.formattedAddress ?? null,
    city: comp("locality") ?? comp("administrative_area_level_3"),
    province: comp("administrative_area_level_2"),
    postalCode: comp("postal_code"),
    website: p.websiteUri ?? null,
    phone: p.nationalPhoneNumber ?? null,
    category: p.primaryTypeDisplayName?.text ?? null,
    mapsUrl: p.googleMapsUri ?? null,
    businessStatus: p.businessStatus ?? null,
    photoCount: p.photos?.length ?? 0,
    hasHours: !!p.regularOpeningHours,
  };
}

async function placesRequest<T>(url: string, init: RequestInit & { fieldMask: string }): Promise<T> {
  const key = googleKey();
  if (!key) throw new Error("Falta GOOGLE_API_KEY para buscar en Google");
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": init.fieldMask, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const msg = body.match(/"message":\s*"([^"]+)"/)?.[1] ?? `error ${res.status}`;
    throw new Error(`Google Places: ${msg}`);
  }
  return (await res.json()) as T;
}

/** Busca negocios: «peluquerías en Getxo». Hasta 20 por página. */
export async function searchPlaces(textQuery: string, pageToken?: string): Promise<{ places: PlaceLite[]; nextPageToken: string | null }> {
  const data = await placesRequest<{ places?: RawPlace[]; nextPageToken?: string }>("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    fieldMask: [...FIELDS.map((f) => `places.${f}`), "nextPageToken"].join(","),
    body: JSON.stringify({ textQuery, languageCode: "es", regionCode: "ES", pageSize: 20, ...(pageToken ? { pageToken } : {}) }),
  });
  return { places: (data.places ?? []).map(toLite), nextPageToken: data.nextPageToken ?? null };
}

/** Busca la ficha de un negocio concreto (para leads añadidos a mano). */
export async function findPlace(name: string, near: string | null): Promise<PlaceLite | null> {
  const { places } = await searchPlaces([name, near].filter(Boolean).join(", "));
  return places[0] ?? null;
}

export async function getPlace(placeId: string): Promise<PlaceLite | null> {
  try {
    const p = await placesRequest<RawPlace>(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=es`, {
      method: "GET",
      fieldMask: FIELDS.join(","),
    });
    return toLite(p);
  } catch {
    return null;
  }
}

export type PageSpeed = { performance: number | null; screenshot: string | null; viewportOk: boolean | null; error: string | null };

/** PageSpeed Insights en móvil: nota de rendimiento y captura. Nunca lanza: si falla, devuelve el motivo. */
export async function pageSpeed(url: string): Promise<PageSpeed> {
  const fail = (error: string): PageSpeed => ({ performance: null, screenshot: null, viewportOk: null, error });
  const qs = new URLSearchParams({ url, strategy: "mobile", category: "performance", locale: "es" });
  const key = googleKey();
  if (key) qs.set("key", key);
  try {
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${qs}`, { signal: AbortSignal.timeout(45_000) });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[leads] PageSpeed", res.status, body.slice(0, 500));
      if (res.status === 429)
        return fail(key ? "Se ha agotado el cupo diario de PageSpeed de tu clave de Google." : "Google limita las pruebas sin clave: añade GOOGLE_API_KEY en Vercel.");
      if (res.status === 403)
        return fail("Tu clave de Google no tiene activada la «PageSpeed Insights API» (o tiene restricciones que la bloquean).");
      if (res.status === 400 && /API key not valid/i.test(body)) return fail("La clave GOOGLE_API_KEY no es válida.");
      return fail("Google no ha podido cargar la web para analizarla (suele pasar con webs muy lentas o que bloquean robots).");
    }
    const j = (await res.json()) as {
      lighthouseResult?: {
        runtimeError?: { code?: string; message?: string };
        categories?: { performance?: { score?: number | null } };
        audits?: Record<string, { score?: number | null; details?: { data?: string } }>;
      };
    };
    const lh = j.lighthouseResult;
    const perf = lh?.categories?.performance?.score;
    const screenshot = lh?.audits?.["final-screenshot"]?.details?.data ?? null;
    return {
      performance: typeof perf === "number" ? Math.round(perf * 100) : null,
      screenshot,
      viewportOk: typeof lh?.audits?.viewport?.score === "number" ? lh.audits.viewport.score === 1 : null,
      error: screenshot ? null : lh?.runtimeError?.message ? `Google no pudo cargar la web: ${lh.runtimeError.message}` : "Google analizó la web pero no devolvió captura.",
    };
  } catch (e) {
    const timeout = e instanceof Error && /timeout|abort/i.test(`${e.name} ${e.message}`);
    return fail(timeout ? "Google ha tardado demasiado en analizar la web (más de 45 s). Prueba a reanalizar." : "No se ha podido contactar con PageSpeed.");
  }
}

/** ¿Está en Euskadi o Navarra? (código postal 01, 20, 48, 31 o provincia). */
export function inBasqueArea(address: string | null, postalCode: string | null, province: string | null): boolean {
  const cp = postalCode ?? address?.match(/\b(\d{5})\b/)?.[1] ?? null;
  if (cp && /^(01|20|48|31)/.test(cp)) return true;
  return /(bizkaia|vizcaya|gipuzkoa|guip[uú]zcoa|araba|[aá]lava|navarra|nafarroa)/i.test(`${address ?? ""} ${province ?? ""}`);
}
