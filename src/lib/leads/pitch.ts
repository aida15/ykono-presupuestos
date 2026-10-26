/**
 * Argumentario de un lead: para el estudio (por qué es una oportunidad) y para
 * el cliente (qué gana), objeciones y un primer mensaje.
 *
 * Con IA se redacta a medida y se valora la marca a partir de la captura; sin IA
 * se compone con las plantillas de cada criterio. Nunca incluye precios.
 */
import { z } from "zod";
import { CRITERIA_BY_ID, TRIGGER_BY_ID, type CriterionResult } from "./criteria";

const Verdict = z.object({ met: z.boolean().nullable(), evidence: z.string().max(300) });

export const LeadPitch = z.object({
  summary: z.string().max(500),
  brand: z.object({ logo_quality: Verdict, visual_consistency: Verdict, photo_quality: Verdict }).nullable(),
  franchise: z.object({ likely: z.boolean(), reason: z.string().max(300) }),
  internal_arguments: z.array(z.string().max(400)).max(6),
  client_arguments: z.array(z.string().max(400)).max(6),
  objections: z.array(z.object({ objection: z.string().max(200), answer: z.string().max(400) })).max(4),
  opening_message: z.string().max(1500),
});
export type LeadPitch = z.infer<typeof LeadPitch> & { generated_by: "ai" | "template" };

export type PitchContext = {
  name: string;
  category: string | null;
  city: string | null;
  website: string | null;
  results: CriterionResult[];
  triggers: string[];
  products: { name: string; reasons: string[] }[];
  agencyCredit: string | null;
  studioName: string;
  studioCity: string | null;
};

const byWeight = (results: CriterionResult[]) =>
  results
    .filter((r) => r.met === false && CRITERIA_BY_ID[r.id])
    .sort((a, b) => CRITERIA_BY_ID[b.id].weight - CRITERIA_BY_ID[a.id].weight);

/** Argumentario sin IA, a partir de las plantillas de cada criterio. */
export function templatePitch(ctx: PitchContext): LeadPitch {
  const gaps = byWeight(ctx.results);
  const top = gaps.slice(0, 5);
  const internal = [
    ...top.map((g) => `${CRITERIA_BY_ID[g.id].internal} (${g.evidence.replace(/\.$/, "")})`),
    ...ctx.triggers.map((t) => TRIGGER_BY_ID[t]?.argument).filter(Boolean),
  ];
  if (ctx.agencyCredit && gaps.some((g) => g.id === "updated" || g.id === "modern_tech")) {
    internal.push(`La hizo ${ctx.agencyCredit} y no se ha vuelto a tocar: probablemente ya no hay relación con esa agencia.`);
  }
  const first = top[0];
  const hook = first ? first.evidence.replace(/\.$/, "").replace(/^./, (c) => c.toLowerCase()) : "algunos detalles de vuestra imagen que se pueden mejorar";
  const where = ctx.studioCity ? `, un estudio creativo de ${ctx.studioCity}` : ", un estudio creativo";
  const message = [
    `Hola, equipo de ${ctx.name}:`,
    "",
    `Os escribimos desde ${ctx.studioName}${where}. Ayudamos a negocios como el vuestro con su marca, su web y su presencia en Google, para que la imagen esté a la altura de lo que hacéis.`,
    "",
    `Mirando ${ctx.name} nos hemos fijado en que ${hook}. ${first ? CRITERIA_BY_ID[first.id].client : ""}`.trim(),
    "",
    "¿Os parece si os enseñamos en una llamada corta qué cambiaríamos y cómo quedaría?",
    "",
    `Un saludo,\n${ctx.studioName}`,
  ].join("\n");
  return {
    generated_by: "template",
    summary: [ctx.category, ctx.city].filter(Boolean).join(" · ") || ctx.name,
    brand: null,
    franchise: { likely: false, reason: "" },
    internal_arguments: internal.slice(0, 6),
    client_arguments: top.map((g) => CRITERIA_BY_ID[g.id].client).slice(0, 5),
    objections: [
      { objection: "Ahora mismo no tenemos presupuesto.", answer: "Podemos empezar por lo que más rinde (por ejemplo, la ficha de Google o la versión móvil) y dejar el resto para más adelante." },
      { objection: "Ya tenemos web.", answer: "La idea no es tirarla, sino que trabaje para vosotros: que se vea bien en el móvil, que Google la entienda y que la imagen sea coherente." },
    ],
    opening_message: message,
  };
}

