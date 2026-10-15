import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { loadQuote } from "@/lib/data/quotes";
import { getCatalog } from "@/lib/data/catalog";
import { QuoteEditor } from "./editor/quote-editor";

export async function generateMetadata({ params }: PageProps<"/presupuestos/[id]">) {
  const { id } = await params;
  return { title: `Presupuesto ${id.slice(0, 8)}` };
}

export default async function QuotePage({ params }: PageProps<"/presupuestos/[id]">) {
  const { id } = await params;
  const ctx = await requireMember();
  const loaded = await loadQuote(ctx, id);
  if (!loaded) notFound();

  const [{ categories, services }, { data: clients }, { data: docs }, { data: interview }] = await Promise.all([
    getCatalog(ctx),
    ctx.supabase
      .from("clients")
      .select("id, trade_name, legal_name, tax_id, address_line, city")
      .eq("studio_id", ctx.studioId)
      .eq("archived", false)
      .order("trade_name"),
    ctx.supabase
      .from("generated_documents")
      .select("id, doc_version, file_name, created_at, total_cents, quote_version")
      .eq("quote_id", id)
      .order("doc_version", { ascending: false }),
    ctx.supabase.from("interview_sessions").select("id").eq("quote_id", id).limit(1).maybeSingle(),
  ]);

  // Un cliente archivado asignado al presupuesto sigue apareciendo en el selector.
  const clientList = [...(clients ?? [])];
  const assigned = loaded.meta.client;
  if (assigned && !clientList.some((c) => c.id === assigned.id)) clientList.push(assigned);

  return (
    <QuoteEditor
      key={`${loaded.draft.id}:${loaded.draft.status}`}
      initial={loaded.draft}
      clients={clientList}
      services={services}
      categories={categories}
      documents={(docs ?? []).map((d) => ({ ...d, total_cents: Number(d.total_cents) }))}
      fromInterview={interview?.id ?? null}
    />
  );
}
