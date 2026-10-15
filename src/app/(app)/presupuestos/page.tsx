import Link from "next/link";
import { Plus } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { listQuotes } from "@/lib/data/quotes";
import { QUOTE_STATUSES, QUOTE_STATUS_LABEL } from "@/lib/domain/schemas";
import { Button, ButtonLink, Card, EmptyState, Input, PageHeader, Select, cx } from "@/components/ui";
import { QuoteTable } from "@/components/quote-table";

export const metadata = { title: "Presupuestos" };

export default async function QuotesPage({ searchParams }: PageProps<"/presupuestos">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = typeof sp.estado === "string" && (QUOTE_STATUSES as readonly string[]).includes(sp.estado) ? sp.estado : "";
  const clientId = typeof sp.cliente === "string" ? sp.cliente : "";

  const ctx = await requireMember();
  const [rows, { data: clients }] = await Promise.all([
    listQuotes(ctx, { q, status: status || undefined, clientId: clientId || undefined }),
    ctx.supabase.from("clients").select("id, trade_name").eq("studio_id", ctx.studioId).order("trade_name"),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 lg:px-10 lg:py-10">
      <PageHeader
        kicker="Presupuestos"
        title="Todos los presupuestos"
        actions={
          <ButtonLink href="/presupuestos/nuevo" variant="lime">
            <Plus size={16} /> Crear presupuesto
          </ButtonLink>
        }
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={q} placeholder="Buscar por título o número…" className="max-w-xs" aria-label="Buscar" />
        <Select name="cliente" defaultValue={clientId} className="max-w-[220px]" aria-label="Cliente">
          <option value="">Todos los clientes</option>
          {(clients ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.trade_name}
            </option>
          ))}
        </Select>
        <input type="hidden" name="estado" value={status} />
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {["", ...QUOTE_STATUSES].map((s) => {
          const params = new URLSearchParams();
          if (q) params.set("q", q);
          if (clientId) params.set("cliente", clientId);
          if (s) params.set("estado", s);
          return (
            <Link
              key={s || "all"}
              href={`/presupuestos?${params.toString()}`}
              className={cx(
                "rounded-full border px-3 py-1 text-xs font-semibold",
                status === s ? "border-ink bg-ink text-white" : "border-line-strong bg-card hover:border-ink",
              )}
            >
              {s ? QUOTE_STATUS_LABEL[s as keyof typeof QUOTE_STATUS_LABEL] : "Todos"}
            </Link>
          );
        })}
      </div>
      <Card className="p-5">
        {rows.length ? (
          <QuoteTable rows={rows} />
        ) : (
          <EmptyState title="No hay presupuestos con esos filtros" action={<ButtonLink href="/presupuestos/nuevo">Crear presupuesto</ButtonLink>} />
        )}
      </Card>
    </main>
  );
}
