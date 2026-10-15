"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Download, Eye, FileStack, MoreHorizontal, Redo2, Save, Undo2, X } from "lucide-react";
import { computeDraft, validateForFinalize, addDays, formatDateES, type QuoteDraft } from "@/lib/domain/quote";
import type { Client, ServiceCategory, ServiceWithRule } from "@/lib/data/types";
import { saveQuote, setQuoteStatus, newQuoteVersion, duplicateQuote, deleteDraftQuote } from "@/lib/actions/quotes";
import { createClientQuick } from "@/lib/actions/clients";
import { Alert, Badge, Button, buttonClass, cx } from "@/components/ui";
import { QuoteStatusBadge } from "@/components/status";
import { useDraft } from "./use-draft";
import { ItemsEditor } from "./items-editor";
import { SectionEditor, SectionList } from "./sections-editor";
import { PaymentsEditor } from "./payments-editor";
import { SummaryPanel } from "./summary-panel";
import { ScaledInput, SmallSelect, TextInput } from "./inputs";

type Doc = { id: string; doc_version: number; file_name: string; created_at: string; total_cents: number; quote_version: number };
type ClientLite = Pick<Client, "id" | "trade_name" | "legal_name" | "tax_id" | "address_line" | "city">;

const AUTOSAVE_MS = 20000;

