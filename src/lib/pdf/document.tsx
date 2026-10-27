/**
 * Plantilla editorial del presupuesto (A4 vertical).
 * Combina la sencillez del presupuesto de pantallas (bloque de cliente/fecha, tabla
 * descripción/precio, notas) con la narrativa por fases y la presentación de la
 * inversión de la propuesta de Almirall, sobre la identidad real de YKONO.
 *
 * IMPORTANTE: aquí no se calcula ningún importe. Todo sale de `data.totals` y
 * `data.schedule`, que produce el motor de precios a partir de los datos guardados.
 */
import { Document, Font, Image, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { LOGO_MARK, LOGO_WORDMARK } from "@/lib/brand/logo-paths";
import { formatBp, formatEUR, formatHundredths } from "@/lib/domain/money";
import { addDays, formatDateES, phaseSubtotals, type QuoteItemDraft, type QuoteSectionDraft } from "@/lib/domain/quote";
import type { PdfData } from "./types";

// Sin guionado automático (el de react-pdf es inglés y parte mal el castellano).
Font.registerHyphenationCallback((word) => [word]);

export const INK = "#111111";
export const INK2 = "#2A2A2A";
export const MUTED = "#6F6F6A";
export const SOFT = "#F3F3EE";
export const LINE = "#E3E2DC";

const s = StyleSheet.create({
  page: { paddingTop: 54, paddingBottom: 64, paddingHorizontal: 48, fontFamily: "Helvetica", fontSize: 10, color: INK },
  dark: { backgroundColor: INK, color: "#FFFFFF" },
  kicker: { fontFamily: "Helvetica-Bold", fontSize: 7.5, letterSpacing: 1.6, color: MUTED, textTransform: "uppercase", marginBottom: 6 },
  h1: { fontFamily: "Helvetica-Bold", fontSize: 21, lineHeight: 1.15, marginBottom: 12 },
  body: { fontSize: 10.5, lineHeight: 1.5, color: "#2b2b28", marginBottom: 8 },
  note: { fontFamily: "Helvetica-Oblique", fontSize: 8.5, color: MUTED, marginTop: 6 },
  section: { marginBottom: 26 },
  card: { backgroundColor: SOFT, borderRadius: 8, padding: 14 },
  cardTitle: { fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 4 },
  cardText: { fontSize: 9.5, color: "#3a3a36", lineHeight: 1.45 },
  bulletRow: { flexDirection: "row", marginBottom: 4 },
  footer: { position: "absolute", bottom: 26, left: 48, right: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  footerText: { fontSize: 7, letterSpacing: 1.1, color: MUTED },
  tableHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: INK, paddingBottom: 6, marginBottom: 2 },
  th: { fontSize: 8, color: MUTED },
  tr: { flexDirection: "row", paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: LINE },
  num: { fontFamily: "Helvetica-Bold" },
});

export function Wordmark({ width, color }: { width: number; color: string }) {
  const h = (width * LOGO_WORDMARK.height) / LOGO_WORDMARK.width;
  return (
    <Svg width={width} height={h} viewBox={`0 0 ${LOGO_WORDMARK.width} ${LOGO_WORDMARK.height}`}>
      <Path d={LOGO_WORDMARK.d} fill={color} />
    </Svg>
  );
}

export function Mark({ height, color }: { height: number; color: string }) {
  const w = (height * LOGO_MARK.width) / LOGO_MARK.height;
  return (
    <Svg width={w} height={height} viewBox={`0 0 ${LOGO_MARK.width} ${LOGO_MARK.height}`}>
      <Path d={LOGO_MARK.d} fill={color} />
    </Svg>
  );
}

function Logo({ data, width, onDark }: { data: PdfData; width: number; onDark: boolean }) {
  // Un logotipo subido en PNG/JPG se usa sobre fondo claro; sobre oscuro se mantiene el vectorial en blanco.
  // eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf no admite alt
  if (data.customLogo && !onDark) return <Image src={data.customLogo} style={{ width, objectFit: "contain" }} />;
  return <Wordmark width={width} color={onDark ? "#FFFFFF" : INK} />;
}

function Paragraphs({ text }: { text?: string }) {
  if (!text?.trim()) return null;
  return (
    <>
      {text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <Text key={i} style={s.body}>
            {p}
          </Text>
        ))}
    </>
  );
}

