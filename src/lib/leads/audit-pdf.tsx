/**
 * Auditoría gratuita de presencia digital (A4 vertical), con la identidad de los presupuestos.
 *
 * Misma estructura para todos los leads:
 *   portada · carta + qué hemos revisado · de un vistazo · lo que hemos encontrado
 *   (problema, lo que hemos visto, por qué importa + cifra, cómo lo arreglaríamos) ·
 *   lo que ya hacéis bien · nuestra propuesta · fuentes · cierre.
 */
import { Document, Image, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";
import { INK, INK2, LINE, MUTED, Mark, SOFT, Wordmark } from "@/lib/pdf/document";
import { formatDateES } from "@/lib/domain/quote";
import { CRITERIA_BY_ID, type CriterionResult } from "./criteria";
import { buildFindings, type AuditFinding, type AuditStat } from "./audit-content";

export type AuditArea = { key: string; title: string; items: { label: string; met: boolean | null; evidence: string }[] };

export type AuditData = {
  lead: { name: string; category: string | null; city: string | null; website: string | null };
  date: string;
  studio: { trade_name: string; tagline: string; email: string | null; phone: string | null; website: string | null; city: string | null; accent: string };
  intro: string;
  closing: string;
  areas: AuditArea[];
  findings: AuditFinding[];
  strengths: string[];
  screenshot: string | null;
  performance: number | null;
  proposal: { name: string; reasons: string[]; price: string | null }[];
  proposalTotal: string | null;
  sources: AuditStat[];
};

const AREAS: { key: string; title: string; ids: string[] }[] = [
  { key: "web", title: "Vuestra web", ids: ["has_website", "https", "mobile", "performance", "updated", "modern_tech", "own_domain", "seo_basics", "legal", "shop", "basque", "pro_email"] },
  { key: "google", title: "Google y Maps", ids: ["gbp_exists", "gbp_website", "gbp_photos", "gbp_hours"] },
  { key: "brand", title: "Imagen de marca", ids: ["logo_quality", "visual_consistency", "photo_quality", "favicon"] },
  { key: "social", title: "Redes sociales", ids: ["social"] },
];

/** Monta los datos del documento a partir de lo que ya sabemos del lead. */
export function buildAuditData(input: {
  lead: AuditData["lead"];
  results: CriterionResult[];
  screenshot: string | null;
  performance: number | null;
  offers: { name: string; reasons: string[]; price_label: string; net_cents: number | null }[];
  showPrices: boolean;
  intro: string;
  closing: string;
  studio: AuditData["studio"];
  date: string;
  formatTotal: (cents: number) => string;
}): AuditData {
  const byId = new Map(input.results.map((r) => [r.id, r]));
  const areas = AREAS.map((a) => ({
    key: a.key,
    title: a.title,
    items: a.ids
      .map((id) => byId.get(id))
      .filter((r): r is CriterionResult => !!r && !!CRITERIA_BY_ID[r.id] && r.met !== null)
      .map((r) => ({ label: CRITERIA_BY_ID[r.id].label, met: r.met, evidence: r.evidence })),
  }));
  const findings = buildFindings(input.results);
  const sources: AuditStat[] = [];
  for (const f of findings) if (f.stat && !sources.some((s) => s.id === f.stat!.id)) sources.push(f.stat);
  const total = input.offers.reduce((sum, o) => sum + (o.net_cents ?? 0), 0);
  return {
    lead: input.lead,
    date: input.date,
    studio: input.studio,
    intro: input.intro,
    closing: input.closing,
    areas,
    findings,
    strengths: input.results.filter((r) => r.met === true && CRITERIA_BY_ID[r.id]).map((r) => CRITERIA_BY_ID[r.id].label),
    screenshot: input.screenshot,
    performance: input.performance,
    proposal: input.offers.map((o) => ({ name: o.name, reasons: o.reasons, price: input.showPrices ? o.price_label : null })),
    proposalTotal: input.showPrices && total > 0 ? input.formatTotal(total) : null,
    sources,
  };
}

/* ------------------------------------------------------------------ */

const s = StyleSheet.create({
  page: { paddingTop: 54, paddingBottom: 64, paddingHorizontal: 48, fontFamily: "Helvetica", fontSize: 10, color: INK },
  dark: { backgroundColor: INK, color: "#FFFFFF" },
  kicker: { fontFamily: "Helvetica-Bold", fontSize: 7.5, letterSpacing: 1.6, color: MUTED, textTransform: "uppercase", marginBottom: 6 },
  h1: { fontFamily: "Helvetica-Bold", fontSize: 21, lineHeight: 1.15, marginBottom: 12 },
  body: { fontSize: 10.5, lineHeight: 1.55, color: "#2b2b28", marginBottom: 9 },
  small: { fontSize: 8.5, color: MUTED, lineHeight: 1.4 },
  section: { marginBottom: 24 },
  footer: { position: "absolute", bottom: 26, left: 48, right: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  footerText: { fontSize: 7, letterSpacing: 1.1, color: MUTED },
});

function Check({ met }: { met: boolean | null }) {
  // Envuelto en una caja fija: dentro de filas flexibles el SVG podía quedarse sin tamaño.
  return (
    <View style={{ width: 9, height: 9, flexShrink: 0 }}>
      {met === true ? (
        <Svg width={9} height={9} style={{ width: 9, height: 9 }} viewBox="0 0 24 24">
          <Path d="M4 12.5l5 5L20 6.5" stroke={INK} strokeWidth={2.8} fill="none" />
        </Svg>
      ) : (
        <Svg width={9} height={9} style={{ width: 9, height: 9 }} viewBox="0 0 24 24">
          <Path d="M5 5l14 14M19 5L5 19" stroke="#C2410C" strokeWidth={2.8} />
        </Svg>
      )}
    </View>
  );
}

function Footer({ data }: { data: AuditData }) {
  return (
    <View style={s.footer} fixed>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Mark height={13} color={data.studio.accent} />
        <Text style={s.footerText}>{`AUDITORÍA DE PRESENCIA DIGITAL · ${data.lead.name}`.toUpperCase()}</Text>
      </View>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function Head({ kicker, title }: { kicker: string; title: string }) {
  return (
    <View minPresenceAhead={140}>
      <Text style={s.kicker}>{kicker}</Text>
      <Text style={s.h1}>{title}</Text>
    </View>
  );
}

function Cover({ data }: { data: AuditData }) {
  const accent = data.studio.accent;
  const where = [data.lead.category, data.lead.city].filter(Boolean).join(" · ");
  return (
    <Page size="A4" style={[s.page, s.dark, { paddingTop: 48, paddingBottom: 40 }]}>
      <Wordmark width={104} color="#FFFFFF" />
      <View style={{ position: "absolute", right: 40, top: 46 }}>
        <Mark height={70} color={accent} />
      </View>
      <View style={{ marginTop: 130 }}>
        <View style={{ alignSelf: "flex-start", backgroundColor: accent, borderRadius: 4, paddingVertical: 5, paddingHorizontal: 10, marginBottom: 22 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8, letterSpacing: 1.6, color: INK }}>AUDITORÍA GRATUITA</Text>
        </View>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 34, lineHeight: 1.1, color: "#FFFFFF" }}>Vuestra presencia en internet</Text>
        <Text style={{ fontSize: 13, color: "#9a9a94", marginTop: 14, lineHeight: 1.4, maxWidth: 380 }}>
          Lo que ve un cliente cuando busca {data.lead.name}: web, Google, imagen y redes.
        </Text>
      </View>

      <View style={{ marginTop: 34, gap: 7 }}>
        {data.areas
          .filter((a) => a.items.length)
          .map((a, i) => {
            const ok = a.items.filter((x) => x.met).length;
            return (
              <View
                key={a.key}
                style={{ flexDirection: "row", alignItems: "center", backgroundColor: i === 0 ? accent : INK2, borderRadius: 7, paddingVertical: 10, paddingHorizontal: 16, marginLeft: i * 14, width: 300 }}
              >
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12, color: i === 0 ? INK : accent, width: 34 }}>{String(i + 1).padStart(2, "0")}</Text>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11.5, color: i === 0 ? INK : "#FFFFFF", flex: 1 }}>{a.title}</Text>
                <Text style={{ fontSize: 8.5, color: i === 0 ? INK : "#b5b5ae" }}>{`${ok} de ${a.items.length} bien`}</Text>
              </View>
            );
          })}
      </View>

      <View style={{ position: "absolute", left: 48, right: 48, bottom: 46 }}>
        <View style={{ flexDirection: "row", borderTopWidth: 0.6, borderTopColor: "#3a3a3a", paddingTop: 14, gap: 24 }}>
          <View style={{ flex: 1.6 }}>
            <Text style={{ fontSize: 7.5, letterSpacing: 1.4, color: "#8a8a85", marginBottom: 5 }}>PARA</Text>
            <Text style={{ fontSize: 9, color: "#FFFFFF" }}>{data.lead.name}</Text>
            {where ? <Text style={{ fontSize: 9, color: "#b5b5ae" }}>{where}</Text> : null}
            {data.lead.website ? <Text style={{ fontSize: 9, color: "#b5b5ae" }}>{data.lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</Text> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 7.5, letterSpacing: 1.4, color: "#8a8a85", marginBottom: 5 }}>FECHA</Text>
            <Text style={{ fontSize: 9, color: "#FFFFFF" }}>{formatDateES(data.date)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 7.5, letterSpacing: 1.4, color: "#8a8a85", marginBottom: 5 }}>PREPARADA POR</Text>
            <Text style={{ fontSize: 9, color: "#FFFFFF" }}>{data.studio.trade_name}</Text>
          </View>
        </View>
      </View>
    </Page>
  );
}

