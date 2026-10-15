import Link from "next/link";
import { Plus } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { Badge, Button, ButtonLink, Card, EmptyState, Input, PageHeader } from "@/components/ui";

export const metadata = { title: "Clientes" };

export default async function ClientsPage({ searchParams }: PageProps<"/clientes">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const showArchived = sp.archivados === "1";
  const ctx = await requireMember();
  let query = ctx.supabase
    .from("clients")
    .select("id, trade_name, legal_name, tax_id, city, email, archived, updated_at, quotes(count)")
    .eq("studio_id", ctx.studioId)
    .order("trade_name");
  if (!showArchived) query = query.eq("archived", false);
  if (q) {
    const term = q.replace(/[%,()]/g, " ");
    query = query.or(`trade_name.ilike.%${term}%,legal_name.ilike.%${term}%,tax_id.ilike.%${term}%`);
  }
  const { data: clients } = await query;

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 lg:px-10 lg:py-10">
      <PageHeader
        kicker="Clientes"
        title="Clientes"
        actions={
          <ButtonLink href="/clientes/nuevo">
            <Plus size={16} /> Nuevo cliente
          </ButtonLink>
        }
      />
      <form className="mb-4 flex flex-wrap items-center gap-2">
        <Input name="q" defaultValue={q} placeholder="Nombre, razón social o NIF…" className="max-w-xs" aria-label="Buscar clientes" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="archivados" value="1" defaultChecked={showArchived} /> Ver archivados
        </label>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>
      <Card className="p-5">
        {clients?.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 pr-3 font-semibold">Cliente</th>
                <th className="py-2 pr-3 font-semibold">NIF/CIF</th>
                <th className="hidden py-2 pr-3 font-semibold md:table-cell">Localidad</th>
                <th className="py-2 text-right font-semibold">Presupuestos</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const count = (c.quotes as unknown as { count: number }[])?.[0]?.count ?? 0;
                const missingFiscal = !c.tax_id;
                return (
                  <tr key={c.id} className="border-b border-line/70 last:border-0 hover:bg-surface/60">
                    <td className="py-2.5 pr-3">
                      <Link href={`/clientes/${c.id}`} className="font-medium hover:underline">
                        {c.trade_name}
                      </Link>
                      {c.archived ? <Badge className="ml-2">Archivado</Badge> : null}
                      {c.legal_name ? <p className="text-xs text-muted">{c.legal_name}</p> : null}
                    </td>
                    <td className="py-2.5 pr-3">{missingFiscal ? <Badge tone="warn">Falta NIF</Badge> : <span className="font-mono text-xs">{c.tax_id}</span>}</td>
                    <td className="hidden py-2.5 pr-3 text-ink-3 md:table-cell">{c.city ?? "—"}</td>
                    <td className="tabular py-2.5 text-right">{count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState title="No hay clientes" action={<ButtonLink href="/clientes/nuevo">Crear cliente</ButtonLink>} />
        )}
      </Card>
    </main>
  );
}