function Bullets({ items, accent, mark = "check" }: { items?: string[]; accent: string; mark?: "check" | "cross" | "dot" }) {
  if (!items?.length) return null;
  return (
    <View style={{ marginTop: 2, marginBottom: 6 }}>
      {items.map((b, i) => (
        <View key={i} style={s.bulletRow} wrap={false}>
          <View style={{ width: 16, paddingTop: 1 }}>
            {mark === "check" ? (
              <Svg width={9} height={9} viewBox="0 0 24 24">
                <Path d="M4 12.5l5 5L20 6.5" stroke={INK} strokeWidth={2.6} fill="none" />
              </Svg>
            ) : mark === "cross" ? (
              <Svg width={8} height={8} viewBox="0 0 24 24">
                <Path d="M5 5l14 14M19 5L5 19" stroke={MUTED} strokeWidth={2.6} />
              </Svg>
            ) : (
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: accent, marginTop: 3 }} />
            )}
          </View>
          <Text style={{ flex: 1, fontSize: 10, lineHeight: 1.4 }}>{b}</Text>
        </View>
      ))}
    </View>
  );
}

function Cards({ cards, accent, head }: { cards?: { title: string; text: string }[]; accent: string; head?: ReactNode }) {
  if (!cards?.length) return head ? <>{head}</> : null;
  const cols = cards.length === 1 ? 1 : cards.length % 3 === 0 && cards.length > 3 ? 3 : 2;
  const width = cols === 1 ? "100%" : cols === 2 ? "48.5%" : "31.6%";
  const rows: { title: string; text: string }[][] = [];
  for (let i = 0; i < cards.length; i += cols) rows.push(cards.slice(i, i + cols));
  return (
    <>
      {rows.map((row, ri) => (
        // La primera fila viaja con el título de la sección para evitar títulos huérfanos al final de página.
        <View key={ri} wrap={false}>
          {ri === 0 ? head : null}
          <View style={{ flexDirection: "row", gap: 9, marginTop: ri === 0 ? 4 : 0, marginBottom: 9 }}>
            {row.map((c, i) => (
              <View key={i} style={[s.card, { width }]}>
                <View style={{ width: 18, height: 3, backgroundColor: accent, marginBottom: 8, borderRadius: 2 }} />
                <Text style={s.cardTitle}>{c.title}</Text>
                {c.text ? <Text style={s.cardText}>{c.text}</Text> : null}
              </View>
            ))}
          </View>
        </View>
      ))}
    </>
  );
}

function SectionHead({ section, fallbackKicker }: { section: QuoteSectionDraft; fallbackKicker?: string }) {
  const kicker = section.content.kicker || fallbackKicker;
  return (
    <View minPresenceAhead={150}>
      {kicker ? <Text style={s.kicker}>{kicker}</Text> : null}
      <Text style={s.h1}>{section.title}</Text>
    </View>
  );
}

