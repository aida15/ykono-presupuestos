"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Copy, Plus, Search, Trash2, X } from "lucide-react";
import type { QuoteDraft, QuoteItemDraft, QuotePhaseDraft } from "@/lib/domain/quote";
import type { QuoteTotals } from "@/lib/domain/pricing";
import type { ServiceCategory, ServiceWithRule } from "@/lib/data/types";
import { itemFromService } from "@/lib/domain/catalog-items";
import { describeRule } from "@/lib/domain/describe";
import { formatEUR } from "@/lib/domain/money";
import {
  EXTERNAL_TREATMENTS,
  EXTERNAL_TREATMENT_LABEL,
  PRICE_STATUSES,
  PRICE_STATUS_LABEL,
  PRICING_METHODS,
  PRICING_METHOD_LABEL,
  type PricingMethod,
} from "@/lib/domain/schemas";
import { Badge, Button, cx } from "@/components/ui";
import { PriceStatusBadge } from "@/components/status";
import { LinesInput, ScaledInput, SmallSelect, TextArea, TextInput } from "./inputs";
import type { Updater } from "./use-draft";

const uid = () => crypto.randomUUID();
const move = <T,>(arr: T[], from: number, to: number) => {
  if (to < 0 || to >= arr.length) return arr;
  const copy = [...arr];
  const [x] = copy.splice(from, 1);
  copy.splice(to, 0, x);
  return copy;
};

/** Campos que, si se tocan, convierten una tarifa de catálogo en precio manual. */
const PRICE_FIELDS: (keyof QuoteItemDraft)[] = ["unit_price", "hours", "hourly_rate", "addons", "complexity_factor_bp", "method"];