export function QuoteEditor({
  initial,
  clients: initialClients,
  services,
  categories,
  documents,
  fromInterview,
}: {
  initial: QuoteDraft;
  clients: ClientLite[];
  services: ServiceWithRule[];
  categories: ServiceCategory[];
  documents: Doc[];
  fromInterview: string | null;
}) {
  const router = useRouter();
  const { draft, update, undo, redo, canUndo, canRedo, dirty, markSaved } = useDraft(initial);
  const [clients, setClients] = useState(initialClients);
  const [tab, setTab] = useState<"sections" | "items" | "payments">("items");
  const [mobilePane, setMobilePane] = useState<"data" | "editor" | "summary">("editor");
  const [selectedSection, setSelectedSection] = useState<string | null>(initial.sections[1]?.id ?? initial.sections[0]?.id ?? null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ tone: "danger" | "lime"; text: string; list?: string[] } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [pending, start] = useTransition();
  const readOnly = draft.status !== "draft";

  const { totals, schedule } = useMemo(() => computeDraft(draft), [draft]);
  const client = clients.find((c) => c.id === draft.client_id) ?? null;
  const problems = useMemo(
    () =>
      validateForFinalize(draft, client ? { trade_name: client.trade_name, legal_name: client.legal_name, tax_id: client.tax_id, address_line: client.address_line, city: client.city } : null),
    [draft, client],
  );

  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const save = useCallback(async (): Promise<boolean> => {
    if (readOnly) return true;
    const snapshot = draftRef.current;
    setSaving(true);
    setSaveError(null);
    const r = await saveQuote(snapshot);
    setSaving(false);
    if (!r.ok) {
      setSaveError(r.error);
      return false;
    }
    markSaved(snapshot);
    setSavedAt(new Date(r.data.savedAt));
    return true;
  }, [markSaved, readOnly]);

  // Autoguardado tras un rato sin cambios.
  useEffect(() => {
    if (!dirty || readOnly) return;
    const t = setTimeout(() => void save(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [draft, dirty, readOnly, save]);

  // Aviso al salir con cambios sin guardar.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  // Atajos: Ctrl/Cmd+S guarda; Ctrl/Cmd+Z deshace fuera de campos de texto.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "s") {
        e.preventDefault();
        void save();
        return;
      }
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [save, undo, redo]);

  async function openPreview() {
    if (dirty && !(await save())) return;
    setPreview(`/api/quotes/${draft.id}/pdf?mode=preview&t=${Date.now()}`);
  }

  async function download() {
    if (dirty && !(await save())) return;
    if (problems.length) {
      setStatusMsg({ tone: "danger", text: "Resuelve lo pendiente antes de descargar el PDF definitivo.", list: problems.map((p) => p.message) });
      return;
    }
    window.open(`/api/quotes/${draft.id}/pdf?mode=download`, "_self");
    setTimeout(() => router.refresh(), 2500);
  }

  function changeStatus(next: string) {
    setMenu(false);
    start(async () => {
      if (dirty && !(await save())) return;
      const r = await setQuoteStatus(draft.id, next);
      if (!r.ok) setStatusMsg({ tone: "danger", text: r.error });
      else if (r.data.problems.length)
        setStatusMsg({ tone: "danger", text: "No se puede marcar como definitivo todavía:", list: r.data.problems.map((p) => p.message) });
      else {
        setStatusMsg({ tone: "lime", text: "Estado actualizado." });
        router.refresh();
      }
    });
  }

  const section = draft.sections.find((s) => s.id === selectedSection) ?? null;
  const validUntil = addDays(draft.issue_date, draft.validity_days);

  const dataPanel = (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <p className="kicker">Datos del proyecto</p>
        <label className="text-xs font-semibold text-muted">
          Cliente
          <div className="flex gap-1">
            <SmallSelect value={draft.client_id ?? ""} disabled={readOnly} onChange={(e) => update((d) => ({ ...d, client_id: e.target.value || null }))}>
              <option value="">— Sin cliente —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.trade_name}
                </option>
              ))}
            </SmallSelect>
            {!readOnly && (
              <Button
                size="sm"
                variant="secondary"
                className="!h-9"
                onClick={async () => {
                  const name = window.prompt("Nombre comercial del nuevo cliente");
                  if (!name?.trim()) return;
                  const r = await createClientQuick({ trade_name: name.trim() });
                  if (r.ok) {
                    setClients((cs) => [...cs, { id: r.data.id, trade_name: name.trim(), legal_name: null, tax_id: null, address_line: null, city: null }]);
                    update((d) => ({ ...d, client_id: r.data.id }));
                  } else setStatusMsg({ tone: "danger", text: r.error });
                }}
              >
                Nuevo
              </Button>
            )}
          </div>
          {client ? (
            <Link href={`/clientes/${client.id}`} target="_blank" className="mt-1 inline-block text-[11px] font-normal underline">
              Editar datos fiscales
            </Link>
          ) : null}
        </label>
        <label className="text-xs font-semibold text-muted">
          Título
          <TextInput value={draft.title} onChange={(v) => update((d) => ({ ...d, title: v }), "title")} disabled={readOnly} placeholder="Nueva web Ortopedia…" />
        </label>
        <label className="text-xs font-semibold text-muted">
          Subtítulo
          <TextInput value={draft.subtitle} onChange={(v) => update((d) => ({ ...d, subtitle: v }), "subtitle")} disabled={readOnly} placeholder="Diseño y desarrollo · 2 idiomas…" />
        </label>
        <label className="text-xs font-semibold text-muted">
          Dirigido a
          <TextInput value={draft.addressee} onChange={(v) => update((d) => ({ ...d, addressee: v }), "addressee")} disabled={readOnly} placeholder="Nombre de las personas" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-muted">
            Fecha
            <input
              type="date"
              value={draft.issue_date}
              disabled={readOnly}
              onChange={(e) => e.target.value && update((d) => ({ ...d, issue_date: e.target.value }))}
              className="h-9 w-full rounded-md border border-line-strong bg-card px-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-muted">
            Validez (días)
            <ScaledInput
              value={draft.validity_days}
              scale={1}
              decimals={0}
              allowNull={false}
              disabled={readOnly}
              onChange={(v) => update((d) => ({ ...d, validity_days: Math.max(1, Math.min(365, v ?? 30)) }), "validity")}
            />
          </label>
        </div>
        <p className="-mt-1 text-[11px] text-muted">Válido hasta el {formatDateES(validUntil)}.</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-muted">
            IVA general
            <ScaledInput value={draft.vat_rate_bp} suffix="%" allowNull={false} disabled={readOnly} onChange={(v) => update((d) => ({ ...d, vat_rate_bp: Math.min(v ?? 0, 10000) }), "vat")} />
          </label>
          <label className="text-xs font-semibold text-muted">
            Descuento global
            <ScaledInput value={draft.global_discount_bp} suffix="%" allowNull={false} disabled={readOnly} onChange={(v) => update((d) => ({ ...d, global_discount_bp: Math.min(v ?? 0, 10000) }), "gdisc")} />
          </label>
        </div>
      </div>
      <div>
        <p className="kicker mb-2">Secciones del documento</p>
        <SectionList
          draft={draft}
          update={update}
          selected={tab === "sections" ? selectedSection : null}
          onSelect={(id) => {
            setSelectedSection(id);
            setTab("sections");
            setMobilePane("editor");
          }}
          readOnly={readOnly}
        />
      </div>
      {fromInterview ? (
        <Link href={`/entrevistas/${fromInterview}`} className="text-xs font-semibold underline">
          Volver a la entrevista
        </Link>
      ) : null}
    </div>
  );

  const summaryPanel = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={openPreview}>
          <Eye size={16} /> Vista previa
        </Button>
        <Button variant={problems.length ? "secondary" : "lime"} onClick={download}>
          <Download size={16} /> PDF
        </Button>
      </div>
      <SummaryPanel totals={totals} problems={problems} />
      {documents.length > 0 && (
        <div>
          <p className="kicker mb-2">Documentos generados</p>
          <ul className="flex flex-col gap-1 text-xs">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 rounded-md bg-surface px-2 py-1.5">
                <a href={`/api/documents/${d.id}`} className="truncate font-medium hover:underline" title={d.file_name}>
                  Doc. {d.doc_version} · v{d.quote_version}
                </a>
                <span className="text-muted">{new Date(d.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col">
      {/* Barra superior */}
      <div className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur lg:top-0">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 lg:px-6">
          <Link href="/presupuestos" className="text-muted hover:text-ink" aria-label="Volver">
            <ArrowLeft size={18} />
          </Link>
          <span className="font-mono text-sm font-semibold">
            {draft.number}
            {draft.version > 1 ? <span className="text-muted"> v{draft.version}</span> : null}
          </span>
          <QuoteStatusBadge status={draft.status} />
          <span className="text-xs text-muted" aria-live="polite">
            {readOnly
              ? "Solo lectura"
              : saving
                ? "Guardando…"
                : saveError
                  ? ""
                  : dirty
                    ? "Cambios sin guardar"
                    : savedAt
                      ? `Guardado a las ${savedAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`
                      : "Sin cambios"}
          </span>
          {saveError ? <Badge tone="danger">Error al guardar: {saveError}</Badge> : null}
          <div className="ml-auto flex items-center gap-1.5">
            {!readOnly && (
              <>
                <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo} aria-label="Deshacer" title="Deshacer (Ctrl+Z)">
                  <Undo2 size={16} />
                </Button>
                <Button variant="ghost" size="sm" onClick={redo} disabled={!canRedo} aria-label="Rehacer" title="Rehacer (Ctrl+Shift+Z)">
                  <Redo2 size={16} />
                </Button>
                <Button size="sm" onClick={() => void save()} disabled={saving || !dirty} title="Guardar (Ctrl+S)">
                  <Save size={14} /> Guardar
                </Button>
              </>
            )}
            {draft.status === "draft" && (
              <Button size="sm" variant="lime" onClick={() => changeStatus("ready")} disabled={pending}>
                Marcar definitivo
              </Button>
            )}
            {draft.status === "ready" && (
              <Button size="sm" variant="lime" onClick={() => changeStatus("sent")} disabled={pending}>
                Marcar enviado
              </Button>
            )}
            {draft.status === "sent" && (
              <>
                <Button size="sm" variant="lime" onClick={() => changeStatus("accepted")} disabled={pending}>
                  Aceptado
                </Button>
                <Button size="sm" variant="secondary" onClick={() => changeStatus("rejected")} disabled={pending}>
                  Rechazado
                </Button>
              </>
            )}
            <div className="relative">
              <Button size="sm" variant="ghost" onClick={() => setMenu((m) => !m)} aria-label="Más acciones" aria-expanded={menu}>
                <MoreHorizontal size={16} />
              </Button>
              {menu && (
                <div className="absolute right-0 z-30 mt-1 w-56 rounded-lg border border-line bg-card p-1 shadow-lg" role="menu">
                  {draft.status === "ready" && (
                    <MenuItem onClick={() => changeStatus("draft")}>Reabrir como borrador</MenuItem>
                  )}
                  <MenuItem onClick={() => start(async () => void (await newQuoteVersion(draft.id)))}>
                    <FileStack size={14} /> Nueva versión
                  </MenuItem>
                  <MenuItem onClick={() => start(async () => void (await duplicateQuote(draft.id)))}>
                    <Copy size={14} /> Duplicar como nuevo
                  </MenuItem>
                  {draft.status !== "archived" && <MenuItem onClick={() => changeStatus("archived")}>Archivar</MenuItem>}
                  {draft.status === "draft" && (
                    <MenuItem
                      danger
                      onClick={() => {
                        if (window.confirm("¿Eliminar este borrador? No se puede deshacer."))
                          start(async () => {
                            const r = await deleteDraftQuote(draft.id);
                            if (r && !r.ok) setStatusMsg({ tone: "danger", text: r.error });
                          });
                      }}
                    >
                      Eliminar borrador
                    </MenuItem>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {statusMsg && (
          <div className="flex items-start gap-2 px-4 pb-2 lg:px-6">
            <div className="flex-1">
              <Alert tone={statusMsg.tone}>
                {statusMsg.text}
                {statusMsg.list ? (
                  <ul className="mt-1 list-disc pl-4">
                    {statusMsg.list.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                ) : null}
              </Alert>
            </div>
            <button onClick={() => setStatusMsg(null)} aria-label="Cerrar aviso" className="p-1 text-muted">
              <X size={14} />
            </button>
          </div>
        )}
        {readOnly && (
          <div className="px-4 pb-2 text-xs text-muted lg:px-6">
            Este presupuesto está {draft.status === "ready" ? "marcado como definitivo" : "cerrado"}. Para modificarlo, {draft.status === "ready" ? "reábrelo o " : ""}crea una nueva versión.
          </div>
        )}
        {/* Conmutador para tablet/móvil */}
        <div className="flex border-t border-line xl:hidden">
          {(
            [
              ["data", "Datos"],
              ["editor", "Editor"],
              ["summary", "Resumen"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setMobilePane(k)}
              className={cx("flex-1 py-2 text-xs font-semibold", mobilePane === k ? "border-b-2 border-ink" : "text-muted")}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid flex-1 xl:grid-cols-[270px_minmax(0,1fr)_320px]">
        <aside className={cx("border-line p-4 xl:block xl:border-r", mobilePane === "data" ? "block" : "hidden")}>{dataPanel}</aside>

        <section className={cx("min-w-0 p-4 lg:p-6 xl:block", mobilePane === "editor" ? "block" : "hidden")}>
          <div className="mb-4 flex gap-1 border-b border-line">
            {(
              [
                ["items", "Fases y partidas"],
                ["sections", "Textos"],
                ["payments", "Pagos y condiciones"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={cx("-mb-px border-b-2 px-3 py-2 text-sm font-semibold", tab === k ? "border-ink" : "border-transparent text-muted hover:text-ink")}
              >
                {l}
              </button>
            ))}
          </div>
          {tab === "items" && <ItemsEditor draft={draft} update={update} totals={totals} services={services} categories={categories} readOnly={readOnly} />}
          {tab === "sections" &&
            (section ? (
              <SectionEditor key={section.id} section={section} update={update} readOnly={readOnly} onDeleted={() => setSelectedSection(draft.sections[0]?.id ?? null)} />
            ) : (
              <p className="text-sm text-muted">Selecciona una sección en el panel de la izquierda.</p>
            ))}
          {tab === "payments" && <PaymentsEditor draft={draft} update={update} totals={totals} schedule={schedule} readOnly={readOnly} />}
        </section>

        <aside className={cx("border-line p-4 xl:block xl:border-l", mobilePane === "summary" ? "block" : "hidden")}>{summaryPanel}</aside>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60 p-3 md:p-8" role="dialog" aria-modal aria-label="Vista previa del PDF">
          <div className="mb-2 flex items-center justify-between text-white">
            <p className="text-sm font-semibold">Vista previa · se genera con los datos guardados</p>
            <div className="flex gap-2">
              <button className={buttonClass("secondary", "sm")} onClick={() => setPreview(`/api/quotes/${draft.id}/pdf?mode=preview&t=${Date.now()}`)}>
                Actualizar
              </button>
              <button className={buttonClass("lime", "sm")} onClick={() => setPreview(null)}>
                Cerrar
              </button>
            </div>
          </div>
          <iframe src={preview} className="w-full flex-1 rounded-lg bg-white" title="Vista previa del presupuesto" />
        </div>
      )}
    </div>
  );
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button role="menuitem" onClick={onClick} className={cx("flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-surface", danger && "text-danger")}>
      {children}
    </button>
  );
}
