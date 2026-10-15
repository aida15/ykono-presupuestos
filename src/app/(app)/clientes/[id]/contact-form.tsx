"use client";

import { useActionState, useEffect, useRef } from "react";
import { addContact } from "@/lib/actions/clients";
import { Alert, Button, Input } from "@/components/ui";

export function ContactForm({ clientId }: { clientId: string }) {
  const [state, action, pending] = useActionState(addContact.bind(null, clientId), null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="grid grid-cols-2 gap-2 border-t border-line pt-4">
      <Input name="name" placeholder="Nombre *" required aria-label="Nombre" />
      <Input name="role" placeholder="Cargo" aria-label="Cargo" />
      <Input name="email" type="email" placeholder="Email" aria-label="Email" />
      <Input name="phone" placeholder="Teléfono" aria-label="Teléfono" />
      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_primary" /> Contacto principal (valida el trabajo)
      </label>
      <div className="col-span-2 flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          Añadir contacto
        </Button>
        {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}
      </div>
    </form>
  );
}