function Letter({ data }: { data: AuditData }) {
  const paras = data.intro
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <View style={s.section}>
      <Head kicker="Antes de nada" title="Hemos echado un vistazo a vuestro negocio" />
      {paras.map((p, i) => (
        <Text key={i} style={[s.body, i === 0 ? { fontFamily: "Helvetica-Bold" } : {}]}>
          {p}
        </Text>
      ))}
      <Text style={{ fontFamily: "Helvetica-Oblique", fontSize: 11, marginTop: 4 }}>{data.studio.trade_name}</Text>
    </View>
  );
}

function Overview({ data }: { data: AuditData }) {
  const accent = data.studio.accent;
  const areas = data.areas.filter((a) => a.items.length);
  // flex: 1 solo dentro de la fila con la captura; en columna deja el SVG sin altura y react-pdf falla.
  const list = (
    <View style={data.screenshot ? { flex: 1 } : {}}>
      {areas.map((a) => (
        <View key={a.key} style={{ marginBottom: 12 }}>
          <View minPresenceAhead={60} style={{ flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: INK, paddingBottom: 4, marginBottom: 2 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10.5 }}>{a.title}</Text>
            <Text style={{ fontSize: 8.5, color: MUTED }}>{`${a.items.filter((x) => x.met).length} de ${a.items.length} bien`}</Text>
          </View>
          {a.items.map((it, i) => (
            <View key={i} style={{ flexDirection: "row", paddingVertical: 4.5, borderBottomWidth: 0.5, borderBottomColor: LINE }} wrap={false}>
              <View style={{ width: 15, paddingTop: 1.5 }}>
                <Check met={it.met} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 9.5, fontFamily: it.met ? "Helvetica" : "Helvetica-Bold" }}>{it.label}</Text>
                <Text style={{ fontSize: 8, color: MUTED, marginTop: 1 }}>{it.evidence}</Text>
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
  return (
    <View style={[s.section, { marginTop: 10 }]}>
      <Head kicker="Lo que hemos revisado" title="De un vistazo" />
      <Text style={s.body}>
        Hemos repasado {areas.reduce((n, a) => n + a.items.length, 0)} puntos que un cliente nota, aunque no sepa ponerles nombre. Lo marcado con una cruz es lo que os contamos en detalle en las páginas siguientes.
      </Text>
      {data.screenshot ? (
        <View style={{ flexDirection: "row", gap: 22, alignItems: "flex-start" }}>
          {list}
          <View style={{ width: 150, alignItems: "center" }} wrap={false}>
            <View style={{ backgroundColor: INK, borderRadius: 16, padding: 6 }}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf no admite alt */}
              <Image src={data.screenshot} style={{ width: 132, borderRadius: 10 }} />
            </View>
            <Text style={[s.small, { marginTop: 8, textAlign: "center" }]}>Así se ve hoy vuestra web en un móvil.</Text>
            {data.performance != null ? (
              <View style={{ marginTop: 8, backgroundColor: data.performance >= 50 ? SOFT : accent, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10 }}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, textAlign: "center" }}>{`Velocidad en móvil: ${data.performance}/100`}</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        list
      )}
    </View>
  );
}

function Finding({ f, n, accent, refNo }: { f: AuditFinding; n: number; accent: string; refNo: number | null }) {
  return (
    <View style={{ marginBottom: 18, paddingBottom: 16, borderBottomWidth: 0.6, borderBottomColor: LINE }} wrap={false}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: INK, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10, color: accent }}>{String(n).padStart(2, "0")}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 13.5, lineHeight: 1.2 }}>{f.problem}</Text>
          <Text style={{ fontSize: 9, color: MUTED, marginTop: 4 }}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Lo que hemos visto: </Text>
            {f.seen}
          </Text>
          <Text style={[s.body, { marginTop: 7, marginBottom: 7 }]}>{f.why}</Text>
          {f.stat ? (
            <View style={{ flexDirection: "row", backgroundColor: SOFT, borderRadius: 6, marginBottom: 8 }}>
              <View style={{ width: 4, backgroundColor: accent }} />
              <View style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 10 }}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10, lineHeight: 1.4 }}>{f.stat.text}</Text>
                <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 3 }}>{`Fuente: ${f.stat.source}${refNo ? ` [${refNo}]` : ""}`}</Text>
              </View>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9.5 }}>Cómo lo arreglaríamos:</Text>
            <Text style={{ fontSize: 9.5, flex: 1, lineHeight: 1.45 }}>{f.fix}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function Findings({ data }: { data: AuditData }) {
  if (!data.findings.length) return null;
  return (
    <View style={s.section} break>
      <Head kicker="Lo que hemos encontrado" title={data.findings.length === 1 ? "Un punto que mejorar" : `${data.findings.length} puntos que mejorar`} />
      <Text style={[s.body, { marginBottom: 16 }]}>Ordenados de más a menos importante. En cada uno os contamos qué hemos visto, por qué importa y cómo lo resolveríamos.</Text>
      {data.findings.map((f, i) => (
        <Finding key={f.id} f={f} n={i + 1} accent={data.studio.accent} refNo={f.stat ? data.sources.findIndex((x) => x.id === f.stat!.id) + 1 : null} />
      ))}
    </View>
  );
}

