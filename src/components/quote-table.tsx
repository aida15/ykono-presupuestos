import Link from "next/link";
import type { QuoteListRow } from "@/lib/data/types";
import { formatEUR } from "@/lib/domain/money";
import { formatDateES } from "@/lib/domain/quote";
import { QuoteStatusBadge } from "./status";

export function QuoteTable({ rows, compact }: { rows: QuoteListRow[]; compact?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="py-2 pr-3 font-semibold">Nº</th>
            <th className="py-2 pr-3 font-semibold">Proyecto</th>
            {!compact && <th className="py-2 pr-3 font-semibold">Cliente</th>}
            <th className="py-2 pr-3 font-semibold">Estado</th>
            {!compact && <th className="py-2 pr-3 font-semibold">Fecha</th>}
            <th className="py-2 text-right font-semibold">Base imponible</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line/70 last:border-0 hover:bg-surface/60">
              <td className="py-2.5 pr-3 font-mono text-xs whitespace-nowrap">
                <Link href={`/presupuestos/${r.id}`} className="hover:underline">
                  {r.number}
                  {r.version > 1 ? <span className="text-muted"> v{r.version}</span> : null}
                </Link>
              </td>
              <td className="py-2.5 pr-3">
                <Link href={`/presupuestos/${r.id}`} className="font-medium hover:underline">
                  {r.title || <span className="text-muted italic">Sin título</span>}
                </Link>
                {compact && r.client ? <p className="text-xs text-muted">{r.client.trade_name}</p> : null}
              </td>
              {!compact && <td className="py-2.5 pr-3 text-ink-3">{r.client?.trade_name ?? "—"}</td>}
              <td className="py-2.5 pr-3">
                <QuoteStatusBadge status={r.status} />
              </td>
              {!compact && <td className="py-2.5 pr-3 whitespace-nowrap text-ink-3">{formatDateES(r.issue_date, "short")}</td>}
              <td className="tabular py-2.5 text-right whitespace-nowrap">{formatEUR(r.taxable_base_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
