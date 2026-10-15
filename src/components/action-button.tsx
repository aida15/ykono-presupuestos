"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button } from "./ui";

type Result = { ok: boolean; error?: string } | void | undefined;

/** Botón que ejecuta una acción de servidor, con confirmación opcional y error inline. */
export function ActionButton({
  action,
  children,
  confirm,
  variant = "secondary",
  size = "sm",
  pendingLabel,
}: {
  action: () => Promise<Result>;
  children: ReactNode;
  confirm?: string;
  variant?: "primary" | "secondary" | "ghost" | "lime" | "danger";
  size?: "sm" | "md";
  pendingLabel?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        variant={variant}
        size={size}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setError(null);
          start(async () => {
            const r = await action();
            if (r && !r.ok) setError(r.error ?? "Error");
          });
        }}
      >
        {pending ? (pendingLabel ?? "…") : children}
      </Button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}
