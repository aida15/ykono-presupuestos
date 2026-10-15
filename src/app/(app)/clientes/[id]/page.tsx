import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { listQuotes } from "@/lib/data/quotes";
import type { Client, ClientContact } from "@/lib/data/types";
import { Alert, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { QuoteTable } from "@/components/quote-table";
import { ActionButton } from "@/components/action-button";
import { duplicateClient, setClientArchived, deleteContact } from "@/lib/actions/clients";
import { ClientForm } from "../client-form";
import { ContactForm } from "./contact-form";

export default async function ClientPage({ params }: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  const ctx = await requireMember();
  const { data: client } = await ctx.supabase.from("clients").select("*").eq("id", id).eq("studio_id", ctx.studioId).maybeSingle();
  if (!client) notFound();
  const c = client as Client;
  const [{ data: contacts }, quotes] = await Promise.all([
    ctx.supabase.from("client_contacts").select("*").eq("client_id", id).order("is_primary", { ascending: false }),
    listQuotes(ctx, { clientId: id }),
  ]);
  const missing = [!c.legal_name && "razón social", !c.tax_id && "NIF/CIF", (!c.address_line || !c.city) && "dirección"].filter(Boolean);

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 lg:px-10 lg:py-10">
      <PageHeader
        kicker="Cliente"
        title={c.trade_name}
        actions={
          <>
            <ButtonLink href={`/presupuestos/nuevo?cliente=${c.id}`} variant="lime">
              <Plus size={16} /> Presupuesto para este cliente
            </ButtonLink>
            <ActionButton action={duplicateClient.bind(null, c.id)} pendingLabel="Duplicando…">
              Duplicar cliente
            </ActionButton>
            <ActionButton
              action={setClientArchived.bind(null, c.id, !c.archived)}
              confirm={c.archived ? undefined : "¿Archivar este cliente? Sus presupuestos se conservan."}
            >
              {c.archived ? "Reactivar" : "Archivar"}
            </ActionButton>
          </>
        }
      >
        {c.legal_name ?? ""}
      </PageHeader>

      {missing.length ? (
        <div className="mb-6">
          <Alert tone="warn" title="Datos fiscales incompletos">
            Falta {missing.join(", ")}. Puedes preparar el presupuesto igualmente; se pedirán antes de cerrarlo.
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-6">
          <h2 className="kicker mb-4">Datos</h2>
          <ClientForm client={c} />
        </Card>
        <div className="flex flex-col gap-6">
          <Card className="p-6">
            <h2 className="kicker mb-4">Personas de contacto</h2>
            <ul className="mb-4 divide-y divide-line">
              {((contacts ?? []) as ClientContact[]).map((ct) => (
                <li key={ct.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <p className="font-semibold">
                      {ct.name} {ct.is_primary ? <span className="text-xs font-normal text-lime-ink">· principal</span> : null}
                    </p>
                    <p className="text-xs text-muted">{[ct.role, ct.email, ct.phone].filter(Boolean).join(" · ")}</p>
                  </div>
                  <ActionButton action={deleteContact.bind(null, c.id, ct.id)} variant="ghost" confirm="¿Eliminar contacto?">
                    Quitar
                  </ActionButton>
                </li>
              ))}
              {(contacts ?? []).length === 0 ? <li className="py-2 text-sm text-muted">Sin contactos.</li> : null}
            </ul>
            <ContactForm clientId={c.id} />
          </Card>
        </div>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="kicker mb-3">Historial de presupuestos</h2>
        {quotes.length ? <QuoteTable rows={quotes} /> : <EmptyState title="Sin presupuestos todavía" />}
      </Card>
    </main>
  );
}
