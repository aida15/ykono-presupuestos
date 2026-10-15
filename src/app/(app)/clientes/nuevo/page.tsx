import { requireMember } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { ClientForm } from "../client-form";

export const metadata = { title: "Nuevo cliente" };

export default async function NewClientPage() {
  await requireMember();
  return (
    <main className="mx-auto max-w-3xl px-5 py-8 lg:px-10 lg:py-10">
      <PageHeader kicker="Clientes" title="Nuevo cliente">
        Solo el nombre es obligatorio. Los datos fiscales se pedirán al cerrar el presupuesto.
      </PageHeader>
      <Card className="p-6">
        <ClientForm />
      </Card>
    </main>
  );
}