export function ItemsEditor({
  draft,
  update,
  totals,
  services,
  categories,
  readOnly,
}: {
  draft: QuoteDraft;
  update: (fn: Updater, key?: string) => void;
  totals: QuoteTotals;
  services: ServiceWithRule[];
  categories: ServiceCategory[];
  readOnly: boolean;
}) {
  const [picker, setPicker] = useState<string | null | false>(false); // phase id destino, null = sin fase
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const setPhase = (id: string, patch: Partial<QuotePhaseDraft>, key?: string) =>
    update((d) => ({ ...d, phases: d.phases.map((p) => (p.id === id ? { ...p, ...patch } : p)) }), key ? `phase:${id}:${key}` : undefined);

  const setItem = (id: string, patch: Partial<QuoteItemDraft>, key?: string) =>
    update((d) => ({
      ...d,
      items: d.items.map((i) => {
        if (i.id !== id) return i;
        const touchesPrice = PRICE_FIELDS.some((f) => f in patch);
        const next = { ...i, ...patch };
        if (touchesPrice && i.price_status === "approved_rate" && !("price_status" in patch)) next.price_status = "manual_approved";
        return next;
      }),
    }), key ? `item:${id}:${key}` : undefined);

  const groups: { phase: QuotePhaseDraft | null; items: QuoteItemDraft[] }[] = [
    ...draft.phases.map((p) => ({ phase: p, items: draft.items.filter((i) => i.phase_id === p.id) })),
    { phase: null, items: draft.items.filter((i) => !i.phase_id || !draft.phases.some((p) => p.id === i.phase_id)) },
  ];

  function moveItem(id: string, dir: -1 | 1) {
    update((d) => {
      const item = d.items.find((i) => i.id === id)!;
      const sameGroup = d.items.filter((i) => i.phase_id === item.phase_id);
      const idx = sameGroup.indexOf(item);
      const swap = sameGroup[idx + dir];
      if (!swap) return d;
      const a = d.items.indexOf(item);
      const b = d.items.indexOf(swap);
      const items = [...d.items];
      [items[a], items[b]] = [items[b], items[a]];
      return { ...d, items };
    });
  }

  function addFromCatalog(service: ServiceWithRule, phaseId: string | null) {
    const item = itemFromService(service, { id: uid(), phaseId });
    update((d) => ({
      ...d,
      items: [...d.items, item],
      // Las exclusiones habituales del servicio se proponen, sin duplicar.
      exclusions: [...d.exclusions, ...service.default_exclusions.filter((e) => !d.exclusions.includes(e))],
    }));
    setOpen((o) => ({ ...o, [item.id]: true }));
  }

  function addManual(phaseId: string | null) {
    const item: QuoteItemDraft = {
      id: uid(),
      phase_id: phaseId,
      service_id: null,
      pricing_rule_id: null,
      name: "Nueva partida",
      description: "",
      unit: "ud.",
      method: "manual",
      quantity: 100,
      unit_price: null,
      hours: null,
      hourly_rate: null,
      addons: [],
      complexity_level: null,
      complexity_factor_bp: null,
      discount_bp: 0,
      vat_rate_bp: null,
      kind: "own",
      external_treatment: null,
      price_status: "pending_valuation",
      is_optional: false,
      optional_included: false,
      rule_snapshot: null,
    };
    update((d) => ({ ...d, items: [...d.items, item] }));
    setOpen((o) => ({ ...o, [item.id]: true }));
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ phase, items }, gi) => {
        if (!phase && items.length === 0 && draft.phases.length > 0) {
          return (
            <div key="nophase" className="flex gap-2">
              {!readOnly && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => update((d) => ({ ...d, phases: [...d.phases, { id: uid(), name: `Fase ${d.phases.length + 1}`, description: "", deliverables: [], timing: "" }] }))}
                >
                  <Plus size={14} /> Añadir fase
                </Button>
              )}
            </div>
          );
        }
        const phaseNet = items.reduce((a, i) => {
          const r = totals.lines[i.id];
          return r && (r.bucket === "own" || r.bucket === "resale" || r.bucket === "suplido") ? a + (r.net ?? 0) : a;
        }, 0);
        return (
          <section key={phase?.id ?? "nophase"} className="rounded-xl border border-line bg-card">
            <header className="flex flex-wrap items-start gap-3 border-b border-line p-4">
              {phase ? (
                <>
                  <span className="mt-1.5 font-mono text-xs font-bold text-muted">{String(gi + 1).padStart(2, "0")}</span>
                  <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-[1fr_160px]">
                    <TextInput
                      value={phase.name}
                      onChange={(v) => setPhase(phase.id, { name: v }, "name")}
                      disabled={readOnly}
                      className="font-semibold"
                      aria-label="Nombre de la fase"
                    />
                    <TextInput
                      value={phase.timing}
                      onChange={(v) => setPhase(phase.id, { timing: v }, "timing")}
                      disabled={readOnly}
                      placeholder="Meses 1–2"
                      aria-label="Calendario de la fase"
                    />
                    <TextArea
                      rows={2}
                      value={phase.description}
                      onChange={(v) => setPhase(phase.id, { description: v }, "desc")}
                      disabled={readOnly}
                      placeholder="Descripción breve de la fase"
                      className="md:col-span-2"
                    />
                    <div className="md:col-span-2">
                      <p className="mb-1 text-xs font-semibold text-muted">Entregables (uno por línea)</p>
                      <LinesInput
                        value={phase.deliverables}
                        onChange={(v) => setPhase(phase.id, { deliverables: v }, "deliv")}
                        disabled={readOnly}
                        rows={3}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="tabular text-sm font-bold">{formatEUR(phaseNet)}</span>
                    {!readOnly && (
                      <div className="flex">
                        <Button variant="ghost" size="sm" aria-label="Subir fase" onClick={() => update((d) => ({ ...d, phases: move(d.phases, d.phases.indexOf(phase), d.phases.indexOf(phase) - 1) }))}>
                          <ArrowUp size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" aria-label="Bajar fase" onClick={() => update((d) => ({ ...d, phases: move(d.phases, d.phases.indexOf(phase), d.phases.indexOf(phase) + 1) }))}>
                          <ArrowDown size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Eliminar fase"
                          onClick={() => {
                            if (!window.confirm("¿Eliminar la fase? Sus partidas pasarán a «Sin fase».")) return;
                            update((d) => ({
                              ...d,
                              phases: d.phases.filter((p) => p.id !== phase.id),
                              items: d.items.map((i) => (i.phase_id === phase.id ? { ...i, phase_id: null } : i)),
                            }));
                          }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex w-full items-center justify-between">
                  <p className="text-sm font-semibold">{draft.phases.length ? "Partidas sin fase" : "Partidas"}</p>
                  <span className="tabular text-sm font-bold">{formatEUR(phaseNet)}</span>
                </div>
              )}
            </header>

            <ul className="divide-y divide-line">
              {items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  result={totals.lines[item.id]}
                  phases={draft.phases}
                  open={!!open[item.id]}
                  toggle={() => setOpen((o) => ({ ...o, [item.id]: !o[item.id] }))}
                  set={(patch, key) => setItem(item.id, patch, key)}
                  readOnly={readOnly}
                  defaultVat={draft.vat_rate_bp}
                  onMove={(dir) => moveItem(item.id, dir)}
                  onDuplicate={() =>
                    update((d) => {
                      const idx = d.items.findIndex((i) => i.id === item.id);
                      const items = [...d.items];
                      items.splice(idx + 1, 0, { ...item, id: uid(), name: `${item.name} (copia)` });
                      return { ...d, items };
                    })
                  }
                  onDelete={() => update((d) => ({ ...d, items: d.items.filter((i) => i.id !== item.id) }))}
                />
              ))}
            </ul>

            {!readOnly && (
              <footer className="flex flex-wrap gap-2 border-t border-line p-3">
                <Button variant="secondary" size="sm" onClick={() => setPicker(phase?.id ?? null)}>
                  <Plus size={14} /> Del catálogo
                </Button>
                <Button variant="ghost" size="sm" onClick={() => addManual(phase?.id ?? null)}>
                  <Plus size={14} /> Partida manual
                </Button>
                {!phase && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => update((d) => ({ ...d, phases: [...d.phases, { id: uid(), name: `Fase ${d.phases.length + 1}`, description: "", deliverables: [], timing: "" }] }))}
                  >
                    <Plus size={14} /> Añadir fase
                  </Button>
                )}
              </footer>
            )}
          </section>
        );
      })}

      {picker !== false && (
        <CatalogPicker
          services={services}
          categories={categories}
          onClose={() => setPicker(false)}
          onPick={(s) => {
            addFromCatalog(s, picker);
          }}
        />
      )}
    </div>
  );
}

