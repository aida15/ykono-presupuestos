"use client";

import { useState, useTransition } from "react";
import { resetLogo, uploadLogo } from "@/lib/actions/settings";
import { Alert, Button } from "@/components/ui";

export function LogoForm({ hasCustom }: { hasCustom: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      action={(fd) =>
        start(async () => {
          setError(null);
          const r = await uploadLogo(fd);
          if (!r.ok) setError(r.error);
        })
      }
    >
      <input type="file" name="logo" accept="image/png,image/jpeg" className="text-sm" aria-label="Logotipo" />
      <Button type="submit" size="sm" disabled={pending}>
        Subir
      </Button>
      {hasCustom ? (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => void (await resetLogo()))}>
          Volver al logotipo original
        </Button>
      ) : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </form>
  );
}