function Footer({ data }: { data: PdfData }) {
  const label = `${data.draft.number}${data.draft.version > 1 ? ` v${data.draft.version}` : ""} · ${data.draft.title || "Presupuesto"}`;
  return (
    <View style={s.footer} fixed>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Mark height={13} color={data.studio.accent} />
        <Text style={s.footerText}>{label.toUpperCase()}</Text>
      </View>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function Watermark({ data }: { data: PdfData }) {
  if (data.mode !== "preview") return null;
  return (
    <View fixed style={{ position: "absolute", top: 380, left: 0, right: 0, alignItems: "center" }}>
      <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 76, color: "#000000", opacity: 0.045, transform: "rotate(-30deg)", letterSpacing: 8 }}>BORRADOR</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Portada                                                              */
/* ------------------------------------------------------------------ */

function Cover({ data }: { data: PdfData }) {
  const { draft, client, studio } = data;
  const accent = studio.accent;
  const phases = draft.phases.slice(0, 5);
  const clientLines = client
    ? [client.legal_name || client.trade_name, client.address_line, [client.postal_code, client.city].filter(Boolean).join(" "), client.tax_id ? `CIF: ${client.tax_id}` : null].filter(Boolean)
    : [];
  return (
    <Page size="A4" style={[s.page, s.dark, { paddingTop: 48, paddingBottom: 40 }]}>
      <Logo data={data} width={104} onDark />
      <View style={{ marginTop: 120 }}>
        <View style={{ alignSelf: "flex-start", backgroundColor: accent, borderRadius: 4, paddingVertical: 5, paddingHorizontal: 10, marginBottom: 22 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8, letterSpacing: 1.6, color: INK }}>{draft.phases.length > 1 ? "PROPUESTA DE PROYECTO" : "PRESUPUESTO"}</Text>
        </View>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 36, lineHeight: 1.08, color: "#FFFFFF" }}>{draft.title || "Presupuesto"}</Text>
        {draft.subtitle ? <Text style={{ fontSize: 12, color: "#9a9a94", marginTop: 14, lineHeight: 1.4 }}>{draft.subtitle}</Text> : null}
      </View>

      {phases.length > 1 ? (
        <View style={{ marginTop: 34, gap: 7 }}>
          {phases.map((p, i) => (
            <View
              key={p.id}
              style={{ flexDirection: "row", alignItems: "center", backgroundColor: i === 0 ? accent : INK2, borderRadius: 7, paddingVertical: 11, paddingHorizontal: 16, marginLeft: i * 14, width: 300 }}
            >
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 13, color: i === 0 ? INK : accent, width: 34 }}>{String(i + 1).padStart(2, "0")}</Text>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12, color: i === 0 ? INK : "#FFFFFF" }}>{p.name}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ position: "absolute", left: 48, right: 48, bottom: 46 }}>
        <View style={{ flexDirection: "row", borderTopWidth: 0.6, borderTopColor: "#3a3a3a", paddingTop: 14, gap: 24 }}>
          <View style={{ flex: 1.6 }}>
            <Text style={{ fontSize: 7.5, letterSpacing: 1.4, color: "#8a8a85", marginBottom: 5 }}>CLIENTE</Text>
            {clientLines.length ? (
              clientLines.map((l, i) => (
                <Text key={i} style={{ fontSize: 9, color: i === 0 ? "#FFFFFF" : "#b5b5ae" }}>
                  {l}
                </Text>
              ))
            ) : (
              <Text style={{ fontSize: 9, color: "#b5b5ae" }}>—</Text>
            )}
            {draft.addressee ? <Text style={{ fontSize: 9, color: "#b5b5ae", marginTop: 3 }}>A la atención de {draft.addressee}</Text> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 7.5, letterSpacing: 1.4, color: "#8a8a85", marginBottom: 5 }}>FECHA</Text>
            <Text style={{ fontSize: 9, color: "#FFFFFF" }}>{formatDateES(draft.issue_date)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 7.5, letterSpacing: 1.4, color: "#8a8a85", marginBottom: 5 }}>REFERENCIA</Text>
            <Text style={{ fontSize: 9, color: "#FFFFFF" }}>
              {draft.number}
              {draft.version > 1 ? ` · v${draft.version}` : ""}
            </Text>
          </View>
        </View>
      </View>
      <View style={{ position: "absolute", right: 40, top: 46 }}>
        <Mark height={70} color={accent} />
      </View>
      <Watermark data={data} />
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Bloques dirigidos por datos                                          */
/* ------------------------------------------------------------------ */

function itemQtyLabel(i: QuoteItemDraft) {
  if (i.method === "hourly" && i.hours != null) return `${formatHundredths(i.hours)} h`;
  if (i.quantity !== 100 && (i.method === "per_unit" || i.method === "manual" || i.method === "external")) return `${formatHundredths(i.quantity)} ${i.unit}`;
  return "";
}

