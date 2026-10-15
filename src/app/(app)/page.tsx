import Link from "next/link";
import { ArrowRight, MessageSquareText, Search, Settings, Shapes } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { listQuotes } from "@/lib/data/quotes";
import { ButtonLink, Card, EmptyState, Input, PageHeader } from "@/components/ui";
import { QuoteTable } from "@/components/quote-table";
import { formatEUR } from "@/lib/domain/money";

export const metadata = { title: "Inicio" };

export default async function DashboardPage() {
  const ctx = await requireMember();
  const [recent, drafts, closed, clients, interviews] = await Promise.all([
    listQuotes(ctx, { limit: 8 }),
    listQuotes(ctx, { status: "draft", limit: 6 }),
    ctx.supabase
      .from("quotes")
      .select("id, number, version, status, title, issue_date, valid_until, total_cents, taxable_base_cents, updated_at, client:clients(id, trade_name)")
      .eq("studio_id", ctx.studioId)
      .in("status", ["ready", "sent", "accepted"])
      .order("updated_at", { ascending: false })
      .limit(6),
    ctx.supabase
      .from("clients")
      .select("id, trade_name, city, updated_at")
      .eq("studio_id", ctx.studioId)
      .eq("archived", false)
      .order("updated_at", { ascending: false })
      .limit(6),
    ctx.supabase
      .from("interview_sessions")
      .select("id, state, updated_at")
      .eq("studio_id", ctx.studioId)
      .in("status", ["active", "summary"])
      .order("updated_at", { ascending: false })
      .limit(4),
  ]);

  const closedRows = (closed.data ?? []).map((r) => ({
    ...(r as never as (typeof recent)[number]),
    total_cents: Number(r.total_cents),
    taxable_base_cents: Number(r.taxable_base_cents),
  }));
  const pipeline = closedRows.filter((r) => r.status === "sent").reduce((a, r) => a + r.taxable_base_cents, 0);

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 lg:px-10 lg:py-10">
      <PageHeader kicker="Inicio" title="Hola de nuevo">
        Prepara, revisa y envía propuestas sin rehacer cálculos.
      </PageHeader>

      <section className="mb-8 grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-ink p-7 text-white">
          <p className="kicker !text-lime">Nuevo presupuesto</p>
          <h2 className="mt-2 max-w-sm text-2xl font-bold leading-tight">Cuéntame qué necesita el cliente y lo convertimos en propuesta.</h2>
          <div className="mt-6 flex flex-wrap gap-2">
            <ButtonLink href="/presupuestos/nuevo?modo=entrevista" variant="lime">
              <MessageSquareText size={16} /> Empezar entrevista
            </ButtonLink>
            <ButtonLink href="/presupuestos/nuevo?modo=manual" variant="ghost" className="!text-white hover:!bg-white/10">
              Crear manualmente
            </ButtonLink>
          </div>
        </div>
        <Card className="flex flex-col justify-between p-6">
          <form action="/presupuestos" className="relative">
            <Search size={16} className="absolute top-3 left-3 text-muted" />
            <Input name="q" placeholder="Buscar por título o número…" className="pl-9" aria-label="Buscar presupuestos" />
          </form>
          <dl className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs text-muted">Borradores</dt>
              <dd className="text-2xl font-bold">{drafts.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Enviados pendientes</dt>
              <dd className="tabular text-2xl font-bold">{formatEUR(pipeline, { compact: true })}</dd>
            </div>
          </dl>
          <div className="mt-6 flex gap-4 text-sm">
            <Link href="/catalogo" className="flex items-center gap-1.5 font-semibold hover:underline">
              <Shapes size={15} /> Catálogo y tarifas
            </Link>
            <Link href="/configuracion" className="flex items-center gap-1.5 font-semibold hover:underline">
              <Settings size={15} /> Configuración
            </Link>
          </div>
        </Card>
      </section>

      {(interviews.data ?? []).length > 0 ? (
        <section className="mb-8">
          <h2 className="kicker mb-3">Entrevistas en curso</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {(interviews.data ?? []).map((iv) => {
              const st = iv.state as { classification?: { project_type?: string }; common?: { project_name?: string; client_name?: string } };
              return (
                <Link key={iv.id} href={`/entrevistas/${iv.id}`}>
                  <Card className="flex items-center justify-between p-4 hover:border-ink">
                    <div>
                      <p className="font-semibold">{st.common?.project_name || st.classification?.project_type || "Entrevista sin título"}</p>
                      <p className="text-xs text-muted">{st.common?.client_name ?? "Cliente por definir"}</p>
                    </div>
                    <ArrowRight size={16} />
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="kicker">Presupuestos recientes</h2>
            <Link href="/presupuestos" className="text-xs font-semibold hover:underline">
              Ver todos
            </Link>
          </div>
          {recent.length ? (
            <QuoteTable rows={recent} compact />
          ) : (
            <EmptyState title="Aún no hay presupuestos">Crea el primero con la entrevista o a mano.</EmptyState>
          )}
        </Card>
        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <h2 className="kicker mb-3">Borradores pendientes</h2>
            {drafts.length ? <QuoteTable rows={drafts} compact /> : <p className="text-sm text-muted">Nada pendiente.</p>}
          </Card>
          <Card className="p-5">
            <h2 className="kicker mb-3">Enviados y finalizados</h2>
            {closedRows.length ? <QuoteTable rows={closedRows} compact /> : <p className="text-sm text-muted">Todavía ninguno.</p>}
          </Card>
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="kicker">Clientes recientes</h2>
              <Link href="/clientes" className="text-xs font-semibold hover:underline">
                Ver todos
              </Link>
            </div>
            <ul className="divide-y divide-line">
              {(clients.data ?? []).map((c) => (
                <li key={c.id} className="py-2 text-sm">
                  <Link href={`/clientes/${c.id}`} className="font-medium hover:underline">
                    {c.trade_name}
                  </Link>
                  {c.city ? <span className="text-muted"> · {c.city}</span> : null}
                </li>
              ))}
              {(clients.data ?? []).length === 0 ? <li className="text-sm text-muted">Sin clientes todavía.</li> : null}
            </ul>
          </Card>
        </div>
      </section>
    </main>
  );
}
