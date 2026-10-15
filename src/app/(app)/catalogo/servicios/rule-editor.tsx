"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { savePricingRule } from "@/lib/actions/catalog";
import type { PricingRule } from "@/lib/data/types";
import { PRICE_STATUSES, PRICE_STATUS_LABEL, PRICING_METHODS, PRICING_METHOD_LABEL, type PricingMethod, type PriceStatus } from "@/lib/domain/schemas";
import { Alert, Button, Field, Input, Select } from "@/components/ui";

const toEur = (c: number | null | undefined) => (c == null ? "" : String(c / 100));

type Level = { key: string; label: string; factor: string };
type Addon = { label: string; price: string; qty: string };

export function RuleEditor({ serviceId, rule, unit }: { serviceId: string; rule: PricingRule | null; unit: string }) {
  const [method, setMethod] = useState<PricingMethod>(rule?.method ?? "fixed");
  const [unitPrice, setUnitPrice] = useState(toEur(rule?.unit_price_cents));
  const [qty, setQty] = useState(toEur(rule?.default_quantity ?? 100));
  const [rate, setRate] = useState(toEur(rule?.hourly_rate_cents));
  const [hours, setHours] = useState(toEur(rule?.estimated_hours));
  const [status, setStatus] = useState<PriceStatus>(rule?.default_price_status ?? "approved_rate");
  const [notes, setNotes] = useState(rule?.notes ?? "");
  const [addons, setAddons] = useState<Addon[]>(
    (rule?.addons ?? []).map((a) => ({ label: a.label, price: toEur(a.price), qty: toEur(a.qty) })),
  );
  const [levels, setLevels] = useState<Level[]>(
    rule?.complexity?.levels.map((l) => ({ key: l.key, label: l.label, factor: String(l.factor_bp / 10000) })) ?? [
      { key: "simple", label: "Sencillo", factor: "0.8" },
      { key: "medium", label: "Estándar", factor: "1" },
      { key: "high", label: "Complejo", factor: "1.5" },
    ],
  );
  const [defaultLevel, setDefaultLevel] = useState(rule?.complexity?.default_level ?? "medium");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const needsPrice = ["fixed", "per_unit", "base_plus_addons", "complexity", "manual", "external"].includes(method);

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await savePricingRule(serviceId, {
        method,
        unit_price_cents: needsPrice ? unitPrice : "",
        hourly_rate_cents: method === "hourly" ? rate : "",
        estimated_hours: method === "hourly" ? hours : "",
        default_quantity: qty || "1",
        default_price_status: status,
        notes: notes || null,
        addons:
          method === "base_plus_addons"
            ? addons.filter((a) => a.label).map((a) => ({ label: a.label, price: Math.round(Number(a.price.replace(",", ".")) * 100), qty: Math.round(Number(a.qty.replace(",", ".") || "0") * 100) }))
            : [],
        complexity:
          method === "complexity"
            ? {
                levels: levels.filter((l) => l.key && l.label).map((l) => ({ key: l.key, label: l.label, factor_bp: Math.round(Number(l.factor.replace(",", ".")) * 10000) })),
                default_level: defaultLevel,
              }
            : null,
      });
      setMsg(r.ok ? { ok: true, text: `Guardada la versión ${r.data.version}.` } : { ok: false, text: r.error });
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Método de cálculo">
          <Select value={method} onChange={(e) => setMethod(e.target.value as PricingMethod)}>
            {PRICING_METHODS.map((m) => (
              <option key={m} value={m}>
                {PRICING_METHOD_LABEL[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Estado con el que entra al presupuesto" hint="Una estimación se marca y bloquea el cierre hasta aprobarla.">
          <Select value={status} onChange={(e) => setStatus(e.target.value as PriceStatus)}>
            {PRICE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PRICE_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {needsPrice ? (
          <Field
            label={
              method === "per_unit" || method === "external"
                ? `Precio por ${unit} (€)`
                : method === "fixed"
                  ? "Precio fijo (€)"
                  : "Precio base (€)"
            }
            hint={method === "external" ? "Déjalo vacío si es «a determinar»." : undefined}
          >
            <Input inputMode="decimal" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
          </Field>
        ) : null}
        {method === "hourly" ? (
          <>
            <Field label="Tarifa horaria (€/h)">
              <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
            </Field>
            <Field label="Horas estimadas">
              <Input inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} />
            </Field>
          </>
        ) : (
          <Field label="Cantidad por defecto">
            <Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
          </Field>
        )}
      </div>

      {method === "base_plus_addons" ? (
        <div>
          <p className="mb-2 text-[13px] font-semibold text-ink-3">Complementos</p>
          {addons.map((a, i) => (
            <div key={i} className="mb-2 grid grid-cols-[1fr_110px_90px_auto] gap-2">
              <Input placeholder="Complemento" value={a.label} onChange={(e) => setAddons(addons.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <Input placeholder="€" inputMode="decimal" value={a.price} onChange={(e) => setAddons(addons.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
              <Input placeholder="Cant." inputMode="decimal" value={a.qty} onChange={(e) => setAddons(addons.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
              <Button variant="ghost" size="sm" onClick={() => setAddons(addons.filter((_, j) => j !== i))} aria-label="Quitar">
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={() => setAddons([...addons, { label: "", price: "", qty: "1" }])}>
            <Plus size={14} /> Complemento
          </Button>
        </div>
      ) : null}

      {method === "complexity" ? (
        <div>
          <p className="mb-2 text-[13px] font-semibold text-ink-3">Niveles de complejidad (multiplicador sobre el precio base)</p>
          {levels.map((l, i) => (
            <div key={i} className="mb-2 grid grid-cols-[110px_1fr_90px_auto_auto] items-center gap-2">
              <Input placeholder="clave" value={l.key} onChange={(e) => setLevels(levels.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
              <Input placeholder="Etiqueta" value={l.label} onChange={(e) => setLevels(levels.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <Input placeholder="x1" inputMode="decimal" value={l.factor} onChange={(e) => setLevels(levels.map((x, j) => (j === i ? { ...x, factor: e.target.value } : x)))} />
              <label className="flex items-center gap-1 text-xs">
                <input type="radio" name="default_level" checked={defaultLevel === l.key} onChange={() => setDefaultLevel(l.key)} /> por defecto
              </label>
              <Button variant="ghost" size="sm" onClick={() => setLevels(levels.filter((_, j) => j !== i))} aria-label="Quitar">
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={() => setLevels([...levels, { key: "", label: "", factor: "1" }])}>
            <Plus size={14} /> Nivel
          </Button>
        </div>
      ) : null}

      <Field label="Notas de la tarifa">
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Guardando…" : rule ? "Guardar como nueva versión" : "Crear tarifa"}
        </Button>
        {msg ? <Alert tone={msg.ok ? "lime" : "danger"}>{msg.text}</Alert> : null}
      </div>
    </div>
  );
}
