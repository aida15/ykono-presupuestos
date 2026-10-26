import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Descarga la portada de una web de forma segura: solo http(s) públicas,
 * sin direcciones internas (protección SSRF), con límite de tiempo, tamaño
 * y redirecciones.
 */

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 12_000;
const UA = "Mozilla/5.0 (compatible; YKONO-QuoteStudio/1.0; +https://ykono.es)";

function isPrivate(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivate(mapped[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  );
}

async function assertPublicHost(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Solo se analizan webs http o https");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("Puerto no permitido");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new Error("Dirección no permitida");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivate(a.address))) throw new Error("Dirección no permitida");
}

export function normalizeWebsite(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!u.hostname.includes(".")) return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

export type FetchResult = {
  ok: boolean;
  finalUrl: string;
  status: number | null;
  html: string;
  /** La versión https responde correctamente. */
  httpsWorks: boolean;
  error: string | null;
};

async function fetchOnce(url: string): Promise<{ res: Response; finalUrl: string }> {
  let current = new URL(url);
  for (let hop = 0; hop < 5; hop++) {
    await assertPublicHost(current);
    const res = await fetch(current, {
      redirect: "manual",
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml", "accept-language": "es-ES,es;q=0.9,eu;q=0.8" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current);
      continue;
    }
    return { res, finalUrl: current.toString() };
  }
  throw new Error("Demasiadas redirecciones");
}

async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  reader.cancel().catch(() => undefined);
  const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  const charset = res.headers.get("content-type")?.match(/charset=([\w-]+)/i)?.[1]?.toLowerCase();
  const head = buf.subarray(0, 4000).toString("latin1");
  const metaCharset = head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1]?.toLowerCase();
  const enc = charset ?? metaCharset ?? "utf-8";
  try {
    return new TextDecoder(enc === "iso-8859-1" || enc === "latin1" ? "windows-1252" : enc).decode(buf);
  } catch {
    return buf.toString("utf8");
  }
}

export async function fetchSite(website: string): Promise<FetchResult> {
  const base = normalizeWebsite(website);
  if (!base) return { ok: false, finalUrl: website, status: null, html: "", httpsWorks: false, error: "Dirección web no válida" };
  const httpsUrl = base.replace(/^http:/i, "https:");
  try {
    const { res, finalUrl } = await fetchOnce(httpsUrl);
    const html = /html|xml|text/i.test(res.headers.get("content-type") ?? "text/html") ? await readLimited(res) : "";
    return { ok: res.ok, finalUrl, status: res.status, html, httpsWorks: res.ok && finalUrl.startsWith("https:"), error: res.ok ? null : `La web responde con error ${res.status}` };
  } catch (e) {
    // Sin https (o certificado no válido): probamos por http.
    try {
      const { res, finalUrl } = await fetchOnce(httpsUrl.replace(/^https:/i, "http:"));
      const html = await readLimited(res);
      return { ok: res.ok, finalUrl, status: res.status, html, httpsWorks: false, error: res.ok ? null : `La web responde con error ${res.status}` };
    } catch {
      const msg = e instanceof Error && /no permitid|solo se analizan|puerto/i.test(e.message) ? e.message : "La web no responde";
      return { ok: false, finalUrl: httpsUrl, status: null, html: "", httpsWorks: false, error: msg };
    }
  }
}

/** Descarga una imagen pequeña (logotipo) para la valoración visual. */
export async function fetchImage(url: string, maxBytes = 1_000_000): Promise<{ mediaType: string; base64: string } | null> {
  try {
    const { res } = await fetchOnce(url);
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!res.ok || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > maxBytes || buf.byteLength < 200) return null;
    return { mediaType: type, base64: buf.toString("base64") };
  } catch {
    return null;
  }
}