function PhasesBlock({ data, section }: { data: PdfData; section: QuoteSectionDraft }) {
  const { draft } = data;
  const accent = data.studio.accent;
  const included = (i: QuoteItemDraft) => !(i.kind === "external" && (i.external_treatment ?? "informative") === "informative");
  const groups: { phase: (typeof draft.phases)[number] | null; items: QuoteItemDraft[] }[] = draft.phases.length
    ? draft.phases.map((p) => ({ phase: p, items: draft.items.filter((i) => i.phase_id === p.id && included(i)) }))
    : [{ phase: null, items: draft.items.filter(included) }];
  const loose = draft.phases.length ? draft.items.filter((i) => included(i) && (!i.phase_id || !draft.phases.some((p) => p.id === i.phase_id))) : [];
  if (loose.length) groups.push({ phase: null, items: loose });

  return (
    <View style={s.section}>
      <SectionHead section={section} fallbackKicker="Fases de trabajo" />
      <Paragraphs text={section.content.body} />
      {groups.map(({ phase, items }, gi) => {
        const allOptional = items.length > 0 && items.every((i) => i.is_optional && !i.optional_included);
        return (
          <View key={phase?.id ?? `g${gi}`} style={{ flexDirection: "row", marginBottom: 10, borderRadius: 8, backgroundColor: gi === 0 && phase ? INK : SOFT }} wrap={false}>
            <View style={{ width: 62, padding: 14 }}>
              {phase ? (
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 20, color: gi === 0 ? accent : INK }}>{String(gi + 1).padStart(2, "0")}</Text>
              ) : null}
            </View>
            <View style={{ flex: 1, paddingVertical: 14, paddingRight: 16 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 13, color: gi === 0 && phase ? "#FFFFFF" : INK, flex: 1 }}>{phase?.name ?? (draft.phases.length ? "Otros servicios" : "Servicios")}</Text>
                {phase?.timing ? (
                  <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 7.5, letterSpacing: 1.3, color: gi === 0 ? accent : MUTED }}>{phase.timing.toUpperCase()}</Text>
                ) : null}
              </View>
              {allOptional ? <Text style={{ fontSize: 8, color: gi === 0 && phase ? accent : MUTED, marginTop: 2 }}>OPCIONAL</Text> : null}
              {phase?.description ? <Text style={{ fontSize: 9.5, color: gi === 0 ? "#cfcfc8" : "#3a3a36", marginTop: 5, lineHeight: 1.45 }}>{phase.description}</Text> : null}
              {(phase?.deliverables.length ? phase.deliverables : items.map((i) => [i.name, itemQtyLabel(i)].filter(Boolean).join(" · "))).map((d, i) => (
                <View key={i} style={{ flexDirection: "row", marginTop: 4 }}>
                  <Text style={{ width: 10, color: gi === 0 && phase ? accent : INK, fontSize: 9.5 }}>•</Text>
                  <Text style={{ flex: 1, fontSize: 9.5, color: gi === 0 && phase ? "#FFFFFF" : INK }}>{d}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}
      {section.content.note ? <Text style={s.note}>{section.content.note}</Text> : null}
    </View>
  );
}

function ExclusionsBlock({ data, section }: { data: PdfData; section: QuoteSectionDraft }) {
  const externals = data.draft.items.filter((i) => i.kind === "external" && (i.external_treatment ?? "informative") === "informative");
  if (!data.draft.exclusions.length && !externals.length && !section.content.body) return null;
  return (
    <View style={s.section}>
      <SectionHead section={section} fallbackKicker="Para que no haya sorpresas" />
      <Paragraphs text={section.content.body} />
      <View style={{ flexDirection: "row", gap: 12 }}>
        {data.draft.exclusions.length ? (
          <View style={[s.card, { flex: 1 }]}>
            <Text style={[s.kicker, { marginBottom: 8 }]}>No incluido</Text>
            <Bullets items={data.draft.exclusions} accent={data.studio.accent} mark="cross" />
          </View>
        ) : null}
        {externals.length ? (
          <View style={{ flex: 1 }}>
            <Text style={[s.kicker, { marginBottom: 8 }]}>Costes de terceros · a vuestro nombre</Text>
            {externals.map((e, i) => {
              const r = data.totals.lines[e.id];
              return (
                <View key={e.id} style={{ backgroundColor: i === 0 ? data.studio.accent : SOFT, borderRadius: 7, padding: 10, marginBottom: 6, flexDirection: "row", justifyContent: "space-between", gap: 8 }} wrap={false}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10 }}>{e.name}</Text>
                    {e.description ? <Text style={{ fontSize: 8, color: "#3a3a36", marginTop: 2 }}>{e.description}</Text> : null}
                  </View>
                  <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10 }}>{r?.net != null && r.net > 0 ? `≈ ${formatEUR(r.net, { compact: true })}${e.unit === "año" ? "/año" : ""}` : "A determinar"}</Text>
                </View>
              );
            })}
            <Text style={s.note}>Precios orientativos de cada proveedor, más impuestos. No forman parte del importe de esta propuesta.</Text>
          </View>
        ) : null}
      </View>
      {section.content.note ? <Text style={s.note}>{section.content.note}</Text> : null}
    </View>
  );
}

