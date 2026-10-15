import { NextResponse } from "next/server";
import { AuthError, getMember } from "@/lib/auth";

export const runtime = "nodejs";

/** Descarga una copia archivada de un PDF generado (tal como se entregó). */
export async function GET(_req: Request, { params }: RouteContext<"/api/documents/[id]">) {
  const { id } = await params;
  let ctx;
  try {
    ctx = await getMember();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { data: doc } = await ctx.supabase
    .from("generated_documents")
    .select("file_name, storage_path, quote_id")
    .eq("id", id)
    .eq("studio_id", ctx.studioId)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  if (!doc.storage_path) {
    return NextResponse.json({ error: "Este documento no se archivó (archivo documental desactivado). Sus datos se conservan en el historial." }, { status: 404 });
  }
  const { data: blob, error } = await ctx.supabase.storage.from("documents").download(doc.storage_path);
  if (error || !blob) return NextResponse.json({ error: "No se pudo recuperar el archivo" }, { status: 502 });
  return new NextResponse(blob, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${doc.file_name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
