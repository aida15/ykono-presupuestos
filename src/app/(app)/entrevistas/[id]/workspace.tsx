"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, Check, CircleDashed, Clock, Plus, Send, Sparkles, Trash2, X } from "lucide-react";
import { generateQuoteFromInterview, saveInterviewState, sendInterviewMessage } from "@/lib/actions/interview";
import { COMMON_FIELDS, isFilled, type ChatMessage, type InterviewState } from "@/lib/interview/state";
import { DISCIPLINE_LABEL } from "@/lib/catalog/disciplines";
import { Alert, Badge, Button, cx } from "@/components/ui";
import { LinesInput, ScaledInput, SmallSelect, TextArea, TextInput } from "../../presupuestos/[id]/editor/inputs";

type ServiceLite = {
  id: string;
  name: string;
  unit: string;
  category_id: string | null;
  price: string;
  levels: { key: string; label: string }[];
  default_quantity: number;
};

const BRAND_STATUS: Record<string, string> = { "": "Sin determinar", new: "Marca nueva", existing: "Marca existente", transition: "En transición" };

export function InterviewWorkspace({
  sessionId,
  initialState,
  initialMessages,
  initialStatus,
  services,
  categories,
  aiMode,
}: {
  sessionId: string;
  initialState: InterviewState;
  initialMessages: ChatMessage[];
  initialStatus: "active" | "summary";
  services: ServiceLite[];
  categories: { id: string; name: string }[];
  aiMode: boolean;
}) {
  const [state, setState] = useState(initialState);
  const [messages, setMessages] = useState(initialMessages);
  const [view, setView] = useState<"chat" | "summary">(initialStatus === "summary" ? "summary" : "chat");
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, startSend] = useTransition();
  const [saving, startSave] = useTransition();
  const [generating, startGen] = useTransition();
  const [dirty, setDirty] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const svc = (id: string) => services.find((s) => s.id === id);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  function send() {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text, at: new Date().toISOString() }]);
    startSend(async () => {
      // Si hay cambios manuales sin guardar, se guardan antes para que la IA los vea.
      if (dirty) {
        const s = await saveInterviewState(sessionId, state);
        if (s.ok) setDirty(false);
      }
      const r = await sendInterviewMessage(sessionId, text);
      if (r.ok) {
        setState(r.data.state);
        setMessages(r.data.messages);
      } else {
        setError(r.error);
        setMessages((m) => m.slice(0, -1));
        setInput(text);
      }
    });
  }

  /** Edición manual del estado. persist=true guarda al momento (acciones discretas). */
  function edit(fn: (s: InterviewState) => InterviewState, persist = false) {
    const next = fn(state);
    setState(next);
    if (persist) {
      startSave(async () => {
        const r = await saveInterviewState(sessionId, next);
        if (r.ok) {
          setState(r.data);
          setDirty(false);
        } else setError(r.error);
      });
    } else setDirty(true);
  }

  function saveNow(status?: "active" | "summary") {
    startSave(async () => {
      const r = await saveInterviewState(sessionId, state, status);
      if (r.ok) {
        setState(r.data);
        setDirty(false);
      } else setError(r.error);
    });
  }

  function generate() {
    setError(null);
    startGen(async () => {
      const s = await saveInterviewState(sessionId, state, "summary");
      if (!s.ok) return setError(s.error);
      const r = await generateQuoteFromInterview(sessionId);
      if (r && !r.ok) setError(r.error);
    });
  }

  const pendingRecs = state.recommendations.filter((r) => r.status === "pending");
  const filledCount = COMMON_FIELDS.filter((f) => isFilled(state, f.key)).length;

  const servicesPanel = (
    <div>
      <p className="kicker mb-2">Servicios del presupuesto</p>
      {state.services.length === 0 ? <p className="text-sm text-muted">Aún no hay servicios. Se añaden al describir el encargo o desde el catálogo.</p> : null}
      <ul className="flex flex-col gap-2">
        {state.services.map((p) => {
          const s = svc(p.service_id);
          return (
            <li key={p.id} className="rounded-lg border border-line bg-card p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{s?.name ?? "Servicio eliminado"}</p>
                  <p className="text-xs text-muted">{s?.price}</p>
                </div>
                <button className="p-1 text-muted hover:text-danger" aria-label="Quitar servicio" onClick={() => edit((st) => ({ ...st, services: st.services.filter((x) => x.id !== p.id) }), true)}>
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-[90px_1fr] gap-2">
                <ScaledInput
                  value={p.quantity ?? s?.default_quantity ?? 100}
                  allowNull={false}
                  ariaLabel={`Cantidad (${s?.unit})`}
                  suffix={s?.unit && s.unit.length < 4 ? s.unit : undefined}
                  onChange={(v) => edit((st) => ({ ...st, services: st.services.map((x) => (x.id === p.id ? { ...x, quantity: v } : x)) }))}
                />
                <TextInput value={p.phase} placeholder="Fase" aria-label="Fase" onChange={(v) => edit((st) => ({ ...st, services: st.services.map((x) => (x.id === p.id ? { ...x, phase: v } : x)) }))} />
                {s?.levels.length ? (
                  <SmallSelect
                    className="col-span-2"
                    value={p.complexity_level ?? ""}
                    aria-label="Complejidad"
                    onChange={(e) => edit((st) => ({ ...st, services: st.services.map((x) => (x.id === p.id ? { ...x, complexity_level: e.target.value || null } : x)) }))}
                  >
                    <option value="">Complejidad por defecto</option>
                    {s.levels.map((l) => (
                      <option key={l.key} value={l.key}>
                        {l.label}
                      </option>
                    ))}
                  </SmallSelect>
                ) : null}
              </div>
              {p.evidence ? <p className="mt-1.5 text-[11px] text-muted italic">«{p.evidence}»</p> : null}
            </li>
          );
        })}
      </ul>
      <AddService
        services={services}
        categories={categories}
        exclude={state.services.map((s) => s.service_id)}
        onAdd={(id) =>
          edit(
            (st) => ({
              ...st,
              services: [...st.services, { id: crypto.randomUUID(), service_id: id, quantity: null, complexity_level: null, phase: "", notes: "", evidence: "", source: "manual" }],
              recommendations: st.recommendations.filter((r) => r.service_id !== id),
            }),
            true,
          )
        }
      />
    </div>
  );

  const recsPanel = state.recommendations.length ? (
    <div>
      <p className="kicker mb-2">Sugerencias de la IA</p>
      <ul className="flex flex-col gap-2">
        {state.recommendations.map((r) => {
          const s = svc(r.service_id);
          return (
            <li key={r.id} className={cx("rounded-lg border p-2.5", r.status === "pending" ? "border-lime bg-lime-soft/40" : "border-line bg-card opacity-80")}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">{s?.name}</p>
                {r.status !== "pending" ? (
                  <Badge tone={r.status === "added" ? "lime" : r.status === "deferred" ? "warn" : "neutral"}>
                    {r.status === "added" ? "Añadido" : r.status === "deferred" ? "Pendiente de valorar" : "Descartado"}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-ink-3">{r.reason}</p>
              <p className="mt-0.5 text-[11px] text-muted">{s?.price}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Button size="sm" variant={r.status === "added" ? "primary" : "secondary"} onClick={() => edit((st) => ({ ...st, recommendations: st.recommendations.map((x) => (x.id === r.id ? { ...x, status: "added" } : x)) }), true)}>
                  <Check size={13} /> Añadir
                </Button>
                <Button size="sm" variant={r.status === "deferred" ? "primary" : "ghost"} onClick={() => edit((st) => ({ ...st, recommendations: st.recommendations.map((x) => (x.id === r.id ? { ...x, status: "deferred" } : x)) }), true)}>
                  <Clock size={13} /> Pendiente
                </Button>
                <Button size="sm" variant={r.status === "dismissed" ? "primary" : "ghost"} onClick={() => edit((st) => ({ ...st, recommendations: st.recommendations.map((x) => (x.id === r.id ? { ...x, status: "dismissed" } : x)) }), true)}>
                  <X size={13} /> Descartar
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-muted">Nada se suma al presupuesto sin tu confirmación. «Pendiente» lo deja como opcional sin valorar.</p>
    </div>
  ) : null;

  const classificationCard = (
    <div className="rounded-xl border border-line bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="kicker">Clasificación provisional</p>
        {state.classification.confirmed ? (
          <Badge tone="lime">Revisada</Badge>
        ) : state.classification.project_type ? (
          <Button size="sm" variant="secondary" onClick={() => edit((st) => ({ ...st, classification: { ...st.classification, confirmed: true } }), true)}>
            Dar por buena
          </Button>
        ) : null}
      </div>
      {state.classification.project_type || state.classification.main_need ? (
        <div className="grid gap-2 text-sm">
          <label className="text-xs text-muted">
            Tipo de proyecto
            <TextInput value={state.classification.project_type} onChange={(v) => edit((st) => ({ ...st, classification: { ...st.classification, project_type: v, confirmed: false } }))} />
          </label>
          <label className="text-xs text-muted">
            Necesidad principal
            <TextArea rows={2} value={state.classification.main_need} onChange={(v) => edit((st) => ({ ...st, classification: { ...st.classification, main_need: v, confirmed: false } }))} />
          </label>
          <label className="text-xs text-muted">
            Situación de la marca
            <SmallSelect
              value={state.classification.brand_status}
              onChange={(e) => edit((st) => ({ ...st, classification: { ...st.classification, brand_status: e.target.value as InterviewState["classification"]["brand_status"], confirmed: false } }))}
            >
              {Object.entries(BRAND_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </SmallSelect>
          </label>
          <div className="flex flex-wrap gap-1">
            {(["strategy", "identity", "digital", "packaging", "editorial", "social", "recurring"] as const).map((d) => {
              const on = state.classification.disciplines.includes(d);
              return (
                <button
                  key={d}
                  onClick={() =>
                    edit((st) => ({
                      ...st,
                      classification: { ...st.classification, confirmed: false, disciplines: on ? st.classification.disciplines.filter((x) => x !== d) : [...st.classification.disciplines, d] },
                    }))
                  }
                  className={cx("rounded-full border px-2 py-0.5 text-[11px] font-semibold", on ? "border-ink bg-ink text-white" : "border-line-strong text-muted")}
                >
                  {DISCIPLINE_LABEL[d]}
                </button>
              );
            })}
          </div>
          {state.classification.risks.length ? (
            <div>
              <p className="text-xs font-semibold text-muted">Riesgos y dependencias</p>
              <ul className="list-disc pl-4 text-xs">
                {state.classification.risks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {dirty ? (
            <Button size="sm" onClick={() => saveNow()} disabled={saving}>
              Guardar cambios
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted">Aparecerá en cuanto describas el encargo.</p>
      )}
    </div>
  );

  if (view === "summary") {
    return (
      <SummaryView
        state={state}
        edit={edit}
        dirty={dirty}
        saving={saving}
        generating={generating}
        error={error}
        onSave={() => saveNow("summary")}
        onBack={() => {
          setView("chat");
          saveNow("active");
        }}
        onGenerate={generate}
        servicesPanel={servicesPanel}
        recsPanel={recsPanel}
        svc={svc}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 lg:px-6">
        <Link href="/" className="text-muted hover:text-ink" aria-label="Volver">
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0">
          <p className="kicker">Entrevista</p>
          <p className="truncate font-semibold">{state.common.project_name || state.classification.project_type || "Nuevo encargo"}</p>
        </div>
        <Badge tone={aiMode ? "lime" : "warn"}>
          {aiMode ? (
            <>
              <Sparkles size={11} /> IA activa
            </>
          ) : (
            "Modo guiado"
          )}
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-muted sm:inline">
            {filledCount}/{COMMON_FIELDS.length} datos · {state.services.length} servicios
          </span>
          <Button variant="lime" onClick={() => { setView("summary"); saveNow("summary"); }}>
            Ver resumen
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="flex min-h-0 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-6 lg:px-10">
            <div className="mx-auto flex max-w-2xl flex-col gap-4">
              {messages.map((m, i) => (
                <div key={i} className={cx("max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap", m.role === "user" ? "self-end bg-ink text-white" : "self-start border border-line bg-card")}>
                  {m.content}
                </div>
              ))}
              {sending ? (
                <div className="flex items-center gap-2 self-start rounded-2xl border border-line bg-card px-4 py-3 text-sm text-muted">
                  <CircleDashed size={14} className="animate-spin" /> Ordenando la información…
                </div>
              ) : null}
              <div ref={bottom} />
            </div>
          </div>
          <div className="border-t border-line bg-paper p-3 lg:px-10">
            <div className="mx-auto max-w-2xl">
              {error ? (
                <div className="mb-2">
                  <Alert tone="danger">{error}</Alert>
                </div>
              ) : null}
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={Math.min(6, Math.max(2, input.split("\n").length))}
                  placeholder="Escribe con tus palabras… (Mayús+Intro para salto de línea)"
                  className="flex-1 resize-none rounded-xl border border-line-strong bg-card px-3 py-2.5 text-sm focus:border-ink focus:outline-none"
                  aria-label="Mensaje"
                  disabled={sending}
                />
                <Button onClick={send} disabled={sending || !input.trim()} aria-label="Enviar" className="!h-11">
                  <Send size={16} />
                </Button>
              </div>
            </div>
          </div>
        </section>

        <aside className="flex flex-col gap-5 overflow-y-auto border-t border-line bg-surface/50 p-4 lg:border-t-0 lg:border-l">
          {classificationCard}
          {pendingRecs.length ? <Alert tone="lime">Hay {pendingRecs.length} sugerencia(s) por decidir.</Alert> : null}
          {servicesPanel}
          {recsPanel}
          <div>
            <p className="kicker mb-2">Información recogida</p>
            <ul className="grid gap-1 text-xs">
              {COMMON_FIELDS.map((f) => (
                <li key={f.key} className="flex items-start gap-2">
                  {isFilled(state, f.key) ? <Check size={13} className="mt-0.5 shrink-0 text-lime-ink" /> : <CircleDashed size={13} className="mt-0.5 shrink-0 text-muted" />}
                  <span className={isFilled(state, f.key) ? "" : "text-muted"}>
                    <span className="font-semibold">{f.label}</span>
                    {isFilled(state, f.key) ? `: ${[state.common[f.key]].flat().join(", ")}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {state.open_questions.length ? (
            <div>
              <p className="kicker mb-2">Falta por saber</p>
              <ul className="list-disc pl-4 text-xs text-ink-3">
                {state.open_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function AddService({
  services,
  categories,
  exclude,
  onAdd,
}: {
  services: ServiceLite[];
  categories: { id: string; name: string }[];
  exclude: string[];
  onAdd: (id: string) => void;
}) {
  return (
    <SmallSelect
      className="mt-2"
      value=""
      aria-label="Añadir servicio del catálogo"
      onChange={(e) => {
        if (e.target.value) onAdd(e.target.value);
      }}
    >
      <option value="">+ Añadir servicio del catálogo…</option>
      {categories.map((c) => (
        <optgroup key={c.id} label={c.name}>
          {services
            .filter((s) => s.category_id === c.id && !exclude.includes(s.id))
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </optgroup>
      ))}
    </SmallSelect>
  );
}

function SummaryView({
  state,
  edit,
  dirty,
  saving,
  generating,
  error,
  onSave,
  onBack,
  onGenerate,
  servicesPanel,
  recsPanel,
  svc,
}: {
  state: InterviewState;
  edit: (fn: (s: InterviewState) => InterviewState, persist?: boolean) => void;
  dirty: boolean;
  saving: boolean;
  generating: boolean;
  error: string | null;
  onSave: () => void;
  onBack: () => void;
  onGenerate: () => void;
  servicesPanel: React.ReactNode;
  recsPanel: React.ReactNode;
  svc: (id: string) => ServiceLite | undefined;
}) {
  const c = state.common;
  const setCommon = <K extends keyof InterviewState["common"]>(k: K, v: InterviewState["common"][K]) => edit((s) => ({ ...s, common: { ...s.common, [k]: v } }));
  const pendingRecs = state.recommendations.filter((r) => r.status === "pending");
  const deferred = state.recommendations.filter((r) => r.status === "deferred");

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 lg:px-10">
      <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={16} /> Volver a la entrevista
      </button>
      <h1 className="text-3xl font-bold tracking-tight">Resumen antes del borrador</h1>
      <p className="mt-1 mb-8 text-sm text-muted">Revisa y corrige. Lo que aparece aquí es lo único que usará la IA para redactar; los precios los pone el catálogo.</p>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          <Block title="Cliente y proyecto">
            <div className="grid gap-3 md:grid-cols-2">
              <L label="Cliente">
                <TextInput value={c.client_name} onChange={(v) => setCommon("client_name", v)} />
              </L>
              <L label="Nombre del proyecto">
                <TextInput value={c.project_name} onChange={(v) => setCommon("project_name", v)} />
              </L>
              <L label="Sector">
                <TextInput value={c.sector} onChange={(v) => setCommon("sector", v)} />
              </L>
              <L label="Quién valida">
                <TextInput value={c.validators} onChange={(v) => setCommon("validators", v)} />
              </L>
            </div>
          </Block>
          <Block title="Objetivos y situación de partida">
            <L label="Objetivos (uno por línea)">
              <LinesInput value={c.objectives} onChange={(v) => setCommon("objectives", v)} rows={3} />
            </L>
            <L label="Situación de partida">
              <TextArea value={c.starting_point} onChange={(v) => setCommon("starting_point", v)} rows={3} />
            </L>
            <L label="Contexto del negocio">
              <TextArea value={c.business_context} onChange={(v) => setCommon("business_context", v)} rows={2} />
            </L>
            <L label="Público objetivo">
              <TextInput value={c.target_audience} onChange={(v) => setCommon("target_audience", v)} />
            </L>
          </Block>
          <Block title="Entregables, alcance y exclusiones">
            <L label="Entregables (uno por línea)">
              <LinesInput value={c.deliverables} onChange={(v) => setCommon("deliverables", v)} rows={4} />
            </L>
            <L label="Idiomas">
              <LinesInput value={c.languages} onChange={(v) => setCommon("languages", v)} rows={2} />
            </L>
            <L label="Lo que no incluye (uno por línea)">
              <LinesInput value={state.exclusions} onChange={(v) => edit((s) => ({ ...s, exclusions: v }))} rows={3} />
            </L>
            <L label="Lo que aporta el cliente (uno por línea)">
              <LinesInput value={state.client_responsibilities} onChange={(v) => edit((s) => ({ ...s, client_responsibilities: v }))} rows={3} />
            </L>
          </Block>
          <Block title="Plazos">
            <div className="grid gap-3 md:grid-cols-2">
              <L label="Fecha deseada">
                <TextInput value={c.desired_deadline} onChange={(v) => setCommon("desired_deadline", v)} placeholder="Sin fecha confirmada" />
              </L>
              <L label="Dependencias externas">
                <TextInput value={c.external_dependencies} onChange={(v) => setCommon("external_dependencies", v)} />
              </L>
            </div>
            <L label="Notas de calendario">
              <TextArea value={state.timeline_notes} onChange={(v) => edit((s) => ({ ...s, timeline_notes: v }))} rows={2} />
            </L>
          </Block>
          <Block title="Pendiente">
            <L label="Información que falta (una por línea)">
              <LinesInput value={state.open_questions} onChange={(v) => edit((s) => ({ ...s, open_questions: v }))} rows={3} />
            </L>
            <L label="Decisiones que requieren aprobación">
              <LinesInput value={state.decisions_pending} onChange={(v) => edit((s) => ({ ...s, decisions_pending: v }))} rows={3} />
            </L>
            {c.client_budget ? <p className="text-sm">Presupuesto orientativo del cliente: <strong>{c.client_budget}</strong></p> : null}
          </Block>
        </div>

        <aside className="flex flex-col gap-5">
          <div className="rounded-xl bg-ink p-5 text-white">
            <p className="kicker !text-lime">Estimación económica</p>
            <p className="mt-2 text-sm text-white/80">
              {state.services.length} servicio(s){state.recommendations.some((r) => r.status === "added") ? ` + ${state.recommendations.filter((r) => r.status === "added").length} sugerencia(s) añadidas` : ""}. El importe exacto lo
              calcula el motor de precios al generar el borrador; las estimaciones por horas quedarán marcadas para aprobar.
            </p>
            <ul className="mt-3 flex flex-col gap-1 text-xs text-white/70">
              {state.services.map((p) => (
                <li key={p.id}>
                  · {svc(p.service_id)?.name} — {svc(p.service_id)?.price}
                </li>
              ))}
            </ul>
          </div>
          {pendingRecs.length ? <Alert tone="warn">Decide las {pendingRecs.length} sugerencias pendientes (o déjalas como están: no se añadirán).</Alert> : null}
          {deferred.length ? <Alert tone="info">{deferred.length} sugerencia(s) entrarán como opcionales sin valorar.</Alert> : null}
          {servicesPanel}
          {recsPanel}
          <div className="sticky bottom-4 flex flex-col gap-2 rounded-xl border border-line bg-card p-4 shadow-sm">
            {error ? <Alert tone="danger">{error}</Alert> : null}
            {dirty ? (
              <Button variant="secondary" onClick={onSave} disabled={saving}>
                Guardar cambios
              </Button>
            ) : null}
            <Button variant="lime" onClick={onGenerate} disabled={generating || state.services.length + state.recommendations.filter((r) => r.status === "added").length === 0}>
              {generating ? (
                <>
                  <CircleDashed size={16} className="animate-spin" /> Generando borrador…
                </>
              ) : (
                <>
                  <Plus size={16} /> Generar borrador del presupuesto
                </>
              )}
            </Button>
            <p className="text-[11px] text-muted">Se crea como borrador editable. Podrás cambiar textos, partidas y precios.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <h2 className="mb-3 font-bold">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-xs font-semibold text-muted">
      {label}
      <div className="mt-1 font-normal">{children}</div>
    </label>
  );
}
