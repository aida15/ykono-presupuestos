import { NextResponse, type NextRequest } from "next/server";
import { AuthError, getMember } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { formatEUR } from "@/lib/domain/money";
import { loadLead } from "@/lib/leads/engine";
import { auditFileName, buildAuditData, renderAuditPdf } from "@/lib/leads/audit-pdf";
import { templateAuditClosing, templateAuditIntro } from "@/lib/leads/pitch";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET /api/leads/:id/audit[?precios=1][&descargar=1] → auditoría gratuita en PDF. */
export async function GET(req: NextRequest, { params }: RouteContext<"/api/leads/[id]/audit">) {
  const { id } = await params;
  let ctx;
  try {
    ctx = await getMember();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const lead = await loadLead(ctx, id);
  if (!lead) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
  if (!lead.analyzed_at) return NextResponse.json({ error: "Analiza el lead antes de generar la auditoría" }, { status: 409 });

  const settings = await getSettings(ctx);
  const showPrices = req.nextUrl.searchParams.get("precios") === "1";
  const data = buildAuditData({
    lead: { name: lead.name, category: lead.category, city: lead.city, website: lead.website },
    results: lead.criteria,
    screenshot: lead.screenshot,
    performance: lead.site?.performance ?? null,
    offers: lead.offers,
    showPrices,
    intro: lead.pitch?.audit_intro?.trim() || templateAuditIntro({ name: lead.name, website: lead.website, studioName: settings.trade_name }),
    closing: lead.pitch?.audit_closing?.trim() || templateAuditClosing({ name: lead.name }),
    studio: {
      trade_name: settings.trade_name,
      tagline: settings.tagline,
      email: settings.email,
      phone: settings.phone,
      website: settings.website,
      city: settings.city,
      accent: settings.pdf_preferences.accent ?? "#B4E600",
    },
    date: new Date().toISOString().slice(0, 10),
    formatTotal: (c) => formatEUR(c, { compact: true }),
  });

  const pdf = await renderAuditPdf(data);
  const disposition = req.nextUrl.searchParams.get("descargar") === "1" ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${auditFileName(lead.name)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
