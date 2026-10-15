import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { getCatalog, normalizeRule } from "@/lib/data/catalog";
import { describeRule } from "@/lib/domain/describe";
import { Badge, Card, PageHeader } from "@/components/ui";
import { PriceStatusBadge } from "@/components/status";
import { ActionButton } from "@/components/action-button";
import { toggleServiceActive } from "@/lib/actions/catalog";
import { ServiceForm } from "../service-form";
import { RuleEditor } from "../rule-editor";

export default async function ServicePage({ params }: PageProps<"/catalogo/servicios/[id]">) {
  const { id } = await params;
  const ctx = await requireMember();
  const { categories, services } = await getCatalog(ctx, { includeInactive: true });
  const service = services.find((s) => s.id === id);
  if (!service) notFound();
  const { data: history } = await ctx.supabase
    .from("pricing_rules")
    .select("*")
    .eq("service_id", id)
    .order("version", { ascending: false });

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 lg:px-10 lg:py-10">
      <PageHeader
        kicker="Servicio"
        title={service.name}
        actions={
          <ActionButton action={toggleServiceActive.bind(null, service.id, !service.active)}>
            {service.active ? "Desactivar" : "Activar"}
          </ActionButton>
        }
      >
        {service.rule ? describeRule(service.rule, service.unit) : "Sin tarifa"}
      </PageHeader>
      <div className="grid gap-6">
        <Card className="p-6">
          <h2 className="kicker mb-4">Tarifa vigente</h2>
          <RuleEditor serviceId={service.id} rule={service.rule} unit={service.unit} />
        </Card>
        <Card className="p-6">
          <h2 className="kicker mb-4">Datos del servicio</h2>
          <ServiceForm service={service} categories={categories} allServices={services.map((s) => ({ id: s.id, name: s.name }))} />
        </Card>
        <Card className="p-6">
          <h2 className="kicker mb-3">Historial de versiones</h2>
          <table className="w-full text-sm">
            <tbody>
              {(history ?? []).map((r) => {
                const rule = normalizeRule(r);
                return (
                  <tr key={rule.id} className="border-t border-line/70">
                    <td className="py-2 pr-3 font-mono text-xs">v{rule.version}</td>
                    <td className="py-2 pr-3">{describeRule(rule, service.unit)}</td>
                    <td className="py-2 pr-3">
                      <PriceStatusBadge status={rule.default_price_status} short />
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted">{new Date(rule.created_at).toLocaleDateString("es-ES")}</td>
                    <td className="py-2 text-right">{rule.is_current ? <Badge tone="lime">Vigente</Badge> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </main>
  );
}
