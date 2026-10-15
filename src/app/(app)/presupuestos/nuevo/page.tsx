import { MessageSquareText, PencilRuler } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { createManualQuote } from "@/lib/actions/quotes";
import { startInterview } from "@/lib/actions/interview";
import { Button, Card, Field, Input, PageHeader, Select } from "@/components/ui";

export const metadata = { title: "Crear presupuesto" };

export default async function NewQuotePage({ searchParams }: PageProps<"/presupuestos/nuevo">) {
  const sp = await searchParams;
  const preselected = typeof sp.cliente === "string" ? sp.cliente : "";
  const ctx = await requireMember();
  const { data: clients } = await ctx.supabase
    .from("clients")
    .select("id, trade_name")
    .eq("studio_id", ctx.studioId)
    .eq("archived", false)
    .order("trade_name");

  const clientSelect = (
    <Select name="client_id" defaultValue={preselected}>
      <option value="">— Lo decidimos después —</option>
      {(clients ?? []).map((c) => (
        <option key={c.id} value={c.id}>
          {c.trade_name}
        </option>
      ))}
    </Select>
  );

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 lg:px-10 lg:py-10">
      <PageHeader kicker="Nuevo presupuesto" title="¿Cómo quieres empezar?" />
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="flex flex-col p-6 ring-2 ring-lime">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-ink text-lime">
            <MessageSquareText size={20} />
          </div>
          <h2 className="text-xl font-bold">Entrevista con IA</h2>
          <p className="mt-1 mb-5 text-sm text-muted">
            Describe el encargo con tus palabras. El asistente ordena la información, pregunta lo que falta y prepara un borrador con el catálogo. Los precios los calcula
            siempre el motor de tarifas, nunca la IA.
          </p>
          <form action={startInterview} className="mt-auto flex flex-col gap-3">
            <Field label="Cliente (opcional)">{clientSelect}</Field>
            <Button type="submit" variant="lime">
              Empezar entrevista
            </Button>
          </form>
        </Card>
        <Card className="flex flex-col p-6">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-surface">
            <PencilRuler size={20} />
          </div>
          <h2 className="text-xl font-bold">Crear manualmente</h2>
          <p className="mt-1 mb-5 text-sm text-muted">Abre el editor con una estructura sencilla y añade las partidas desde el catálogo.</p>
          <form action={createManualQuote} className="mt-auto flex flex-col gap-3">
            <Field label="Título del proyecto">
              <Input name="title" placeholder="Presupuesto: tótems interactivos" />
            </Field>
            <Field label="Cliente (opcional)">{clientSelect}</Field>
            <Button type="submit">Abrir editor</Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
