"use client";

import type { QuoteTotals } from "@/lib/domain/pricing";
import type { ValidationProblem } from "@/lib/domain/quote";
import { formatBp, formatEUR } from "@/lib/domain/money";
import { Alert, cx } from "@/components/ui";

function Row({ label, value, strong, muted }: { label: string; value: number; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cx("flex justify-between gap-3 py-1 text-sm", strong && "font-bold", muted && "text-muted")}>
      <span>{label}</span>
      <span className="tabular">{formatEUR(value)}</span>
    </div>
  );
}

export function SummaryPanel({ totals, problems }: { totals: QuoteTotals; problems: ValidationProblem[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-ink p-5 text-white">
        <p className="kicker !text-lime">Total del proyecto</p>
        <p className="tabular mt-2 text-3xl font-bold tracking-tight">{formatEUR(totals.taxableBase + totals.suplidos)}</p>
        <p className="text-sm text-white/60">+ IVA</p>
        <div className="mt-4 border-t border-white/15 pt-3">
          <p className="tabular text-lg font-semibold">{formatEUR(totals.total)}</p>
          <p className="text-xs text-white/60">IVA incluido</p>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-card p-4">
        {totals.lineDiscounts > 0 && <Row label="Importe bruto" value={totals.ownGross} muted />}
        {totals.lineDiscounts > 0 && <Row label="Descuentos de partida" value={-totals.lineDiscounts} muted />}
        <Row label="Trabajo de YKONO" value={totals.ownSubtotal} />
        {totals.globalDiscount > 0 && <Row label={`Descuento global (${formatBp(totals.globalDiscountBp)})`} value={-totals.globalDiscount} />}
        {totals.resaleSubtotal > 0 && <Row label="Terceros refacturados" value={totals.resaleSubtotal} />}
        <div className="my-1 border-t border-line" />
        <Row label="Base imponible" value={totals.taxableBase} strong />
        {totals.vatGroups.map((g) => (
          <Row key={g.rateBp} label={`IVA ${formatBp(g.rateBp)} sobre ${formatEUR(g.base)}`} value={g.vat} muted />
        ))}
        {totals.suplidos > 0 && <Row label="Suplidos (sin IVA)" value={totals.suplidos} />}
        <div className="my-1 border-t border-line" />
        <Row label="Total con IVA" value={totals.total} strong />
      </div>

      {totals.optionalExcluded.count > 0 && (
        <div className="rounded-xl border border-dashed border-info/40 bg-info-soft/40 p-4 text-sm">
          <p className="font-semibold text-info">Opcionales no incluidos ({totals.optionalExcluded.count})</p>
          <p className="tabular text-ink-3">
            {formatEUR(totals.optionalExcluded.net)} + IVA · no suman al total
          </p>
        </div>
      )}
      {totals.informativeExternal.count > 0 && (
        <div className="rounded-xl border border-line bg-surface p-4 text-sm">
          <p className="font-semibold">Costes de terceros a nombre del cliente</p>
          <p className="tabular text-ink-3">{formatEUR(totals.informativeExternal.net)} orientativos · informativos, no suman</p>
        </div>
      )}

      <div>
        <p className="kicker mb-2">Para cerrar el presupuesto</p>
        {problems.length === 0 ? (
          <Alert tone="lime">Todo listo para marcarlo como definitivo.</Alert>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {problems.map((p, i) => (
              <li key={i}>
                <Alert tone={p.scope === "item" || p.scope === "payment" ? "danger" : "warn"}>{p.message}</Alert>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
