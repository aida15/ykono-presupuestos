import "server-only";
import type { MemberContext } from "@/lib/auth";
import { loadQuote } from "@/lib/data/quotes";
import { getSettings } from "@/lib/data/settings";
import { computeDraft, validateForFinalize, type ValidationProblem } from "@/lib/domain/quote";
import type { Client } from "@/lib/data/types";
import type { PdfData } from "./types";

export type BuiltPdf = { data: PdfData; problems: ValidationProblem[]; storedTotal: number };

/**
 * Reúne los datos GUARDADOS del presupuesto. Los importes se obtienen con el motor
 * de precios (el mismo que guardó el snapshot) y se comprueba que coinciden con el
 * total almacenado: si no, el presupuesto se ha modificado fuera del flujo normal.
 */
export async function buildPdfData(ctx: MemberContext, quoteId: string, mode: "preview" | "final"): Promise<BuiltPdf | null> {
  const loaded = await loadQuote(ctx, quoteId);
  if (!loaded) return null;
  const { draft, meta } = loaded;
  const settings = await getSettings(ctx);
  const { totals, schedule } = computeDraft(draft);

  // Un presupuesto ya cerrado usa la copia de los datos del cliente tomada al cerrarlo.
  const client: Client | null = draft.status !== "draft" && meta.client_snapshot ? meta.client_snapshot : meta.client;

  let customLogo: string | null = null;
  if (settings.logo_path) {
    const { data: blob } = await ctx.supabase.storage.from("brand").download(settings.logo_path);
    if (blob) {
      const buf = Buffer.from(await blob.arrayBuffer());
      customLogo = `data:${blob.type || "image/png"};base64,${buf.toString("base64")}`;
    }
  }

  const { data: row } = await ctx.supabase.from("quotes").select("total_cents").eq("id", quoteId).single();

  return {
    problems: validateForFinalize(draft, client),
    storedTotal: Number(row?.total_cents ?? 0),
    data: {
      draft,
      totals,
      schedule,
      client: client
        ? {
            trade_name: client.trade_name,
            legal_name: client.legal_name,
            tax_id: client.tax_id,
            address_line: client.address_line,
            postal_code: client.postal_code,
            city: client.city,
            province: client.province,
          }
        : null,
      studio: {
        trade_name: settings.trade_name,
        tagline: settings.tagline,
        legal_name: settings.legal_name,
        tax_id: settings.tax_id,
        address_line: settings.address_line,
        postal_code: settings.postal_code,
        city: settings.city,
        phone: settings.phone,
        email: settings.email,
        website: settings.website,
        closing_text: settings.closing_text,
        accent: settings.pdf_preferences.accent ?? "#B4E600",
        show_cover: settings.pdf_preferences.show_cover ?? true,
        show_closing: settings.pdf_preferences.show_closing ?? true,
      },
      customLogo,
      mode,
      generatedAt: new Date().toISOString(),
    },
  };
}
