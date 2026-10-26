"use client";

import { CircleDashed } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import type { QueueState } from "./use-analyze";

export function QueueProgress({ state, onCancel }: { state: QueueState; onCancel: () => void }) {
  if (!state.total) return null;
  const pct = Math.round((state.done / state.total) * 100);
  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <div className="flex items-center gap-3">
        {state.running ? <CircleDashed size={16} className="animate-spin" /> : null}
        <p className="text-sm font-semibold">
          {state.running ? `Analizando ${state.done + 1} de ${state.total}` : `Análisis terminado: ${state.done} de ${state.total}`}
          {state.current ? <span className="font-normal text-muted"> · {state.current}</span> : null}
        </p>
        {state.running ? (
          <Button size="sm" variant="ghost" className="ml-auto" onClick={onCancel}>
            Parar
          </Button>
        ) : null}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
        <div className="h-full bg-lime transition-all" style={{ width: `${pct}%` }} />
      </div>
      {state.errors.length ? (
        <div className="mt-2">
          <Alert tone="warn" title="Algunos no se han podido analizar del todo">
            <ul className="list-disc pl-4">
              {state.errors.slice(0, 6).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Alert>
        </div>
      ) : null}
    </div>
  );
}
