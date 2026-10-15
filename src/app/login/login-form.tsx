"use client";

import { useActionState } from "react";
import { signIn } from "@/lib/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

export function LoginForm({ next, noStudio, configWarning }: { next: string; noStudio: boolean; configWarning: string | null }) {
  const [state, action, pending] = useActionState(signIn, null);
  const error = state?.error ?? (noStudio ? "Tu usuaria no está asociada al estudio. Ejecuta supabase/bootstrap.sql." : null);

  return (
    <form action={action} className="mt-8 flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      {configWarning ? <Alert tone="warn">{configWarning}</Alert> : null}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Contraseña" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
