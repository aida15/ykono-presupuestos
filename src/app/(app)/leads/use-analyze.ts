"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { analyzeLeadData, analyzeLeadPitch } from "@/lib/actions/leads";

export type QueueState = { running: boolean; done: number; total: number; current: string | null; errors: string[] };

/**
 * Analiza leads uno a uno: primero datos (web, Google, velocidad) y luego el
 * argumentario. Cada paso es una llamada corta para no superar el límite de Vercel.
 */
export function useAnalyzeQueue() {
  const router = useRouter();
  const [state, setState] = useState<QueueState>({ running: false, done: 0, total: 0, current: null, errors: [] });
  const cancelled = useRef(false);

  const run = useCallback(
    async (items: { id: string; name: string }[]) => {
      cancelled.current = false;
      setState({ running: true, done: 0, total: items.length, current: null, errors: [] });
      for (let i = 0; i < items.length; i++) {
        if (cancelled.current) break;
        const it = items[i];
        setState((s) => ({ ...s, current: `${it.name} · web y Google` }));
        const a = await analyzeLeadData(it.id);
        if (a.ok) {
          setState((s) => ({ ...s, current: `${it.name} · argumentario` }));
          const b = await analyzeLeadPitch(it.id);
          if (!b.ok) setState((s) => ({ ...s, errors: [...s.errors, `${it.name}: ${b.error}`] }));
        } else {
          setState((s) => ({ ...s, errors: [...s.errors, `${it.name}: ${a.error}`] }));
        }
        setState((s) => ({ ...s, done: i + 1 }));
        if ((i + 1) % 3 === 0) router.refresh();
      }
      setState((s) => ({ ...s, running: false, current: null }));
      router.refresh();
    },
    [router],
  );

  return { state, run, cancel: () => (cancelled.current = true) };
}
