"use client";

import { Plus, Trash2, X } from "lucide-react";
import type { QuoteDraft } from "@/lib/domain/quote";
import type { PaymentSchedule } from "@/lib/domain/payments";
import type { QuoteTotals } from "@/lib/domain/pricing";
import { formatEUR } from "@/lib/domain/money";
import { Alert, Button, cx } from "@/components/ui";
import { LinesInput, ScaledInput, SmallSelect, TextArea, TextInput } from "./inputs";
import type { Updater } from "./use-draft";

export function PaymentsEditor({
  draft,
  update,
  totals,
  schedule,
  readOnly,
}: {
  draft: QuoteDraft;
  update: (fn: Updater, key?: string) => void;
  totals: QuoteTotals;
  schedule: PaymentSchedule;
  readOnly: boolean;
}) {
  const setPayment = (id: string, patch: Partial<QuoteDraft["payments"][number]>, key?: string) =>
    update((d) => ({ ...d, payments: d.payments.map((p) => (p.id === id ? { ...p, ...patch } : p)) }), key ? `pay:${id}:${key}` : undefined);

  function splitEvenly() {
    update((d) => {
      const n = d.payments.length;
      if (!n) return d;
      if (d.payment_mode === "percent") {
        const each = Math.floor(10000 / n);
        return { ...d, payments: d.payments.map((p, i) => ({ ...p, percent_bp: i === n - 1 ? 10000 - each * (n - 1) : each })) };
      }
      const each = Math.floor(totals.netAgreed / n);
      return { ...d, payments: d.payments.map((p, i) => ({ ...p, amount: i === n - 1 ? totals.netAgreed - each * (n - 1) : each })) };
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-bold">Calendario de pagos</h3>
            <p className="text-xs text-muted">
              Importe acordado sin IVA: <span className="tabular font-semibold text-ink">{formatEUR(totals.netAgreed)}</span> · con IVA:{" "}
              <span className="tabular font-semibold text-ink">{formatEUR(totals.total)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SmallSelect
              value={draft.payment_mode}
              disabled={readOnly}
              className="w-auto"
              aria-label="Modo de pago"
              onChange={(e) => {
                const mode = e.target.value as "percent" | "fixed";
                // Al cambiar de modo se traducen los valores actuales para no perder el reparto.
                update((d) => ({
                  ...d,
                  payment_mode: mode,
                  payments: d.payments.map((p) => {
                    const r = schedule.payments.find((x) => x.id === p.id);
                    return mode === "fixed" ? { ...p, amount: r?.net ?? 0 } : { ...p, percent_bp: r?.percentBp ?? 0 };
                  }),
                }));
              }}
            >
              <option value="percent">Por porcentajes</option>
              <option value="fixed">Por importes</option>
            </SmallSelect>
            {!readOnly && (
              <Button variant="secondary" size="sm" onClick={splitEvenly}>
                Repartir igual
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs text-muted">
              <tr>
                <th className="p-2 font-semibold">Pago</th>
                <th className="p-2 font-semibold">Hito</th>
                <th className="p-2 font-semibold">Cuándo</th>
                <th className="w-28 p-2 text-right font-semibold">{draft.payment_mode === "percent" ? "%" : "Importe s/IVA"}</th>
                <th className="w-28 p-2 text-right font-semibold">Con IVA</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {draft.payments.map((p) => {
                const r = schedule.payments.find((x) => x.id === p.id);
                return (
                  <tr key={p.id} className="border-t border-line align-top">
                    <td className="p-1.5">
                      <TextInput value={p.label} onChange={(v) => setPayment(p.id, { label: v }, "l")} disabled={readOnly} aria-label="Nombre del pago" />
                    </td>
                    <td className="p-1.5">
                      <TextInput value={p.milestone} onChange={(v) => setPayment(p.id, { milestone: v }, "m")} disabled={readOnly} placeholder="Al aceptar la propuesta" aria-label="Hito" />
                    </td>
                    <td className="p-1.5">
                      <TextInput value={p.due_hint} onChange={(v) => setPayment(p.id, { due_hint: v }, "d")} disabled={readOnly} placeholder="Mes 1" aria-label="Cuándo" />
                    </td>
                    <td className="p-1.5">
                      {draft.payment_mode === "percent" ? (
                        <ScaledInput value={p.percent_bp} onChange={(v) => setPayment(p.id, { percent_bp: v }, "p")} suffix="%" disabled={readOnly} ariaLabel="Porcentaje" />
                      ) : (
                        <ScaledInput value={p.amount} onChange={(v) => setPayment(p.id, { amount: v }, "a")} suffix="€" disabled={readOnly} ariaLabel="Importe" />
                      )}
                      <p className="tabular mt-0.5 text-right text-[11px] text-muted">
                        {draft.payment_mode === "percent" ? formatEUR(r?.net ?? 0) : `${((r?.percentBp ?? 0) / 100).toLocaleString("es-ES")} %`}
                      </p>
                    </td>
                    <td className="tabular p-2 text-right">{formatEUR(r?.total ?? 0)}</td>
                    <td className="p-1.5">
                      {!readOnly && (
                        <button className="p-1 text-muted hover:text-danger" aria-label="Quitar pago" onClick={() => update((d) => ({ ...d, payments: d.payments.filter((x) => x.id !== p.id) }))}>
                          <X size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-line bg-surface text-sm font-semibold">
              <tr>
                <td className="p-2" colSpan={3}>
                  Suma
                </td>
                <td className={cx("tabular p-2 text-right", schedule.sumNet !== totals.netAgreed && "text-danger")}>{formatEUR(schedule.sumNet)}</td>
                <td className={cx("tabular p-2 text-right", schedule.sumTotal !== totals.total && "text-danger")}>{formatEUR(schedule.sumTotal)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        {schedule.issues.map((i) => (
          <div key={i.code} className="mt-2">
            <Alert tone="danger">{i.message}</Alert>
          </div>
        ))}
        {!readOnly && (
          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() =>
              update((d) => ({
                ...d,
                payments: [...d.payments, { id: crypto.randomUUID(), label: `Pago ${d.payments.length + 1}`, milestone: "", due_hint: "", planned_date: null, percent_bp: 0, amount: 0 }],
              }))
            }
          >
            <Plus size={14} /> Pago
          </Button>
        )}
        <label className="mt-4 block text-xs font-semibold text-muted">
          Cómo se paga
          <TextArea rows={2} value={draft.payment_terms} onChange={(v) => update((d) => ({ ...d, payment_terms: v }), "terms")} disabled={readOnly} />
        </label>
      </section>

      <section>
        <h3 className="mb-2 font-bold">Condiciones</h3>
        {draft.conditions.map((c, i) => (
          <div key={i} className="mb-2 grid gap-2 md:grid-cols-[180px_1fr_auto]">
            <TextInput value={c.title} disabled={readOnly} onChange={(v) => update((d) => ({ ...d, conditions: d.conditions.map((x, j) => (j === i ? { ...x, title: v } : x)) }), `cond${i}t`)} />
            <TextArea rows={2} value={c.text} disabled={readOnly} onChange={(v) => update((d) => ({ ...d, conditions: d.conditions.map((x, j) => (j === i ? { ...x, text: v } : x)) }), `cond${i}x`)} />
            {!readOnly && (
              <Button variant="ghost" size="sm" aria-label="Quitar condición" onClick={() => update((d) => ({ ...d, conditions: d.conditions.filter((_, j) => j !== i) }))}>
                <Trash2 size={14} />
              </Button>
            )}
          </div>
        ))}
        {!readOnly && (
          <Button variant="secondary" size="sm" onClick={() => update((d) => ({ ...d, conditions: [...d.conditions, { title: "", text: "" }] }))}>
            <Plus size={14} /> Condición
          </Button>
        )}
        <p className="mt-2 text-xs text-muted">La validez de la oferta se añade automáticamente con la fecha de la pestaña Datos.</p>
      </section>

      <section>
        <h3 className="mb-2 font-bold">Lo que no incluye</h3>
        <LinesInput value={draft.exclusions} onChange={(v) => update((d) => ({ ...d, exclusions: v }), "excl")} disabled={readOnly} rows={5} placeholder="Una exclusión por línea" />
        <p className="mt-1 text-xs text-muted">Los costes de terceros se listan aparte, a partir de las partidas marcadas como terceros.</p>
      </section>

      <section>
        <h3 className="mb-2 font-bold">Notas internas</h3>
        <TextArea rows={3} value={draft.notes_internal} onChange={(v) => update((d) => ({ ...d, notes_internal: v }), "notes")} disabled={readOnly} placeholder="No aparecen en el documento." />
      </section>
    </div>
  );
}