function InvestmentBlock({ data, section }: { data: PdfData; section: QuoteSectionDraft }) {
  const { draft, totals } = data;
  const accent = data.studio.accent;
  const countable = draft.items.filter((i) => ["own", "resale", "suplido"].includes(totals.lines[i.id]?.bucket ?? ""));
  const optional = draft.items.filter((i) => totals.lines[i.id]?.bucket === "optional_excluded");
  const phaseOf = (i: QuoteItemDraft) => draft.phases.find((p) => p.id === i.phase_id);
  const subtotals = phaseSubtotals(draft, totals);
  const rows: { label: string; detail: string; amount: number | null; sub?: boolean; status?: string }[] = [];
  const byPhase = draft.phases.length > 1;
  if (byPhase) {
    for (const p of draft.phases) {
      const its = countable.filter((i) => i.phase_id === p.id);
      if (!its.length) continue;
      rows.push({ label: p.name, detail: its.map((i) => i.name).join(" · "), amount: subtotals.get(p.id) ?? 0 });
    }
    const loose = countable.filter((i) => !phaseOf(i));
    for (const i of loose) rows.push({ label: i.name, detail: itemQtyLabel(i), amount: totals.lines[i.id]?.net ?? null, status: i.price_status });
  } else {
    for (const i of countable) rows.push({ label: i.name, detail: [itemQtyLabel(i), i.discount_bp ? `dto. ${formatBp(i.discount_bp)}` : ""].filter(Boolean).join(" · "), amount: totals.lines[i.id]?.net ?? null, status: i.price_status });
  }
  const agreed = totals.taxableBase + totals.suplidos;

  return (
    <View style={s.section} break>
      <SectionHead section={section} fallbackKicker="Inversión" />
      <Paragraphs text={section.content.body} />
      <View style={{ flexDirection: "row", gap: 14 }} wrap={false}>
        <View style={{ flex: 1, backgroundColor: accent, borderRadius: 10, padding: 20 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 7.5, letterSpacing: 1.6 }}>TOTAL DEL PROYECTO</Text>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 34, marginTop: 14 }}>{formatEUR(agreed, { compact: true })}</Text>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 13, marginTop: 2 }}>+ IVA</Text>
          <View style={{ height: 0.8, backgroundColor: INK, marginVertical: 12 }} />
          <Text style={{ fontSize: 11 }}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{formatEUR(totals.total)}</Text> IVA incluido
            {totals.vatGroups.length === 1 ? ` (${formatBp(totals.vatGroups[0].rateBp)})` : ""}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 18 }}>
        <View style={s.tableHead}>
          <Text style={[s.th, { flex: 1 }]}>Descripción</Text>
          <Text style={[s.th, { width: 90, textAlign: "right" }]}>Importe</Text>
        </View>
        {rows.map((r, i) => (
          <View key={i} style={s.tr} wrap={false}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10 }}>{r.label}</Text>
              {r.detail ? <Text style={{ fontSize: 8.5, color: MUTED, marginTop: 1 }}>{r.detail}</Text> : null}
              {r.status === "estimate_pending" ? <Text style={{ fontSize: 7.5, color: "#b45309", marginTop: 1 }}>ESTIMACIÓN PENDIENTE DE APROBACIÓN</Text> : null}
            </View>
            <Text style={{ width: 90, textAlign: "right", fontSize: 10 }}>{r.amount == null ? "Pendiente" : formatEUR(r.amount)}</Text>
          </View>
        ))}
        <TotalsRows data={data} />
      </View>

      {optional.length ? (
        <View style={{ marginTop: 16 }} wrap={false}>
          <Text style={[s.kicker, { marginBottom: 6 }]}>Opcional · no incluido en el total</Text>
          {optional.map((i) => {
            const r = totals.lines[i.id];
            return (
              <View key={i.id} style={[s.tr, { borderBottomColor: LINE }]}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ fontSize: 10 }}>{i.name}</Text>
                  {i.description ? <Text style={{ fontSize: 8.5, color: MUTED }}>{i.description}</Text> : null}
                </View>
                <Text style={{ width: 120, textAlign: "right", fontSize: 10 }}>{r?.net == null ? "A valorar" : `${formatEUR(r.net)} + IVA`}</Text>
              </View>
            );
          })}
        </View>
      ) : null}
      {section.content.note ? <Text style={s.note}>{section.content.note}</Text> : null}
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
      <Text style={{ fontSize: bold ? 11 : 9.5, fontFamily: bold ? "Helvetica-Bold" : "Helvetica", color: bold ? INK : "#3a3a36" }}>{label}</Text>
      <Text style={{ fontSize: bold ? 11 : 9.5, fontFamily: bold ? "Helvetica-Bold" : "Helvetica" }}>{value}</Text>
    </View>
  );
}

