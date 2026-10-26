"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, CircleDashed, Copy, HelpCircle, X } from "lucide-react";
import { analyzeLeadPitch, convertLeadToQuote, deleteLead, saveLeadNotes, setCriterion, setLeadStatus, toggleTrigger } from "@/lib/actions/leads";
import type { CriterionResult } from "@/lib/leads/criteria";
import { Alert, Button, ButtonLink, Textarea, cx } from "@/components/ui";
import { useAnalyzeQueue } from "../use-analyze";

export function CriterionRow({ leadId, criterion, result }: { leadId: string; criterion: { id: string; label: string }; result: CriterionResult }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = (met: boolean | null) =>
    start(async () => {
      await setCriterion(leadId, criterion.id, met);
      router.refresh();
    });
  const icon =
    result.met === true ? (
      <Check size={15} className="text-lime-ink" />
    ) : result.met === false ? (
      <X size={15} className="text-danger" />
    ) : (
      <HelpCircle size={15} className="text-muted" />
    );
  return (
    <li className={cx("group flex items-start gap-2.5 py-2", pending && "opacity-50")}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className={cx("text-sm font-medium", result.met === null && "text-muted")}>
          {criterion.label}
          {result.source === "ai" ? <span className="ml-1.5 text-[10px] font-semibold text-info">IA</span> : null}
          {result.source === "manual" ? <span className="ml-1.5 text-[10px] font-semibold text-warn">a mano</span> : null}
        </p>
        <p className="text-xs text-muted">{result.evidence}</p>
      </div>
      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button title="Cumple" aria-label="Marcar que cumple" className="rounded p-1 hover:bg-surface" onClick={() => set(true)}>
          <Check size={13} />
        </button>
        <button title="No cumple" aria-label="Marcar que no cumple" className="rounded p-1 hover:bg-surface" onClick={() => set(false)}>
          <X size={13} />
        </button>
        <button title="Sin comprobar" aria-label="Marcar sin comprobar" className="rounded p-1 hover:bg-surface" onClick={() => set(null)}>
          <HelpCircle size={13} />
        </button>
      </div>
    </li>
  );
}

export function TriggerToggle({ leadId, id, label, on }: { leadId: string; id: string; label: string; on: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <li>
      <label className={cx("flex items-center gap-2 text-sm", pending && "opacity-50")}>
        <input
          type="checkbox"
          checked={on}
          disabled={pending}
          onChange={(e) =>
            start(async () => {
              await toggleTrigger(leadId, id, e.target.checked);
              router.refresh();
            })
          }
        />
        {label}
      </label>
    </li>
  );
}

export function CopyBlock({ text }: { text: string }) {
  const [value, setValue] = useState(text);
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={10} className="text-sm" aria-label="Mensaje" />
      <div className="mt-2 flex items-center gap-2">
        <Button
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          <Copy size={14} /> {copied ? "Copiado" : "Copiar mensaje"}
        </Button>
        <span className="text-xs text-muted">Puedes retocarlo aquí antes de copiar.</span>
      </div>
    </div>
  );
}

export function NotesBox({ id, initial }: { id: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(true);
  const [pending, start] = useTransition();
  return (
    <div>
      <Textarea
        rows={4}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        placeholder="Con quién hablasteis, qué os dijeron, cuándo volver a llamar…"
      />
      <Button size="sm" variant="secondary" className="mt-2" disabled={saved || pending} onClick={() => start(async () => void ((await saveLeadNotes(id, value)).ok && setSaved(true)))}>
        {saved ? "Guardado" : "Guardar notas"}
      </Button>
    </div>
  );
}

export function ReanalyzeButton({ id, name, label, pitchOnly }: { id: string; name: string; label: string; pitchOnly?: boolean }) {
  const queue = useAnalyzeQueue();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const busy = queue.state.running || pending;
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={pitchOnly ? "secondary" : "lime"}
        disabled={busy}
        onClick={() => {
          setError(null);
          if (pitchOnly) {
            start(async () => {
              const r = await analyzeLeadPitch(id);
              if (!r.ok) setError(r.error);
              router.refresh();
            });
          } else void queue.run([{ id, name }]);
        }}
      >
        {busy ? (
          <>
            <CircleDashed size={14} className="animate-spin" /> {queue.state.current?.split(" · ")[1] ?? "Analizando"}…
          </>
        ) : (
          label
        )}
      </Button>
      {error || queue.state.errors[0] ? <span className="text-xs text-danger">{error ?? queue.state.errors[0]}</span> : null}
    </span>
  );
}

export function LeadActions({ id, status, quoteId, hasOffers }: { id: string; status: string; quoteId: string | null; hasOffers: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const change = (s: string, reason?: string) =>
    start(async () => {
      const r = await setLeadStatus(id, s, reason);
      if (!r.ok) setError(r.error);
      router.refresh();
    });

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {quoteId ? (
          <ButtonLink href={`/presupuestos/${quoteId}`} variant="lime" size="sm">
            Ver presupuesto
          </ButtonLink>
        ) : (
          <Button
            size="sm"
            variant="lime"
            disabled={pending || !hasOffers}
            title={hasOffers ? undefined : "Analiza el lead para tener productos que ofrecer"}
            onClick={() =>
              start(async () => {
                const r = await convertLeadToQuote(id);
                if (r && !r.ok) setError(r.error);
              })
            }
          >
            Crear presupuesto
          </Button>
        )}
        {status !== "contacted" && status !== "converted" ? (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => change("contacted")}>
            Marcar contactado
          </Button>
        ) : null}
        {status === "contacted" ? (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => change("replied")}>
            Ha respondido
          </Button>
        ) : null}
        {status !== "discarded" ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              const reason = window.prompt("¿Por qué lo descartas? (franquicia, no encaja, ya tiene agencia…)");
              if (reason !== null) change("discarded", reason);
            }}
          >
            Descartar
          </Button>
        ) : (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => change("analyzed")}>
            Recuperar
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="!text-danger"
          disabled={pending}
          onClick={() => {
            if (window.confirm("¿Eliminar este lead? No se puede deshacer."))
              start(async () => {
                const r = await deleteLead(id);
                if (r && !r.ok) setError(r.error);
              });
          }}
        >
          Eliminar
        </Button>
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {status === "converted" && quoteId ? (
        <Link href={`/presupuestos/${quoteId}`} className="text-xs underline">
          Presupuesto creado desde este lead
        </Link>
      ) : null}
    </div>
  );
}
