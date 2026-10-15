"use client";

import { useCallback, useState } from "react";
import type { QuoteDraft } from "@/lib/domain/quote";

const MAX_HISTORY = 60;
/** Cambios seguidos del mismo campo en menos de este tiempo cuentan como un solo paso de deshacer. */
const COALESCE_MS = 900;

export type Updater = (d: QuoteDraft) => QuoteDraft;

type State = {
  present: QuoteDraft;
  past: QuoteDraft[];
  future: QuoteDraft[];
  dirty: boolean;
  lastKey: string | null;
  lastAt: number;
};

/** Estado del editor con historial de deshacer/rehacer (actualizaciones puras). */
export function useDraft(initial: QuoteDraft) {
  const [s, setS] = useState<State>({ present: initial, past: [], future: [], dirty: false, lastKey: null, lastAt: 0 });

  const update = useCallback((fn: Updater, key?: string) => {
    const now = Date.now();
    setS((st) => {
      const next = fn(st.present);
      if (next === st.present) return st;
      const coalesce = key != null && key === st.lastKey && now - st.lastAt < COALESCE_MS;
      return {
        present: next,
        past: coalesce ? st.past : [...st.past, st.present].slice(-MAX_HISTORY),
        future: [],
        dirty: true,
        lastKey: key ?? null,
        lastAt: now,
      };
    });
  }, []);

  const undo = useCallback(() => {
    setS((st) =>
      st.past.length
        ? {
            present: st.past[st.past.length - 1],
            past: st.past.slice(0, -1),
            future: [st.present, ...st.future].slice(0, MAX_HISTORY),
            dirty: true,
            lastKey: null,
            lastAt: 0,
          }
        : st,
    );
  }, []);

  const redo = useCallback(() => {
    setS((st) =>
      st.future.length
        ? {
            present: st.future[0],
            past: [...st.past, st.present].slice(-MAX_HISTORY),
            future: st.future.slice(1),
            dirty: true,
            lastKey: null,
            lastAt: 0,
          }
        : st,
    );
  }, []);

  /** Marca como guardado solo si no ha cambiado desde que se envió `saved`. */
  const markSaved = useCallback((saved: QuoteDraft) => {
    setS((st) => (st.present === saved ? { ...st, dirty: false } : st));
  }, []);

  const replace = useCallback((d: QuoteDraft) => {
    setS({ present: d, past: [], future: [], dirty: false, lastKey: null, lastAt: 0 });
  }, []);

  return {
    draft: s.present,
    update,
    undo,
    redo,
    canUndo: s.past.length > 0,
    canRedo: s.future.length > 0,
    dirty: s.dirty,
    markSaved,
    replace,
  };
}