function Strengths({ data }: { data: AuditData }) {
  if (!data.strengths.length) return null;
  return (
    <View style={s.section} wrap={false}>
      <Head kicker="Y lo que ya está bien" title="Lo que ya hacéis bien" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {data.strengths.map((t, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: SOFT, borderRadius: 5, paddingVertical: 5, paddingHorizontal: 8 }}>
            <Check met />
            <Text style={{ fontSize: 9 }}>{t}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Proposal({ data }: { data: AuditData }) {
  if (!data.proposal.length) return null;
  const accent = data.studio.accent;
  return (
    <View style={s.section} break>
      <Head kicker="Nuestra propuesta" title="Cómo lo resolveríamos" />
      <Text style={s.body}>
        No hace falta hacerlo todo a la vez. Os proponemos empezar por lo que más se nota y dejar lo demás para cuando os venga bien. Esto es lo que haríamos nosotros:
      </Text>
      {data.proposal.map((p, i) => (
        <View key={i} style={{ flexDirection: "row", marginBottom: 8, borderRadius: 8, backgroundColor: i === 0 ? INK : SOFT }} wrap={false}>
          <View style={{ width: 54, padding: 13 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 18, color: i === 0 ? accent : INK }}>{String(i + 1).padStart(2, "0")}</Text>
          </View>
          <View style={{ flex: 1, paddingVertical: 13, paddingRight: 14 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12, color: i === 0 ? "#FFFFFF" : INK, flex: 1 }}>{p.name}</Text>
              {p.price ? <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10, color: i === 0 ? accent : INK }}>{p.price}</Text> : null}
            </View>
            {p.reasons.map((r, j) => (
              <View key={j} style={{ flexDirection: "row", marginTop: 4 }}>
                <Text style={{ width: 10, fontSize: 9.5, color: i === 0 ? accent : INK }}>•</Text>
                <Text style={{ flex: 1, fontSize: 9.5, color: i === 0 ? "#e6e6e0" : "#3a3a36" }}>{r}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
      {data.proposalTotal ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: INK, paddingTop: 8, marginTop: 6 }} wrap={false}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11 }}>Inversión orientativa, todo junto</Text>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11 }}>{`${data.proposalTotal} + IVA`}</Text>
        </View>
      ) : null}
      <Text style={[s.small, { marginTop: 8 }]}>
        {data.proposalTotal
          ? "Precios orientativos sin IVA, a partir de nuestras tarifas. El presupuesto final depende de lo que decidamos juntos."
          : "Si os interesa, os preparamos un presupuesto cerrado con lo que elijáis."}
      </Text>
    </View>
  );
}