export function pitchSystemPrompt(ctx: PitchContext, hasImages: boolean) {
  const list = (met: boolean | null) =>
    ctx.results
      .filter((r) => r.met === met && CRITERIA_BY_ID[r.id])
      .map((r) => `- ${CRITERIA_BY_ID[r.id].label}: ${r.evidence}`)
      .join("\n") || "- (ninguno)";
  return `Eres el responsable comercial de ${ctx.studioName}, un estudio creativo${ctx.studioCity ? ` de ${ctx.studioCity}` : ""} de branding, diseño y web (estrategia, identidad visual, diseño digital, editorial y packaging). Preparas el argumentario para contactar con un negocio que podría necesitar vuestros servicios.

NEGOCIO
- Nombre: ${ctx.name}
- Actividad: ${ctx.category ?? "desconocida"}
- Localidad: ${ctx.city ?? "desconocida"}
- Web: ${ctx.website ?? "no tiene"}
${ctx.agencyCredit ? `- La web indica que la hizo: ${ctx.agencyCredit}` : ""}

LO QUE NO CUMPLE (oportunidades, ya comprobadas)
${list(false)}

LO QUE SÍ CUMPLE
${list(true)}

SIN COMPROBAR
${list(null)}

SEÑALES DE MOMENTO
${ctx.triggers.map((t) => `- ${TRIGGER_BY_ID[t]?.label ?? t}`).join("\n") || "- (ninguna)"}

PRODUCTOS QUE PODEMOS OFRECER
${ctx.products.map((p) => `- ${p.name}: ${p.reasons.join("; ")}`).join("\n") || "- (ninguno)"}

TAREAS
${hasImages ? `1. brand: valora SOLO a partir de las imágenes adjuntas (captura móvil de la web y, si está, el logotipo):
   - logo_quality: ¿el logotipo es nítido, profesional y bien resuelto? met=false si se ve pixelado, amateur, genérico o anticuado.
   - visual_consistency: ¿colores, tipografías y estilo siguen un sistema coherente? met=false si es un batiburrillo.
   - photo_quality: ¿las fotos son propias y de calidad? met=false si son de banco, borrosas o pobres; null si no hay fotos.
   Evidencia: una frase concreta sobre lo que se ve. Si no puedes juzgar, met=null.` : "1. brand: null (no hay imágenes)."}
2. franchise: ¿parece franquicia o cadena (la marca se decide en una central)? Razónalo en una frase.
3. summary: una o dos frases sobre qué es el negocio.
4. internal_arguments (3–5): por qué es una buena oportunidad para el estudio, basados en los hallazgos y las señales de momento. Concretos, con el dato.
5. client_arguments (3–5): beneficios para ELLOS, en su idioma, sin jerga, conectados con sus hallazgos. Sin promesas de resultados concretos.
6. objections (2–3): objeciones probables y cómo responderlas con naturalidad.
7. opening_message: primer mensaje para enviarles. Estructura obligatoria: (a) presentaros: quiénes somos y de dónde; (b) qué hacemos, en una frase; (c) un hallazgo concreto de su negocio, dicho con tacto y sin criticar; (d) una pregunta concreta y fácil de responder. Tono cercano y profesional, tuteo en plural (vosotros), máximo 120 palabras, firmado por ${ctx.studioName}. Sin precios ni descuentos, sin urgencias falsas, sin mencionar subvenciones ni Kit Digital.

No inventes datos que no estén arriba. No menciones reseñas, valoraciones, número de empleados ni facturación.`;
}