function ItemRow({
  item,
  result,
  phases,
  open,
  toggle,
  set,
  readOnly,
  defaultVat,
  onMove,
  onDuplicate,
  onDelete,
}: {
  item: QuoteItemDraft;
  result: QuoteTotals["lines"][string] | undefined;
  phases: QuotePhaseDraft[];
  open: boolean;
  toggle: () => void;
  set: (patch: Partial<QuoteItemDraft>, key?: string) => void;
  readOnly: boolean;
  defaultVat: number;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const levels = (item.rule_snapshot?.complexity as { levels?: { key: string; label: string; factor_bp: number }[] } | null)?.levels ?? [];
  const external = item.kind === "external";
  const excluded = item.is_optional && !item.optional_included;
  const informative = external && (item.external_treatment ?? "informative") === "informative";

  return (
    <li className={cx("px-4 py-3", item.price_status === "estimate_pending" && "bg-warn-soft/40", item.price_status === "pending_valuation" && "bg-danger-soft/30")}>
      <div className="flex items-center gap-2">
        <button onClick={toggle} className="text-muted hover:text-ink" aria-label={open ? "Contraer" : "Expandir"} aria-expanded={open}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <TextInput
          value={item.name}
          onChange={(v) => set({ name: v }, "name")}
          disabled={readOnly}
          className="flex-1 border-transparent font-medium hover:border-line-strong"
          aria-label="Nombre de la partida"
        />
        <div className="hidden flex-wrap gap-1 sm:flex">
          <PriceStatusBadge status={item.price_status} short />
          {item.is_optional ? <Badge tone="info">{item.optional_included ? "Opcional incluido" : "Opcional"}</Badge> : null}
          {external ? <Badge>{informative ? "Terceros · informativo" : item.external_treatment === "suplido" ? "Suplido" : "Terceros"}</Badge> : null}
        </div>
        <span className={cx("tabular w-28 text-right text-sm font-semibold", (excluded || informative) && "text-muted line-through decoration-muted/40")}>
          {result?.net == null ? "—" : formatEUR(result.net)}
        </span>
      </div>

      {open && (
        <div className="mt-3 grid gap-3 pl-6">
          <TextArea
            rows={2}
            value={item.description}
            onChange={(v) => set({ description: v }, "desc")}
            disabled={readOnly}
            placeholder="Descripción que verá el cliente"
          />

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <label className="text-xs text-muted">
              Método
              <SmallSelect value={item.method} onChange={(e) => set({ method: e.target.value as PricingMethod })} disabled={readOnly}>
                {PRICING_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PRICING_METHOD_LABEL[m]}
                  </option>
                ))}
              </SmallSelect>
            </label>

            {item.method === "hourly" ? (
              <>
                <label className="text-xs text-muted">
                  Horas
                  <ScaledInput value={item.hours} onChange={(v) => set({ hours: v }, "hours")} suffix="h" disabled={readOnly} ariaLabel="Horas" />
                </label>
                <label className="text-xs text-muted">
                  Tarifa
                  <ScaledInput value={item.hourly_rate} onChange={(v) => set({ hourly_rate: v }, "rate")} suffix="€/h" disabled={readOnly} ariaLabel="Tarifa horaria" />
                </label>
              </>
            ) : (
              <>
                <label className="text-xs text-muted">
                  Cantidad
                  <ScaledInput value={item.quantity} onChange={(v) => set({ quantity: v ?? 0 }, "qty")} allowNull={false} disabled={readOnly} ariaLabel="Cantidad" />
                </label>
                <label className="text-xs text-muted">
                  {item.method === "fixed" ? "Precio" : item.method === "base_plus_addons" || item.method === "complexity" ? "Precio base" : `Precio / ${item.unit}`}
                  <ScaledInput value={item.unit_price} onChange={(v) => set({ unit_price: v }, "price")} suffix="€" disabled={readOnly} ariaLabel="Precio" />
                </label>
              </>
            )}
            <label className="text-xs text-muted">
              Unidad
              <TextInput value={item.unit} onChange={(v) => set({ unit: v }, "unit")} disabled={readOnly} />
            </label>
          </div>

          {item.method === "complexity" && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <label className="text-xs text-muted md:col-span-2">
                Complejidad
                {levels.length ? (
                  <SmallSelect
                    value={item.complexity_level ?? ""}
                    disabled={readOnly}
                    onChange={(e) => {
                      const l = levels.find((x) => x.key === e.target.value);
                      if (l) set({ complexity_level: l.key, complexity_factor_bp: l.factor_bp });
                    }}
                  >
                    {levels.map((l) => (
                      <option key={l.key} value={l.key}>
                        {l.label} (×{(l.factor_bp / 10000).toLocaleString("es-ES")})
                      </option>
                    ))}
                  </SmallSelect>
                ) : (
                  <ScaledInput value={item.complexity_factor_bp} onChange={(v) => set({ complexity_factor_bp: v }, "cx")} scale={10000} decimals={2} suffix="×" disabled={readOnly} />
                )}
              </label>
            </div>
          )}

          {item.method === "base_plus_addons" && (
            <div className="rounded-lg bg-surface p-2">
              <p className="mb-1 text-xs font-semibold text-muted">Complementos</p>
              {item.addons.map((a, i) => (
                <div key={i} className="mb-1 grid grid-cols-[1fr_100px_80px_auto] gap-2">
                  <TextInput value={a.label} disabled={readOnly} onChange={(v) => set({ addons: item.addons.map((x, j) => (j === i ? { ...x, label: v } : x)) }, `addon${i}l`)} />
                  <ScaledInput value={a.price} disabled={readOnly} suffix="€" allowNull={false} onChange={(v) => set({ addons: item.addons.map((x, j) => (j === i ? { ...x, price: v ?? 0 } : x)) }, `addon${i}p`)} />
                  <ScaledInput value={a.qty} disabled={readOnly} allowNull={false} onChange={(v) => set({ addons: item.addons.map((x, j) => (j === i ? { ...x, qty: v ?? 0 } : x)) }, `addon${i}q`)} />
                  {!readOnly && (
                    <Button variant="ghost" size="sm" aria-label="Quitar complemento" onClick={() => set({ addons: item.addons.filter((_, j) => j !== i) })}>
                      <X size={14} />
                    </Button>
                  )}
                </div>
              ))}
              {!readOnly && (
                <Button variant="ghost" size="sm" onClick={() => set({ addons: [...item.addons, { label: "Complemento", price: 0, qty: 100 }] })}>
                  <Plus size={14} /> Complemento
                </Button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <label className="text-xs text-muted">
              Estado del precio
              <SmallSelect value={item.price_status} disabled={readOnly} onChange={(e) => set({ price_status: e.target.value as QuoteItemDraft["price_status"] })}>
                {PRICE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PRICE_STATUS_LABEL[s]}
                  </option>
                ))}
              </SmallSelect>
            </label>
            <label className="text-xs text-muted">
              Descuento
              <ScaledInput value={item.discount_bp} onChange={(v) => set({ discount_bp: Math.min(v ?? 0, 10000) }, "disc")} suffix="%" allowNull={false} disabled={readOnly} />
            </label>
            <label className="text-xs text-muted">
              IVA (vacío = {defaultVat / 100} %)
              <ScaledInput value={item.vat_rate_bp} onChange={(v) => set({ vat_rate_bp: v == null ? null : Math.min(v, 10000) }, "vat")} suffix="%" disabled={readOnly} />
            </label>
            <label className="text-xs text-muted">
              Fase
              <SmallSelect value={item.phase_id ?? ""} disabled={readOnly} onChange={(e) => set({ phase_id: e.target.value || null })}>
                <option value="">Sin fase</option>
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </SmallSelect>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={item.is_optional} disabled={readOnly} onChange={(e) => set({ is_optional: e.target.checked, optional_included: false })} /> Opcional
            </label>
            {item.is_optional && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={item.optional_included} disabled={readOnly} onChange={(e) => set({ optional_included: e.target.checked })} /> Sumar al total
              </label>
            )}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={external}
                disabled={readOnly}
                onChange={(e) => set({ kind: e.target.checked ? "external" : "own", external_treatment: e.target.checked ? "informative" : null })}
              />
              Coste de terceros
            </label>
            {external && (
              <SmallSelect
                value={item.external_treatment ?? "informative"}
                disabled={readOnly}
                className="w-auto"
                onChange={(e) => set({ external_treatment: e.target.value as QuoteItemDraft["external_treatment"] })}
                aria-label="Tratamiento fiscal"
              >
                {EXTERNAL_TREATMENTS.map((t) => (
                  <option key={t} value={t}>
                    {EXTERNAL_TREATMENT_LABEL[t]}
                  </option>
                ))}
              </SmallSelect>
            )}
          </div>

          {item.rule_snapshot ? (
            <p className="text-xs text-muted">
              Tarifa de catálogo v{String(item.rule_snapshot.version)} guardada con el presupuesto
              {item.price_status === "manual_approved" ? " · precio modificado a mano" : ""}.
            </p>
          ) : null}

          {!readOnly && (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => onMove(-1)} aria-label="Subir">
                <ArrowUp size={14} />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onMove(1)} aria-label="Bajar">
                <ArrowDown size={14} />
              </Button>
              <Button variant="ghost" size="sm" onClick={onDuplicate}>
                <Copy size={14} /> Duplicar
              </Button>
              <Button variant="ghost" size="sm" onClick={onDelete} className="!text-danger">
                <Trash2 size={14} /> Eliminar
              </Button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function CatalogPicker({
  services,
  categories,
  onClose,
  onPick,
}: {
  services: ServiceWithRule[];
  categories: ServiceCategory[];
  onClose: () => void;
  onPick: (s: ServiceWithRule) => void;
}) {
  const [q, setQ] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return services.filter((s) => s.active && (!t || s.name.toLowerCase().includes(t) || (s.commercial_description ?? "").toLowerCase().includes(t)));
  }, [q, services]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[8vh]" role="dialog" aria-modal aria-label="Añadir del catálogo">
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-card shadow-xl">
        <div className="flex items-center gap-2 border-b border-line p-3">
          <Search size={16} className="text-muted" />
          <input autoFocus className="flex-1 bg-transparent text-sm outline-none" placeholder="Buscar servicio…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </Button>
        </div>
        <div className="overflow-y-auto p-2">
          {categories.map((c) => {
            const list = filtered.filter((s) => s.category_id === c.id);
            if (!list.length) return null;
            return (
              <div key={c.id} className="mb-2">
                <p className="kicker px-2 py-1">{c.name}</p>
                {list.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      onPick(s);
                      setAdded((a) => [...a, s.id]);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface"
                  >
                    <span>
                      <span className="text-sm font-medium">{s.name}</span>
                      <span className="block text-xs text-muted">{s.rule ? describeRule(s.rule, s.unit) : "Sin tarifa · pendiente de valoración"}</span>
                    </span>
                    {added.includes(s.id) ? <Badge tone="lime">Añadido</Badge> : <Plus size={16} className="shrink-0 text-muted" />}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        <div className="border-t border-line p-3 text-right">
          <Button size="sm" onClick={onClose}>
            Hecho
          </Button>
        </div>
      </div>
    </div>
  );
}
