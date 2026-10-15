import { requireMember } from "@/lib/auth";
import { getCatalog } from "@/lib/data/catalog";
import { Card, PageHeader } from "@/components/ui";
import { ServiceForm } from "../service-form";

export const metadata = { title: "Nuevo servicio" };

export default async function NewServicePage() {
  const ctx = await requireMember();
  const { categories, services } = await getCatalog(ctx, { includeInactive: true });
  return (
    <main className="mx-auto max-w-4xl px-5 py-8 lg:px-10 lg:py-10">
      <PageHeader kicker="Catálogo" title="Nuevo servicio">
        Después de crearlo podrás definir su tarifa.
      </PageHeader>
      <Card className="p-6">
        <ServiceForm categories={categories} allServices={services.map((s) => ({ id: s.id, name: s.name }))} />
      </Card>
    </main>
  );
}
