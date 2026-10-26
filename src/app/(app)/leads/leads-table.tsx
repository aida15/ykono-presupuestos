"use client";

import Link from "next/link";
import { useState } from "react";
import { formatEUR } from "@/lib/domain/money";
import { Badge, Button } from "@/components/ui";
import { hostOf, LeadStatusBadge, ScoreBadge } from "./lead-ui";
import { useAnalyzeQueue } from "./use-analyze";
import { QueueProgress } from "./queue-progress";

export type LeadListRow = {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  website: string | null;
  status: string;
  score: number | null;
  gaps: string[];
  estimate: number;
  analyzed: boolean;
  franchise: boolean;
};

export function LeadsTable({ rows }: { rows: LeadListRow[] }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const queue = useAnalyzeQueue();
  const pendingRows = rows.filter((r) => !r.analyzed && r.status !== "discarded");
  const toggle = (id: string) => setSel((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));

  const analyze = (list: LeadListRow[]) => {
    setSel(new Set());
    void queue.run(list.map((r) => ({ id: r.id, name: r.name })));
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" disabled={!sel.size || queue.state.running} onClick={() => analyze(rows.filter((r) => sel.has(r.id)))}>
          {sel.size ? `Analizar ${sel.size} seleccionados` : "Analizar seleccionados"}
        </Button>
        {pendingRows.length ? (
          <Button size="sm" variant="lime" disabled={queue.state.running} onClick={() => analyze(pendingRows)}>
            Analizar los {pendingRows.length} pendientes
          </Button>
        ) : null}
        <span className="ml-auto text-xs text-muted">{rows.length} leads · ordenados por oportunidad</span>
      </div>
      {queue.state.total ? (
        <div className="mb-3">
          <QueueProgress state={queue.state} onCancel={queue.cancel} />
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="w-8 py-2" />
              <th className="py-2 pr-3 font-semibold">Oport.</th>
              <th className="py-2 pr-3 font-semibold">Negocio</th>
              <th className="py-2 pr-3 font-semibold">Web</th>
              <th className="hidden py-2 pr-3 font-semibold lg:table-cell">Lo que no cumple</th>
              <th className="py-2 pr-3 text-right font-semibold">Estimación</th>
              <th className="py-2 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line/70 align-top last:border-0 hover:bg-surface/60">
                <td className="py-3">
                  <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Seleccionar ${r.name}`} />
                </td>
                <td className="py-2 pr-3">
                  <ScoreBadge score={r.score} />
                </td>
                <td className="py-2.5 pr-3">
                  <Link href={`/leads/${r.id}`} className="font-semibold hover:underline">
                    {r.name}
                  </Link>
                  <p className="text-xs text-muted">{[r.category, r.city].filter(Boolean).join(" · ")}</p>
                  {r.franchise ? <Badge tone="warn" className="mt-1">¿Franquicia?</Badge> : null}
                </td>
                <td className="py-2.5 pr-3 text-xs">{r.website ? <span className="text-ink-3">{hostOf(r.website)}</span> : <Badge tone="lime">Sin web</Badge>}</td>
                <td className="hidden py-2.5 pr-3 lg:table-cell">
                  <div className="flex max-w-md flex-wrap gap-1">
                    {r.gaps.slice(0, 4).map((g) => (
                      <span key={g} className="rounded bg-surface px-1.5 py-0.5 text-[11px] text-ink-3">
                        {g}
                      </span>
                    ))}
                    {r.gaps.length > 4 ? <span className="text-[11px] text-muted">+{r.gaps.length - 4}</span> : null}
                  </div>
                </td>
                <td className="tabular py-2.5 pr-3 text-right whitespace-nowrap">{r.estimate ? `${formatEUR(r.estimate, { compact: true })}` : "—"}</td>
                <td className="py-2.5">
                  <LeadStatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
