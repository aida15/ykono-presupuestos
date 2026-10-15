import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { AuthError, getMember } from "@/lib/auth";
import { buildPdfData } from "@/lib/pdf/build";
import { pdfFileName, renderQuotePdf } from "@/lib/pdf/render";
import { getSettings } from "@/lib/data/settings";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/quotes/:id/pdf?mode=preview  → PDF en línea con marca «BORRADOR» si procede.
 * GET /api/quotes/:id/pdf?mode=download → valida, genera el PDF definitivo, lo archiva
 *                                         (Storage + snapshot de datos) y lo descarga.
 */
export async function GET(req: NextRequest, { params }: RouteContext<"/api/quotes/[id]/pdf">) {
  const { id } = await params;
  const mode = req.nextUrl.searchParams.get("mode") === "download" ? "download" : "preview";

  let ctx;
  try {
    ctx = await getMember();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const built = await buildPdfData(ctx, id, mode === "download" ? "final" : "preview");
  if (!built) return NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 404 });
  const { data, problems, storedTotal } = built;

  if (storedTotal !== data.totals.total) {
    return problemPage("Los importes guardados no coinciden con el cálculo actual. Abre el presupuesto y guárdalo de nuevo.", [], 409);
  }

  if (mode === "download") {
    if (problems.length) {
      return problemPage("Antes de descargar el PDF definitivo hay que resolver:", problems.map((p) => p.message), 422);
    }
  } else if (data.draft.status !== "draft" && problems.length === 0) {
    // Un presupuesto cerrado y sin incidencias se previsualiza sin marca de agua.
    data.mode = "final";
  }

  const pdf = await renderQuotePdf(data);
  const { draft } = data;

  if (mode === "preview") {
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${pdfFileName(draft.number, draft.version, draft.title)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  // Versionado documental: cada descarga definitiva crea un documento numerado e inmutable.
  const settings = await getSettings(ctx);
  const { data: last } = await ctx.supabase
    .from("generated_documents")
    .select("doc_version")
    .eq("quote_id", id)
    .order("doc_version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const docVersion = (last?.doc_version ?? 0) + 1;
  const fileName = pdfFileName(draft.number, draft.version, draft.title, docVersion > 1 ? docVersion : undefined);
  const sha256 = createHash("sha256").update(pdf).digest("hex");

  let storagePath: string | null = null;
  if (settings.archive_pdfs) {
    storagePath = `${ctx.studioId}/${id}/${fileName}`;
    const { error } = await ctx.supabase.storage.from("documents").upload(storagePath, pdf, { contentType: "application/pdf", upsert: false });
    if (error) {
      console.error("[pdf] archivo", error);
      storagePath = null;
    }
  }

  const { error: docError } = await ctx.supabase.from("generated_documents").insert({
    studio_id: ctx.studioId,
    quote_id: id,
    quote_number: draft.number,
    quote_version: draft.version,
    doc_version: docVersion,
    file_name: fileName,
    storage_path: storagePath,
    byte_size: pdf.length,
    sha256,
    data_snapshot: { draft, totals: data.totals, schedule: data.schedule, client: data.client, studio: data.studio },
    total_cents: data.totals.total,
    created_by: ctx.userId,
  });
  if (docError) console.error("[pdf] registro", docError);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function problemPage(title: string, items: string[], status: number) {
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>No se puede generar el PDF</title>
<body style="font-family:Helvetica,Arial,sans-serif;background:#f5f4ef;color:#111;padding:48px;max-width:640px;margin:auto">
<h1 style="font-size:22px">${esc(title)}</h1><ul>${items.map((i) => `<li style="margin:6px 0">${esc(i)}</li>`).join("")}</ul>
<p><a href="javascript:history.back()" style="color:#111">Volver al presupuesto</a></p></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
