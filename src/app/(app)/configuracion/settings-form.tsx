"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveSettings } from "@/lib/actions/settings";
import type { StudioSettings } from "@/lib/data/types";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";

export function SettingsForm({ settings, aiKeyConfigured }: { settings: StudioSettings; aiKeyConfigured: boolean }) {
  const [s, setS] = useState({
    ...settings,
    vat: String(settings.default_vat_rate_bp / 100),
    payments: settings.default_payments.map((p) => ({ label: p.label, milestone: p.milestone ?? "", pct: String((p.percent_bp ?? 0) / 100) })),
    exclusionsText: settings.default_exclusions.join("\n"),
    accent: settings.pdf_preferences.accent ?? "#B4E600",
    show_cover: settings.pdf_preferences.show_cover ?? true,
    show_closing: settings.pdf_preferences.show_closing ?? true,
  });
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => setS((prev) => ({ ...prev, [k]: v }));
  const text = (k: keyof StudioSettings) => ({
    value: (s[k] as string | null) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k as keyof typeof s, e.target.value as never),
  });

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await saveSettings({
        product_name: s.product_name,
        trade_name: s.trade_name,
        tagline: s.tagline,
        legal_name: s.legal_name ?? "",
        tax_id: s.tax_id ?? "",
        address_line: s.address_line ?? "",
        postal_code: s.postal_code ?? "",
        city: s.city ?? "",
        province: s.province ?? "",
        phone: s.phone ?? "",
        email: s.email ?? "",
        website: s.website ?? "",
        quote_prefix: s.quote_prefix,
        default_vat_rate_bp: s.vat,
        default_validity_days: s.default_validity_days,
        default_payment_mode: s.default_payment_mode,
        default_payment_terms: s.default_payment_terms,
        closing_text: s.closing_text,
        ai_enabled: s.ai_enabled,
        ai_model_interview: s.ai_model_interview,
        ai_model_drafting: s.ai_model_drafting,
        archive_pdfs: s.archive_pdfs,
        default_payments: s.payments
          .filter((p) => p.label)
          .map((p) => ({ label: p.label, milestone: p.milestone, percent_bp: Math.round(Number(p.pct.replace(",", ".")) * 100) })),
        default_conditions: s.default_conditions.filter((c) => c.title && c.text),
        default_exclusions: s.exclusionsText.split("\n").map((x) => x.trim()).filter(Boolean),
        pdf_preferences: { accent: s.accent, show_cover: s.show_cover, show_closing: s.show_closing },
      });
      setMsg(r.ok ? { ok: true, text: "Configuración guardada." } : { ok: false, text: r.error });
    });
  }

  return (
    <div className="grid gap-6">
      <Card className="p-6">
        <h2 className="kicker mb-4">Datos comerciales</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre del producto" hint="Aparece en la barra lateral.">
            <Input {...text("product_name")} />
          </Field>
          <Field label="Nombre comercial">
            <Input {...text("trade_name")} />
          </Field>
          <Field label="Lema">
            <Input {...text("tagline")} />
          </Field>
          <Field label="Razón social" hint="Para el pie del documento.">
            <Input {...text("legal_name")} />
          </Field>
          <Field label="NIF">
            <Input {...text("tax_id")} />
          </Field>
          <Field label="Dirección">
            <Input {...text("address_line")} />
          </Field>
          <div className="grid grid-cols-3 gap-3 md:col-span-2">
            <Field label="C. P.">
              <Input {...text("postal_code")} />
            </Field>
            <Field label="Localidad">
              <Input {...text("city")} />
            </Field>
            <Field label="Provincia">
              <Input {...text("province")} />
            </Field>
          </div>
          <Field label="Teléfono">
            <Input {...text("phone")} />
          </Field>
          <Field label="Email">
            <Input {...text("email")} />
          </Field>
          <Field label="Web">
            <Input {...text("website")} />
          </Field>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="kicker mb-4">Presupuestos</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Prefijo de numeración" hint={`${s.quote_prefix}-2026-001`}>
            <Input value={s.quote_prefix} onChange={(e) => set("quote_prefix", e.target.value.toUpperCase())} maxLength={6} />
          </Field>
          <Field label="IVA por defecto (%)">
            <Input inputMode="decimal" value={s.vat} onChange={(e) => set("vat", e.target.value)} />
          </Field>
          <Field label="Validez (días)">
            <Input type="number" min={1} max={365} value={s.default_validity_days} onChange={(e) => set("default_validity_days", Number(e.target.value))} />
          </Field>
          <Field label="Pagos por defecto">
            <Select value={s.default_payment_mode} onChange={(e) => set("default_payment_mode", e.target.value as "percent" | "fixed")}>
              <option value="percent">Por porcentajes</option>
              <option value="fixed">Por importes</option>
            </Select>
          </Field>
        </div>

        <p className="mt-6 mb-2 text-[13px] font-semibold text-ink-3">Calendario de pagos por defecto</p>
        {s.payments.map((p, i) => (
          <div key={i} className="mb-2 grid grid-cols-[1fr_1.5fr_90px_auto] gap-2">
            <Input placeholder="Pago" value={p.label} onChange={(e) => set("payments", s.payments.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <Input placeholder="Hito" value={p.milestone} onChange={(e) => set("payments", s.payments.map((x, j) => (j === i ? { ...x, milestone: e.target.value } : x)))} />
            <Input placeholder="%" inputMode="decimal" value={p.pct} onChange={(e) => set("payments", s.payments.map((x, j) => (j === i ? { ...x, pct: e.target.value } : x)))} />
            <Button variant="ghost" size="sm" onClick={() => set("payments", s.payments.filter((_, j) => j !== i))} aria-label="Quitar pago">
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={() => set("payments", [...s.payments, { label: "", milestone: "", pct: "0" }])}>
          <Plus size={14} /> Pago
        </Button>

        <div className="mt-6 grid gap-4">
          <Field label="Cómo se paga">
            <Textarea {...text("default_payment_terms")} rows={2} />
          </Field>
          <div>
            <p className="mb-2 text-[13px] font-semibold text-ink-3">Condiciones por defecto</p>
            {s.default_conditions.map((c, i) => (
              <div key={i} className="mb-2 grid grid-cols-[180px_1fr_auto] gap-2">
                <Input value={c.title} onChange={(e) => set("default_conditions", s.default_conditions.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <Textarea rows={2} value={c.text} onChange={(e) => set("default_conditions", s.default_conditions.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                <Button variant="ghost" size="sm" onClick={() => set("default_conditions", s.default_conditions.filter((_, j) => j !== i))} aria-label="Quitar">
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => set("default_conditions", [...s.default_conditions, { title: "", text: "" }])}>
              <Plus size={14} /> Condición
            </Button>
          </div>
          <Field label="Exclusiones por defecto" hint="Una por línea.">
            <Textarea value={s.exclusionsText} onChange={(e) => set("exclusionsText", e.target.value)} rows={3} />
          </Field>
          <Field label="Texto de cierre">
            <Input {...text("closing_text")} />
          </Field>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="kicker mb-4">Documento PDF</h2>
        <div className="flex flex-wrap items-end gap-6">
          <Field label="Color de acento">
            <div className="flex items-center gap-2">
              <input type="color" value={s.accent} onChange={(e) => set("accent", e.target.value.toUpperCase())} className="h-10 w-14 rounded border border-line-strong" />
              <Input value={s.accent} onChange={(e) => set("accent", e.target.value)} className="w-28 font-mono" />
            </div>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s.show_cover} onChange={(e) => set("show_cover", e.target.checked)} /> Portada
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s.show_closing} onChange={(e) => set("show_closing", e.target.checked)} /> Página de cierre
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s.archive_pdfs} onChange={(e) => set("archive_pdfs", e.target.checked)} /> Archivar copia de cada PDF descargado
          </label>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="kicker mb-4">Asistente de IA</h2>
        {!aiKeyConfigured ? (
          <div className="mb-4">
            <Alert tone="warn" title="Falta ANTHROPIC_API_KEY">
              La entrevista funciona en modo guiado (sin IA) hasta que se configure la variable de entorno en el servidor.
            </Alert>
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex items-center gap-2 text-sm md:col-span-3">
            <input type="checkbox" checked={s.ai_enabled} onChange={(e) => set("ai_enabled", e.target.checked)} /> Usar IA en la entrevista y la redacción
          </label>
          <Field label="Proveedor">
            <Input value="Anthropic (Claude)" disabled />
          </Field>
          <Field label="Modelo de entrevista">
            <Input {...text("ai_model_interview")} />
          </Field>
          <Field label="Modelo de redacción">
            <Input {...text("ai_model_drafting")} />
          </Field>
        </div>
        <p className="mt-3 text-xs text-muted">La clave de API nunca se guarda en la base de datos: solo como variable de entorno del servidor.</p>
      </Card>

      <div className="sticky bottom-4 flex items-center gap-3">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Guardando…" : "Guardar configuración"}
        </Button>
        {msg ? <Alert tone={msg.ok ? "lime" : "danger"}>{msg.text}</Alert> : null}
      </div>
    </div>
  );
}
