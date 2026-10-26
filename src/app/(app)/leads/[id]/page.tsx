import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, MapPin, Phone } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { loadLead } from "@/lib/leads/engine";
import { AXIS_LABEL, CRITERIA, TRIGGERS, scoreLead, type Axis } from "@/lib/leads/criteria";
import { formatEUR } from "@/lib/domain/money";
import { Alert, Badge, Card, cx } from "@/components/ui";
import { hostOf, LeadStatusBadge, ScoreBadge } from "../lead-ui";
import { CriterionRow, TriggerToggle, LeadActions, CopyBlock, NotesBox, ReanalyzeButton } from "./lead-client";

export const maxDuration = 60;

export default async function LeadPage({ params }: PageProps<"/leads/[id]">) {
  const { id } = await params;
  const ctx = await requireMember();
  const lead = await loadLead(ctx, id);
  if (!lead) notFound();

  const breakdown = scoreLead(lead.criteria, [...lead.triggers, ...lead.manual_triggers]);
  const results = new Map(lead.criteria.map((r) => [r.id, r]));
  const analyzed = !!lead.analyzed_at;
  const met = lead.criteria.filter((r) => r.met === true).length;
  const unmet = lead.criteria.filter((r) => r.met === false).length;
  const estimate = lead.offers.reduce((a, o) => a + (o.net_cents ?? 0), 0);
  const pitch = lead.pitch;
  const contact = lead.contact;

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 lg:px-10 lg:py-10">
      <Link href="/leads" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={15} /> Leads
      </Link>

      <header className="mb-6 flex flex-wrap items-start gap-6">
        <ScoreBadge score={lead.score} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="kicker mb-1">{[lead.category, lead.city].filter(Boolean).join(" · ") || "Lead"}</p>
          <h1 className="text-3xl font-bold tracking-tight">{lead.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-3">
            {lead.website ? (
              <a href={lead.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                <ExternalLink size={14} /> {hostOf(lead.website)}
              </a>
            ) : (
              <Badge tone="lime">Sin web</Badge>
            )}
            {lead.maps_url ? (
              <a href={lead.maps_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                <MapPin size={14} /> Google Maps
              </a>
            ) : null}
            {lead.phone ? (
              <a href={`tel:${lead.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 hover:underline">
                <Phone size={14} /> {lead.phone}
              </a>
            ) : null}
            <LeadStatusBadge status={lead.status} />
          </div>
          {lead.address ? <p className="mt-1 text-xs text-muted">{lead.address}</p> : null}
        </div>
        <LeadActions id={lead.id} status={lead.status} quoteId={lead.quote_id} hasOffers={lead.offers.length > 0} />
      </header>

      {lead.status === "discarded" && lead.discard_reason ? (
        <div className="mb-4">
          <Alert tone="warn">Descartado: {lead.discard_reason}</Alert>
        </div>
      ) : null}
      {pitch?.franchise.likely ? (
        <div className="mb-4">
          <Alert tone="warn" title="Puede ser una franquicia o cadena">
            {pitch.franchise.reason} Si la marca se decide en una central, no suele ser buen lead.
          </Alert>
        </div>
      ) : null}
      {!analyzed ? (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm">Este lead aún no está analizado.</p>
          <ReanalyzeButton id={lead.id} name={lead.name} label="Analizar ahora" />
        </Card>
      ) : null}

      {analyzed ? (
        <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
          {/* Columna izquierda: diagnóstico */}
          <div className="flex flex-col gap-6">
            <Card className="p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold">Diagnóstico</h2>
                <span className="text-xs text-muted">
                  Cumple {met} · No cumple {unmet} · Sin comprobar {lead.criteria.length - met - unmet}
                </span>
              </div>
              <div className="mb-5 grid grid-cols-3 gap-2">
                {(Object.keys(AXIS_LABEL) as Axis[]).map((a) => {
                  const ax = breakdown.byAxis[a];
                  return (
                    <div key={a} className="rounded-lg bg-surface p-3">
                      <p className="text-xs font-semibold text-muted">{AXIS_LABEL[a]}</p>
                      <p className="tabular text-xl font-bold">{ax.pct === null ? "—" : `${ax.pct} %`}</p>
                      <p className="text-[11px] text-muted">por mejorar</p>
                    </div>
                  );
                })}
              </div>
              {(Object.keys(AXIS_LABEL) as Axis[]).map((axis) => (
                <div key={axis} className="mb-4 last:mb-0">
                  <p className="kicker mb-1">{AXIS_LABEL[axis]}</p>
                  <ul className="divide-y divide-line">
                    {CRITERIA.filter((c) => c.axis === axis).map((c) => {
                      const r = results.get(c.id);
                      return r ? <CriterionRow key={c.id} leadId={lead.id} criterion={{ id: c.id, label: c.label }} result={r} /> : null;
                    })}
                  </ul>
                </div>
              ))}
              {lead.site?.agencyCredit ? <p className="mt-3 text-xs text-muted">La web indica que la hizo: {lead.site.agencyCredit}.</p> : null}
            </Card>

            <Card className="p-5">
              <h2 className="mb-1 text-lg font-bold">Señales de momento</h2>
              <p className="mb-3 text-xs text-muted">Suman 5 puntos cada una (máximo 15). Las automáticas salen de la web; el resto márcalas si lo sabes.</p>
              <ul className="flex flex-col gap-2">
                {TRIGGERS.map((t) =>
                  t.auto ? (
                    <li key={t.id} className={cx("flex items-center gap-2 text-sm", !lead.triggers.includes(t.id) && "text-muted")}>
                      <span className={cx("inline-block h-2.5 w-2.5 rounded-full", lead.triggers.includes(t.id) ? "bg-lime" : "bg-line-strong")} />
                      {t.label} <span className="text-[11px] text-muted">(automática)</span>
                    </li>
                  ) : (
                    <TriggerToggle key={t.id} leadId={lead.id} id={t.id} label={t.label} on={lead.manual_triggers.includes(t.id)} />
                  ),
                )}
              </ul>
            </Card>

            {lead.screenshot ? (
              <Card className="p-5">
                <h2 className="mb-3 text-lg font-bold">Así se ve en el móvil</h2>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={lead.screenshot} alt={`Captura móvil de ${lead.name}`} className="mx-auto max-h-[520px] rounded-lg border border-line" />
                {lead.site?.performance != null ? <p className="mt-2 text-center text-xs text-muted">PageSpeed móvil: {lead.site.performance}/100</p> : null}
              </Card>
            ) : null}
          </div>

          {/* Columna derecha: venta */}
          <div className="flex flex-col gap-6">
            <Card className="p-5">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="text-lg font-bold">Productos ofertables</h2>
                {estimate ? <span className="tabular text-sm font-bold">≈ {formatEUR(estimate, { compact: true })} + IVA</span> : null}
              </div>
              {lead.offers.length ? (
                <ul className="flex flex-col gap-2">
                  {lead.offers.map((o) => (
                    <li key={o.service_id} className="rounded-lg border border-line p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold">{o.name}</p>
                        <span className="tabular text-sm font-bold whitespace-nowrap">{o.net_cents != null ? formatEUR(o.net_cents, { compact: true }) : "A valorar"}</span>
                      </div>
                      <p className="text-xs text-muted">{o.price_label}</p>
                      <ul className="mt-1 text-xs text-ink-3">
                        {o.reasons.map((r) => (
                          <li key={r}>· {r}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Nada que ofrecer por ahora: cumple casi todo.</p>
              )}
              <p className="mt-3 text-[11px] text-muted">Precios orientativos con la tarifa vigente del catálogo y la cantidad por defecto de cada servicio.</p>
            </Card>

            {pitch ? (
              <>
                <Card className="p-5">
                  <h2 className="mb-1 text-lg font-bold">Por qué es una oportunidad</h2>
                  <p className="mb-3 text-xs text-muted">Argumentos para vosotros{pitch.generated_by === "template" ? " · generados con plantillas" : ""}.</p>
                  {pitch.summary ? <p className="mb-2 text-sm text-ink-3">{pitch.summary}</p> : null}
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {pitch.internal_arguments.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </Card>

                <Card className="p-5">
                  <h2 className="mb-1 text-lg font-bold">Qué ganan ellos</h2>
                  <p className="mb-3 text-xs text-muted">Argumentos de venta para el cliente.</p>
                  <ul className="space-y-2 text-sm">
                    {pitch.client_arguments.map((a) => (
                      <li key={a} className="rounded-lg bg-lime-soft/60 px-3 py-2">
                        {a}
                      </li>
                    ))}
                  </ul>
                  {pitch.objections.length ? (
                    <div className="mt-4">
                      <p className="kicker mb-2">Si os dicen…</p>
                      <dl className="space-y-2 text-sm">
                        {pitch.objections.map((o) => (
                          <div key={o.objection}>
                            <dt className="font-semibold">«{o.objection}»</dt>
                            <dd className="text-ink-3">{o.answer}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ) : null}
                </Card>

                <Card className="p-5">
                  <h2 className="mb-3 text-lg font-bold">Primer mensaje</h2>
                  <CopyBlock text={pitch.opening_message} />
                  <div className="mt-4">
                    <p className="kicker mb-2">Por dónde contactar</p>
                    <ul className="space-y-1 text-sm">
                      {contact?.contactForm ? <li>· Formulario de contacto de su web</li> : null}
                      {lead.phone ? <li>· Teléfono: {lead.phone}</li> : null}
                      {contact?.social.instagram ? (
                        <li>
                          · Instagram:{" "}
                          <a className="underline" href={contact.social.instagram} target="_blank" rel="noreferrer">
                            mensaje directo
                          </a>
                        </li>
                      ) : null}
                      {contact?.social.linkedin ? (
                        <li>
                          ·{" "}
                          <a className="underline" href={contact.social.linkedin} target="_blank" rel="noreferrer">
                            LinkedIn
                          </a>
                        </li>
                      ) : null}
                      {contact?.social.facebook ? (
                        <li>
                          ·{" "}
                          <a className="underline" href={contact.social.facebook} target="_blank" rel="noreferrer">
                            Facebook
                          </a>
                        </li>
                      ) : null}
                      {contact?.emails.length ? (
                        <li>
                          · Email: {contact.emails.join(", ")}
                        </li>
                      ) : null}
                    </ul>
                    <p className="mt-2 text-[11px] text-muted">
                      El email comercial no solicitado necesita consentimiento previo (LSSI, art. 21), también entre empresas. El formulario de contacto, el teléfono y los mensajes en redes son vías más seguras para el primer contacto.
                    </p>
                  </div>
                </Card>
              </>
            ) : (
              <Card className="flex items-center justify-between gap-3 p-5">
                <p className="text-sm text-muted">Falta el argumentario.</p>
                <ReanalyzeButton id={lead.id} name={lead.name} label="Generar argumentario" pitchOnly />
              </Card>
            )}

            <Card className="p-5">
              <h2 className="mb-3 text-lg font-bold">Notas</h2>
              <NotesBox id={lead.id} initial={lead.notes} />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <span>Analizado el {new Date(lead.analyzed_at!).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}</span>
                <ReanalyzeButton id={lead.id} name={lead.name} label="Volver a analizar" />
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </main>
  );
}