function TotalsRows({ data }: { data: PdfData }) {
  const t = data.totals;
  return (
    <View style={{ marginTop: 8, marginLeft: "45%" }} wrap={false}>
      {t.globalDiscount > 0 ? <Row label="Subtotal" value={formatEUR(t.ownSubtotal + t.resaleSubtotal)} /> : null}
      {t.globalDiscount > 0 ? <Row label={`Descuento (${formatBp(t.globalDiscountBp)})`} value={`−${formatEUR(t.globalDiscount)}`} /> : null}
      <Row label="Base imponible" value={formatEUR(t.taxableBase)} />
      {t.vatGroups.map((g) => (
        <Row key={g.rateBp} label={`IVA ${formatBp(g.rateBp)}`} value={formatEUR(g.vat)} />
      ))}
      {t.suplidos > 0 ? <Row label="Suplidos (sin IVA)" value={formatEUR(t.suplidos)} /> : null}
      <View style={{ height: 1, backgroundColor: INK, marginVertical: 4 }} />
      <Row label="TOTAL" value={formatEUR(t.total)} bold />
    </View>
  );
}

function PaymentBlock({ data, section }: { data: PdfData; section: QuoteSectionDraft }) {
  const { schedule, draft } = data;
  const accent = data.studio.accent;
  if (!schedule.payments.length) return null;
  const asCards = schedule.payments.length <= 5;
  return (
    <View style={s.section} wrap={!asCards}>
      <SectionHead section={section} fallbackKicker="Forma de pago" />
      <Paragraphs text={section.content.body} />
      {asCards ? (
        <View style={{ flexDirection: "row", gap: 8 }} wrap={false}>
          {schedule.payments.map((p, i) => {
            const last = i === schedule.payments.length - 1 && schedule.payments.length > 1;
            return (
              <View key={p.id} style={{ flex: 1, backgroundColor: last ? accent : SOFT, borderRadius: 8, padding: 12 }}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 7, letterSpacing: 1.3, color: last ? INK : MUTED }}>PAGO {i + 1}</Text>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: schedule.payments.length > 3 ? 14 : 17, marginTop: 8 }}>{formatEUR(p.net, { compact: true })}</Text>
                <Text style={{ fontSize: 7.5, color: "#3a3a36", marginTop: 2 }}>{formatEUR(p.total)} con IVA</Text>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10, marginTop: 10 }}>{p.label}</Text>
                {p.due_hint ? <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 7, letterSpacing: 1.2, color: last ? INK : MUTED, marginTop: 3 }}>{p.due_hint.toUpperCase()}</Text> : null}
                {p.milestone ? <Text style={{ fontSize: 8.5, marginTop: 5, color: "#3a3a36" }}>{p.milestone}</Text> : null}
              </View>
            );
          })}
        </View>
      ) : (
        <View>
          {schedule.payments.map((p, i) => (
            <View key={p.id} style={s.tr} wrap={false}>
              <Text style={{ width: 24, fontFamily: "Helvetica-Bold" }}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{p.label}</Text>
                <Text style={{ fontSize: 8.5, color: MUTED }}>{[p.milestone, p.due_hint].filter(Boolean).join(" · ")}</Text>
              </View>
              <Text style={{ width: 80, textAlign: "right" }}>{formatEUR(p.net)}</Text>
              <Text style={{ width: 90, textAlign: "right", color: MUTED }}>{formatEUR(p.total)} c/IVA</Text>
            </View>
          ))}
        </View>
      )}
      {draft.payment_terms ? (
        <View style={[s.card, { marginTop: 10 }]} wrap={false}>
          <Text style={{ fontSize: 9.5 }}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Cómo se paga: </Text>
            {draft.payment_terms}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function ConditionsBlock({ data, section }: { data: PdfData; section: QuoteSectionDraft }) {
  const { draft } = data;
  const validUntil = addDays(draft.issue_date, draft.validity_days);
  const cards = [
    { title: "Validez", text: `Esta propuesta es válida durante ${draft.validity_days} días naturales, hasta el ${formatDateES(validUntil)}.` },
    ...draft.conditions,
    ...(section.content.cards ?? []),
  ];
  return (
    <View style={s.section}>
      <Cards
        cards={cards}
        accent={data.studio.accent}
        head={
          <>
            <SectionHead section={section} fallbackKicker="Condiciones" />
            <Paragraphs text={section.content.body} />
          </>
        }
      />
      {section.content.note ? <Text style={s.note}>{section.content.note}</Text> : null}
    </View>
  );
}

function GenericSection({ data, section }: { data: PdfData; section: QuoteSectionDraft }) {
  const c = section.content;
  if (!c.body && !c.bullets?.length && !c.cards?.length && !section.title) return null;
  return (
    <View style={s.section}>
      <SectionHead section={section} />
      <Paragraphs text={c.body} />
      <Bullets items={c.bullets} accent={data.studio.accent} />
      <Cards cards={c.cards} accent={data.studio.accent} />
      {c.note ? <Text style={s.note}>{c.note}</Text> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Cierre                                                               */
/* ------------------------------------------------------------------ */

function Closing({ data, section }: { data: PdfData; section: QuoteSectionDraft | undefined }) {
  const { studio, schedule } = data;
  const accent = studio.accent;
  const first = schedule.payments[0];
  const steps = [
    { t: "Aceptar la propuesta", d: studio.email ? `Firmada, a ${studio.email}` : "Firmada" },
    ...(first ? [{ t: "Primer pago", d: `${formatEUR(first.net, { compact: true })} + IVA` }] : []),
    { t: "Materiales y accesos", d: "Lo que necesitamos para empezar" },
    { t: "Reunión de inicio", d: "Arrancamos el proyecto" },
  ];
  const address = [studio.address_line, [studio.postal_code, studio.city].filter(Boolean).join(" ")].filter(Boolean).join(" | ");
  return (
    <Page size="A4" style={[s.page, s.dark, { paddingTop: 48 }]}>
      <Logo data={data} width={104} onDark />
      <View style={{ position: "absolute", right: 48, top: 48 }}>
        <Mark height={170} color={accent} />
      </View>
      <View style={{ marginTop: 200 }}>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 44, lineHeight: 1.15, color: "#FFFFFF" }}>{section?.title || "¿Empezamos?"}</Text>
        <Text style={{ fontSize: 13, lineHeight: 1.4, color: "#8a8a85", marginTop: 14, maxWidth: 360 }}>{section?.content.body || studio.closing_text}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 40 }}>
        {steps.map((st, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: i === 0 ? accent : INK2, borderRadius: 8, padding: 12 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 14, color: i === 0 ? INK : accent }}>{String(i + 1).padStart(2, "0")}</Text>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10, color: i === 0 ? INK : "#FFFFFF", marginTop: 10 }}>{st.t}</Text>
            <Text style={{ fontSize: 8, color: i === 0 ? INK : "#b5b5ae", marginTop: 3 }}>{st.d}</Text>
          </View>
        ))}
      </View>
      <View style={{ position: "absolute", left: 48, right: 48, bottom: 46 }}>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11, color: accent }}>{[studio.email, studio.website].filter(Boolean).join("  ·  ")}</Text>
        <Text style={{ fontSize: 8, color: "#8a8a85", marginTop: 8 }}>
          {[`${studio.trade_name} | ${studio.tagline}`, address, studio.phone].filter(Boolean).join("  ·  ")}
        </Text>
        {studio.legal_name || studio.tax_id ? (
          <Text style={{ fontSize: 7, color: "#6f6f6a", marginTop: 3 }}>{[studio.legal_name, studio.tax_id ? `NIF ${studio.tax_id}` : null].filter(Boolean).join(" · ")}</Text>
        ) : null}
      </View>
      <Watermark data={data} />
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Documento                                                            */
/* ------------------------------------------------------------------ */

