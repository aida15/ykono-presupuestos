import Link from "next/link";
import { Plus } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { getCatalog, getQuestions } from "@/lib/data/catalog";
import { describeRule } from "@/lib/domain/describe";
import { DISCIPLINE_LABEL } from "@/lib/catalog/disciplines";
import { Badge, ButtonLink, Card, PageHeader, cx } from "@/components/ui";
import { PriceStatusBadge } from "@/components/status";
import { CategoryForm } from "./category-form";
import { QuestionRow, QuestionForm } from "./question-forms";

export const metadata = { title: "Catálogo y tarifas" };

const TABS = [
  { key: "servicios", label: "Servicios y tarifas" },
  { key: "preguntas", label: "Preguntas de briefing" },
  { key: "categorias", label: "Categorías" },
];

export default async function CatalogPage({ searchParams }: PageProps<"/catalogo">) {
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as string) : "servicios";
  const ctx = await requireMember();
  const [{ categories, services }, questions] = await Promise.all([
    getCatalog(ctx, { includeInactive: true }),
    tab === "preguntas" ? getQuestions(ctx, { includeInactive: true }) : Promise.resolve([]),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 lg:px-10 lg:py-10">
      <PageHeader
        kicker="Catálogo"
        title="Servicios y tarifas"
        actions={
          <ButtonLink href="/catalogo/servicios/nuevo">
            <Plus size={16} /> Nuevo servicio
          </ButtonLink>
        }
      >
        Las tarifas son versionadas: al cambiar un precio se crea una versión nueva y los presupuestos guardados conservan el suyo.
      </PageHeader>

      <div className="mb-6 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/catalogo?tab=${t.key}`}
            className={cx(
              "-mb-px border-b-2 px-3 py-2 text-sm font-semibold",
              tab === t.key ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "servicios" &&
        categories.map((cat) => {
          const list = services.filter((s) => s.category_id === cat.id);
          return (
            <Card key={cat.id} className="mb-5 p-5">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">{cat.name}</h2>
                  {cat.description ? <p className="text-xs text-muted">{cat.description}</p> : null}
                </div>
                {!cat.active ? <Badge>Inactiva</Badge> : null}
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {list.map((s) => (
                    <tr key={s.id} className={cx("border-t border-line/70", !s.active && "opacity-50")}>
                      <td className="py-2.5 pr-3">
                        <Link href={`/catalogo/servicios/${s.id}`} className="font-medium hover:underline">
                          {s.name}
                        </Link>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {!s.active ? <Badge>Desactivado</Badge> : null}
                          {s.is_optional_default ? <Badge tone="info">Opcional</Badge> : null}
                          {s.is_external_cost ? <Badge tone="neutral">Terceros</Badge> : null}
                        </div>
                      </td>
                      <td className="tabular py-2.5 pr-3 text-ink-3">{s.rule ? describeRule(s.rule, s.unit) : "Sin tarifa"}</td>
                      <td className="py-2.5 pr-3 text-right">
                        {s.rule ? <PriceStatusBadge status={s.rule.default_price_status} short /> : <Badge tone="danger">Sin tarifa</Badge>}
                      </td>
                      <td className="py-2.5 text-right text-xs text-muted">{s.rule ? `v${s.rule.version}` : ""}</td>
                    </tr>
                  ))}
                  {list.length === 0 ? (
                    <tr>
                      <td className="py-2 text-sm text-muted">Sin servicios.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </Card>
          );
        })}

      {tab === "preguntas" && (
        <div className="flex flex-col gap-5">
          <Card className="p-5">
            <h2 className="kicker mb-3">Nueva pregunta</h2>
            <QuestionForm services={services.map((s) => ({ id: s.id, name: s.name }))} />
          </Card>
          {Object.entries(DISCIPLINE_LABEL)
            .filter(([k]) => k !== "external" && k !== "management")
            .map(([key, label]) => {
              const qs = questions.filter((q) => q.discipline === key);
              return (
                <Card key={key} className="p-5">
                  <h2 className="mb-2 text-lg font-bold">{label}</h2>
                  <ul className="divide-y divide-line">
                    {qs.map((q) => (
                      <QuestionRow key={q.id} q={q} services={services.map((s) => ({ id: s.id, name: s.name }))} />
                    ))}
                    {qs.length === 0 ? <li className="py-2 text-sm text-muted">Sin preguntas.</li> : null}
                  </ul>
                </Card>
              );
            })}
        </div>
      )}

      {tab === "categorias" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="kicker mb-3">Nueva categoría</h2>
            <CategoryForm categories={categories} />
          </Card>
          {categories.map((c) => (
            <Card key={c.id} className="p-5">
              <CategoryForm category={c} categories={categories} />
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
