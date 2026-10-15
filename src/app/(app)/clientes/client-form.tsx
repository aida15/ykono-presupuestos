"use client";

import { useActionState } from "react";
import { saveClient } from "@/lib/actions/clients";
import type { Client } from "@/lib/data/types";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";

export function ClientForm({ client }: { client?: Client }) {
  const [state, action, pending] = useActionState(saveClient.bind(null, client?.id ?? null), null);
  const v = (k: keyof Client) => (client?.[k] as string | null | undefined) ?? "";
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <Field label="Nombre comercial *" htmlFor="trade_name">
        <Input id="trade_name" name="trade_name" defaultValue={v("trade_name")} required />
      </Field>
      <Field label="Razón social" htmlFor="legal_name">
        <Input id="legal_name" name="legal_name" defaultValue={v("legal_name")} />
      </Field>
      <Field label="NIF / CIF" htmlFor="tax_id" hint="Necesario para cerrar el presupuesto.">
        <Input id="tax_id" name="tax_id" defaultValue={v("tax_id")} />
      </Field>
      <Field label="Sector" htmlFor="sector">
        <Input id="sector" name="sector" defaultValue={v("sector")} />
      </Field>
      <Field label="Dirección" htmlFor="address_line" className="md:col-span-2">
        <Input id="address_line" name="address_line" defaultValue={v("address_line")} />
      </Field>
      <div className="grid grid-cols-3 gap-3 md:col-span-2">
        <Field label="C. P." htmlFor="postal_code">
          <Input id="postal_code" name="postal_code" defaultValue={v("postal_code")} />
        </Field>
        <Field label="Localidad" htmlFor="city">
          <Input id="city" name="city" defaultValue={v("city")} />
        </Field>
        <Field label="Provincia" htmlFor="province">
          <Input id="province" name="province" defaultValue={v("province")} />
        </Field>
      </div>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" defaultValue={v("email")} />
      </Field>
      <Field label="Teléfono" htmlFor="phone">
        <Input id="phone" name="phone" defaultValue={v("phone")} />
      </Field>
      <Field label="Web" htmlFor="website">
        <Input id="website" name="website" defaultValue={v("website")} />
      </Field>
      <Field label="País" htmlFor="country">
        <Input id="country" name="country" defaultValue={v("country") || "España"} />
      </Field>
      <Field label="Notas internas" htmlFor="notes" className="md:col-span-2">
        <Textarea id="notes" name="notes" defaultValue={v("notes")} />
      </Field>
      <div className="flex items-center gap-3 md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : client ? "Guardar cambios" : "Crear cliente"}
        </Button>
        {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}
        {state && state.ok ? <span className="text-sm text-lime-ink">Guardado.</span> : null}
      </div>
    </form>
  );
}