export function QuoteDocument({ data }: { data: PdfData }) {
  const visible = data.draft.sections.filter((x) => x.visible);
  const showCover = data.studio.show_cover && visible.some((x) => x.type === "cover");
  const closing = visible.find((x) => x.type === "closing");
  const body = visible.filter((x) => x.type !== "cover" && x.type !== "closing");

  const render = (sec: QuoteSectionDraft): ReactNode => {
    switch (sec.type) {
      case "phases":
        return <PhasesBlock key={sec.id} data={data} section={sec} />;
      case "investment":
        return <InvestmentBlock key={sec.id} data={data} section={sec} />;
      case "payment":
        return <PaymentBlock key={sec.id} data={data} section={sec} />;
      case "exclusions":
        return <ExclusionsBlock key={sec.id} data={data} section={sec} />;
      case "conditions":
        return <ConditionsBlock key={sec.id} data={data} section={sec} />;
      default:
        return <GenericSection key={sec.id} data={data} section={sec} />;
    }
  };

  return (
    <Document
      title={`${data.draft.number} · ${data.draft.title}`}
      author={data.studio.trade_name}
      subject="Presupuesto"
      creator="YKONO Quote Studio"
      producer="YKONO Quote Studio"
      language="es-ES"
    >
      {showCover ? <Cover data={data} /> : null}
      <Page size="A4" style={s.page}>
        {!showCover ? (
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 30 }}>
            <Logo data={data} width={92} onDark={false} />
            <View style={{ alignItems: "flex-end" }}>
              <Text style={s.kicker}>Presupuesto</Text>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10 }}>{data.draft.number}</Text>
              <Text style={{ fontSize: 9, color: MUTED }}>{formatDateES(data.draft.issue_date)}</Text>
            </View>
          </View>
        ) : null}
        {!showCover ? (
          <View style={{ marginBottom: 26 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 24 }}>{data.draft.title}</Text>
            {data.client ? (
              <Text style={{ fontSize: 9.5, color: MUTED, marginTop: 6 }}>
                {[data.client.legal_name || data.client.trade_name, data.client.tax_id ? `CIF ${data.client.tax_id}` : null].filter(Boolean).join(" · ")}
              </Text>
            ) : null}
          </View>
        ) : null}
        {body.map(render)}
        <Footer data={data} />
        <Watermark data={data} />
      </Page>
      {data.studio.show_closing && closing ? <Closing data={data} section={closing} /> : null}
    </Document>
  );
}