function Sources({ data }: { data: AuditData }) {
  if (!data.sources.length) return null;
  return (
    <View style={{ marginTop: 6 }} wrap={false}>
      <Text style={s.kicker}>Fuentes de las cifras</Text>
      {data.sources.map((src, i) => (
        <Text key={src.id} style={{ fontSize: 7.5, color: MUTED, marginBottom: 3, lineHeight: 1.35 }}>
          {`[${i + 1}] ${src.source}. ${src.url}`}
        </Text>
      ))}
      <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 4, lineHeight: 1.35 }}>
        Los datos de vuestro negocio se han obtenido el {formatDateES(data.date)} a partir de vuestra web y de Google; algunas cosas pueden haber cambiado desde entonces.
      </Text>
    </View>
  );
}

function Closing({ data }: { data: AuditData }) {
  const { studio } = data;
  const accent = studio.accent;
  return (
    <Page size="A4" style={[s.page, s.dark, { paddingTop: 48 }]}>
      <Wordmark width={104} color="#FFFFFF" />
      <View style={{ position: "absolute", right: 48, top: 48 }}>
        <Mark height={170} color={accent} />
      </View>
      <View style={{ marginTop: 220 }}>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 40, lineHeight: 1.15, color: "#FFFFFF" }}>¿Lo vemos juntos?</Text>
        <Text style={{ fontSize: 13, lineHeight: 1.5, color: "#b5b5ae", marginTop: 16, maxWidth: 380 }}>{data.closing}</Text>
        <Text style={{ fontFamily: "Helvetica-Oblique", fontSize: 12, color: "#FFFFFF", marginTop: 18 }}>{studio.trade_name}</Text>
      </View>
      <View style={{ position: "absolute", left: 48, right: 48, bottom: 46 }}>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11, color: accent }}>{[studio.email, studio.phone, studio.website].filter(Boolean).join("  ·  ")}</Text>
        <Text style={{ fontSize: 8, color: "#8a8a85", marginTop: 8 }}>{[`${studio.trade_name}${studio.tagline ? ` | ${studio.tagline}` : ""}`, studio.city].filter(Boolean).join("  ·  ")}</Text>
      </View>
    </Page>
  );
}

export function AuditDocument({ data }: { data: AuditData }) {
  return (
    <Document title={`Auditoría de presencia digital · ${data.lead.name}`} author={data.studio.trade_name} language="es">
      <Cover data={data} />
      <Page size="A4" style={s.page}>
        <Letter data={data} />
        <Overview data={data} />
        <Findings data={data} />
        <Strengths data={data} />
        <Proposal data={data} />
        <Sources data={data} />
        <Footer data={data} />
      </Page>
      <Closing data={data} />
    </Document>
  );
}

export async function renderAuditPdf(data: AuditData): Promise<Buffer> {
  return renderToBuffer(<AuditDocument data={data} />);
}

export function auditFileName(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `Auditoria-presencia-digital_${slug || "negocio"}.pdf`;
}
