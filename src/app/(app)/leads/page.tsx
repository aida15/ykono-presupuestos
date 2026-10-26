import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { googleKey } from "@/lib/leads/google";
import { aiAvailable } from "@/lib/ai/claude";
import { CRITERIA_BY_ID, type CriterionResult } from "@/lib/leads/criteria";
import { Alert, Card, EmptyState, PageHeader, cx } from "@/components/ui";
import { SearchPanel } from "./search-panel";
import { LeadsTable, type LeadListRow } from "./leads-table";
import { LEAD_STATUS_LABEL } from "./lead-ui";

export const metadata = { title: "Leads" };
// Los análisis se lanzan desde esta página.
export const maxDuration = 60;

const FILTERS = ["activos", "new", "analyzed", "contacted", "replied", "converted", "discarded", "todos"] as const;

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  const sp = await searchParams;
  const filter = (FILTERS as readonly string[]).includes(String(sp.estado)) ? String(sp.estado) : "activos";
  const level = ["alta", "media", "baja"].includes(String(sp.nivel)) ? String(sp.nivel) : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const ctx = await requireMember();
  let query = ctx.supabase
    .from("leads")
    .select("id, name, category, city, website, status, score, criteria, offers, analyzed_at, created_at, pitch->franchise")
    .eq("studio_id", ctx.studioId)
    .order("score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(300);
  if (filter === "activos") query = query.not("status", "in", "(discarded,converted)");
  else if (filter !== "todos") query = query.eq("status", filter);
  if (level === "alta") query = query.gte("score", 55);
  if (level === "media") query = query.gte("score", 30).lt("score", 55);
  if (level === "baja") query = query.lt("score", 30);
  if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, " ")}%`);
  const { data } = await query;

  const rows: LeadListRow[] = (data ?? []).map((l) => {
    const criteria = (l.criteria ?? []) as CriterionResult[];
    const gaps = criteria
      .filter((c) => c.met === false && CRITERIA_BY_ID[c.id])
      .sort((a, b) => CRITERIA_BY_ID[b.id].weight - CRITERIA_BY_ID[a.id].weight)
      .map((c) => CRITERIA_BY_ID[c.id].label);
    const offers = (l.offers ?? []) as { net_cents: number | null }[];
    return {
      id: l.id,
      name: l.name,
      category: l.category,
      city: l.city,
      website: l.website,
      status: l.status,
      score: l.score,
      gaps,
      estimate: offers.reduce((a, o) => a + (o.net_cents ?? 0), 0),
      analyzed: !!l.analyzed_at,
      franchise: !!(l.franchise as { likely?: boolean } | null)?.likely,
    };
  });

  const link = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(filter !== "activos" ? { estado: filter } : {}), ...(level ? { nivel: level } : {}), ...(q ? { q } : {}), ...patch });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/leads?${p.toString()}`;
  };

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 lg:px-10 lg:py-10">
      <PageHeader kicker="Prospección" title="Leads">
        Negocios que podrían necesitar a YKONO, valorados por lo que no cumplen hoy en web, marca y Google.
      </PageHeader>

      {!googleKey() ? (
        <div className="mb-4">
          <Alert tone="warn" title="Falta GOOGLE_API_KEY">
            Sin ella no se puede buscar en Google ni comprobar las fichas de Google Business. Puedes añadir leads a mano y se analizará su web.
          </Alert>
        </div>
      ) : null}
      {!aiAvailable() ? (
        <div className="mb-4">
          <Alert tone="info">Sin ANTHROPIC_API_KEY el argumentario se genera con plantillas y no se valora la marca a partir de la captura.</Alert>
        </div>
      ) : null}

      <SearchPanel googleEnabled={!!googleKey()} />

      <div className="mt-8 mb-3 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={link({ estado: f === "activos" ? "" : f })}
            className={cx("rounded-full border px-3 py-1 text-xs font-semibold", filter === f ? "border-ink bg-ink text-white" : "border-line-strong bg-card hover:border-ink")}
          >
            {f === "activos" ? "Activos" : f === "todos" ? "Todos" : LEAD_STATUS_LABEL[f]}
          </Link>
        ))}
        <span className="mx-2 h-4 w-px bg-line-strong" />
        {["", "alta", "media", "baja"].map((n) => (
          <Link
            key={n || "all"}
            href={link({ nivel: n })}
            className={cx("rounded-full border px-3 py-1 text-xs font-semibold", level === n ? "border-ink bg-ink text-white" : "border-line-strong bg-card hover:border-ink")}
          >
            {n ? `Oportunidad ${n}` : "Cualquier nivel"}
          </Link>
        ))}
        <form className="ml-auto" action="/leads">
          {filter !== "activos" ? <input type="hidden" name="estado" value={filter} /> : null}
          {level ? <input type="hidden" name="nivel" value={level} /> : null}
          <input name="q" defaultValue={q} placeholder="Buscar por nombre…" className="h-8 rounded-lg border border-line-strong bg-card px-3 text-sm" aria-label="Buscar lead" />
        </form>
      </div>

      <Card className="p-4">
        {rows.length ? <LeadsTable rows={rows} /> : <EmptyState title="No hay leads con estos filtros">Busca negocios arriba o añade uno a mano.</EmptyState>}
      </Card>
    </main>
  );
}
