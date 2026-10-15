"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2, X } from "lucide-react";
import type { QuoteDraft, QuoteSectionDraft } from "@/lib/domain/quote";
import { DATA_DRIVEN_SECTIONS, SECTION_TYPES, SECTION_TYPE_LABEL, type SectionContent, type SectionType } from "@/lib/domain/schemas";
import { makeSection } from "@/lib/domain/templates";
import { Alert, Button, cx } from "@/components/ui";
import { LinesInput, SmallSelect, TextArea, TextInput } from "./inputs";
import type { Updater } from "./use-draft";

const DATA_HINT: Partial<Record<SectionType, string>> = {
  cover: "La portada se compone con el título, el subtítulo, el cliente y la fecha (pestaña Datos).",
  phases: "Las fases, sus entregables y partidas se editan en la pestaña Partidas. Aquí puedes añadir una introducción.",
  investment: "El desglose y los totales salen del motor de precios. Aquí puedes añadir una introducción o nota.",
  payment: "El calendario de pagos se edita en la pestaña Pagos y condiciones.",
  exclusions: "Las exclusiones y los costes de terceros salen de la pestaña Pagos y condiciones y de las partidas de terceros.",
};

export function SectionList({
  draft,
  update,
  selected,
  onSelect,
  readOnly,
}: {
  draft: QuoteDraft;
  update: (fn: Updater, key?: string) => void;
  selected: string | null;
  onSelect: (id: string) => void;
  readOnly: boolean;
}) {
  const move = (idx: number, dir: -1 | 1) =>
    update((d) => {
      const to = idx + dir;
      if (to < 0 || to >= d.sections.length) return d;
      const s = [...d.sections];
      [s[idx], s[to]] = [s[to], s[idx]];
      return { ...d, sections: s };
    });

  return (
    <div>
      <ol className="flex flex-col gap-0.5">
        {draft.sections.map((s, i) => (
          <li key={s.id} className="group flex items-center gap-1">
            <button
              onClick={() => onSelect(s.id)}
              className={cx(
                "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]",
                selected === s.id ? "bg-ink text-white" : "hover:bg-surface",
                !s.visible && "opacity-50",
              )}
            >
              <span className={cx("font-mono text-[10px]", selected === s.id ? "text-lime" : "text-muted")}>{String(i + 1).padStart(2, "0")}</span>
              <span className="truncate">{s.title || SECTION_TYPE_LABEL[s.type]}</span>
            </button>
            {!readOnly && (
              <span className="flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <button className="p-1 text-muted hover:text-ink" onClick={() => move(i, -1)} aria-label="Subir sección">
                  <ArrowUp size={12} />
                </button>
                <button className="p-1 text-muted hover:text-ink" onClick={() => move(i, 1)} aria-label="Bajar sección">
                  <ArrowDown size={12} />
                </button>
                <button
                  className="p-1 text-muted hover:text-ink"
                  onClick={() => update((d) => ({ ...d, sections: d.sections.map((x) => (x.id === s.id ? { ...x, visible: !x.visible } : x)) }))}
                  aria-label={s.visible ? "Ocultar sección" : "Mostrar sección"}
                >
                  {s.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {!readOnly && (
        <SmallSelect
          className="mt-2"
          value=""
          aria-label="Añadir sección"
          onChange={(e) => {
            const type = e.target.value as SectionType;
            if (!type) return;
            const sec = makeSection(type, crypto.randomUUID());
            update((d) => {
              // Se inserta antes de la inversión si existe, para mantener un orden lógico.
              const inv = d.sections.findIndex((x) => x.type === "investment");
              const sections = [...d.sections];
              sections.splice(inv >= 0 && type !== "closing" ? inv : sections.length, 0, sec);
              return { ...d, sections };
            });
            onSelect(sec.id);
          }}
        >
          <option value="">+ Añadir sección…</option>
          {SECTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {SECTION_TYPE_LABEL[t]}
            </option>
          ))}
        </SmallSelect>
      )}
    </div>
  );
}

export function SectionEditor({
  section,
  update,
  readOnly,
  onDeleted,
}: {
  section: QuoteSectionDraft;
  update: (fn: Updater, key?: string) => void;
  readOnly: boolean;
  onDeleted: () => void;
}) {
  const set = (patch: Partial<QuoteSectionDraft>, key?: string) =>
    update((d) => ({ ...d, sections: d.sections.map((s) => (s.id === section.id ? { ...s, ...patch } : s)) }), key ? `sec:${section.id}:${key}` : undefined);
  const setContent = (patch: Partial<SectionContent>, key: string) => set({ content: { ...section.content, ...patch } }, key);
  const c = section.content;
  const dataDriven = DATA_DRIVEN_SECTIONS.has(section.type);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="kicker">{SECTION_TYPE_LABEL[section.type]}</p>
          {!section.visible ? <p className="mt-1 text-xs text-warn">Oculta: no aparecerá en el PDF.</p> : null}
        </div>
        {!readOnly && (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => set({ visible: !section.visible })}>
              {section.visible ? <EyeOff size={14} /> : <Eye size={14} />} {section.visible ? "Ocultar" : "Mostrar"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="!text-danger"
              onClick={() => {
                if (!window.confirm("¿Eliminar esta sección?")) return;
                update((d) => ({ ...d, sections: d.sections.filter((s) => s.id !== section.id) }));
                onDeleted();
              }}
            >
              <Trash2 size={14} /> Eliminar
            </Button>
          </div>
        )}
      </div>

      {DATA_HINT[section.type] ? <Alert tone="info">{DATA_HINT[section.type]}</Alert> : null}

      {section.type !== "cover" && (
        <>
          <label className="text-xs font-semibold text-muted">
            Antetítulo
            <TextInput value={c.kicker ?? ""} onChange={(v) => setContent({ kicker: v }, "kicker")} disabled={readOnly} placeholder="PUNTO DE PARTIDA" />
          </label>
          <label className="text-xs font-semibold text-muted">
            Título
            <TextInput value={section.title} onChange={(v) => set({ title: v }, "title")} disabled={readOnly} className="h-11 text-lg font-bold" />
          </label>
          <label className="text-xs font-semibold text-muted">
            {dataDriven ? "Introducción (opcional)" : "Texto"}
            <TextArea
              rows={dataDriven ? 3 : 8}
              value={c.body ?? ""}
              onChange={(v) => setContent({ body: v }, "body")}
              disabled={readOnly}
              placeholder="Separa los párrafos con una línea en blanco."
            />
          </label>
          {!dataDriven && section.type !== "closing" && (
            <>
              <label className="text-xs font-semibold text-muted">
                Lista de puntos (uno por línea)
                <LinesInput value={c.bullets ?? []} onChange={(v) => setContent({ bullets: v }, "bullets")} disabled={readOnly} rows={4} />
              </label>
              <div>
                <p className="mb-1 text-xs font-semibold text-muted">Tarjetas destacadas</p>
                {(c.cards ?? []).map((card, i) => (
                  <div key={i} className="mb-2 grid gap-2 rounded-lg bg-surface p-2 md:grid-cols-[200px_1fr_auto]">
                    <TextInput
                      value={card.title}
                      placeholder="Título"
                      disabled={readOnly}
                      onChange={(v) => setContent({ cards: (c.cards ?? []).map((x, j) => (j === i ? { ...x, title: v } : x)) }, `card${i}t`)}
                    />
                    <TextArea
                      rows={2}
                      value={card.text}
                      disabled={readOnly}
                      onChange={(v) => setContent({ cards: (c.cards ?? []).map((x, j) => (j === i ? { ...x, text: v } : x)) }, `card${i}x`)}
                    />
                    {!readOnly && (
                      <Button variant="ghost" size="sm" aria-label="Quitar tarjeta" onClick={() => setContent({ cards: (c.cards ?? []).filter((_, j) => j !== i) }, "cards")}>
                        <X size={14} />
                      </Button>
                    )}
                  </div>
                ))}
                {!readOnly && (c.cards ?? []).length < 12 && (
                  <Button variant="secondary" size="sm" onClick={() => setContent({ cards: [...(c.cards ?? []), { title: "", text: "" }] }, "cards")}>
                    <Plus size={14} /> Tarjeta
                  </Button>
                )}
              </div>
            </>
          )}
          <label className="text-xs font-semibold text-muted">
            Nota al pie (cursiva)
            <TextInput value={c.note ?? ""} onChange={(v) => setContent({ note: v }, "note")} disabled={readOnly} />
          </label>
        </>
      )}
    </div>
  );
}
