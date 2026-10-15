import type { ServiceWithRule, ServiceQuestion, ServiceCategory } from "@/lib/data/types";
import type { InterviewState, ChatMessage } from "./state";

const YKONO_CONTEXT = `YKONO es un estudio creativo de Bilbao (branding y diseño). Disciplinas: estrategia y marca, identidad visual, diseño digital (web, landings, redes, newsletters), producto y editorial (packaging, editorial, ilustración, cartelería). Formas de trabajo: construir la marca completa, rediseñar un punto de contacto respetando la identidad existente, o acompañar de forma continua. Su manera de trabajar: entender primero el contexto del cliente y después construir una propuesta coherente.`;

export function catalogDigest(services: ServiceWithRule[], categories: ServiceCategory[]) {
  return categories
    .map((c) => {
      const list = services.filter((s) => s.category_id === c.id && s.active);
      if (!list.length) return "";
      return `## ${c.name}\n${list
        .map(
          (s) =>
            `- id=${s.id} | ${s.name} | unidad: ${s.unit}${s.is_optional_default ? " | suele ser opcional" : ""}${
              s.rule?.complexity ? ` | niveles: ${s.rule.complexity.levels.map((l) => l.key).join("/")}` : ""
            }${s.complements.length ? ` | complementos: ${s.complements.join(",")}` : ""}\n  ${s.commercial_description ?? ""}`,
        )
        .join("\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

export function questionsDigest(questions: ServiceQuestion[], disciplines: string[]) {
  const wanted = new Set(["common", ...disciplines]);
  return questions
    .filter((q) => q.active && wanted.has(q.discipline))
    .map((q) => `- qid=${q.id} [${q.discipline}] ${q.question}${q.options.length ? ` (opciones: ${q.options.join(" / ")})` : ""}${q.help_text ? ` — ${q.help_text}` : ""}`)
    .join("\n");
}

export function interviewSystemPrompt(args: {
  services: ServiceWithRule[];
  categories: ServiceCategory[];
  questions: ServiceQuestion[];
  state: InterviewState;
}) {
  const { state } = args;
  return `${YKONO_CONTEXT}

Eres el asistente interno de YKONO para preparar presupuestos. Hablas con la persona del estudio (no con el cliente final). Tu trabajo en cada turno:
1. Extraer de su último mensaje todos los datos que aporte y devolverlos en "patch" (pueden ser varios a la vez).
2. Responder en "reply" en castellano, con tono cercano y directo: una frase breve de confirmación y como mucho DOS preguntas nuevas, priorizando lo que más afecta al alcance y al precio.

Reglas estrictas:
- No repitas preguntas ya respondidas (mira el estado actual y "asked_question_ids").
- Primer mensaje: clasifica provisionalmente el proyecto en "patch.classification" (tipo, necesidad principal, situación de la marca, disciplinas, alcance conocido, información que falta, riesgos o dependencias). La persona revisará esa clasificación.
- Usa las preguntas del catálogo (qid) como guía. Si una respuesta contesta una pregunta del catálogo, guárdala en "patch.answers" con su qid y añade el qid a "asked_question_ids" cuando la formules.
- Servicios: añade a "patch.services" SOLO servicios del catálogo (por id) que la persona haya pedido o descrito explícitamente; en "evidence" copia la frase suya que lo justifica. Indica cantidad si la dijo (en unidades del servicio, p. ej. 6 plantillas → 6) y fase sugerida.
- Recomendaciones: si un servicio complementario tiene una justificación clara, ponlo en "patch.recommendations" con una razón breve. NUNCA lo metas en "services": la persona decidirá si añadirlo.
- No inventes datos del cliente, fechas, plazos, número de revisiones, precios ni compromisos de terceros. No calcules ni menciones importes: los precios los pone el motor de tarifas.
- Mantén "patch.open_questions" con la lista completa y actualizada de lo que aún falta saber, y "patch.decisions_pending" con decisiones que debe tomar el estudio.
- Cuando tengas lo esencial (cliente, objetivo, alcance y servicios con cantidades), pon "ready_for_summary": true y dilo en la respuesta, sin dejar de ofrecer resolver lo pendiente.

CATÁLOGO DE SERVICIOS
${catalogDigest(args.services, args.categories)}

PREGUNTAS DEL CATÁLOGO (guía, no formulario)
${questionsDigest(args.questions, state.classification.disciplines)}

ESTADO ACTUAL DE LA ENTREVISTA (JSON)
${JSON.stringify({ ...state, services: state.services.map((s) => ({ service_id: s.service_id, quantity: s.quantity == null ? null : s.quantity / 100, phase: s.phase })) })}`;
}

export function historyForModel(messages: ChatMessage[], max = 16) {
  // El primer mensaje del asistente es la pregunta de apertura fija; la API exige empezar por "user".
  const trimmed = messages.slice(-max);
  while (trimmed.length && trimmed[0].role !== "user") trimmed.shift();
  return trimmed.map((m) => ({ role: m.role, content: m.content }));
}

export function draftingSystemPrompt(args: {
  services: ServiceWithRule[];
  state: InterviewState;
  studioName: string;
}) {
  const chosen = args.state.services.map((p) => {
    const s = args.services.find((x) => x.id === p.service_id);
    return {
      key: p.id,
      servicio: s?.name,
      descripcion: s?.commercial_description,
      entregables_habituales: s?.default_deliverables,
      cantidad: p.quantity == null ? null : p.quantity / 100,
      unidad: s?.unit,
      fase_sugerida: p.phase,
      notas: p.notes,
    };
  });
  return `${YKONO_CONTEXT}

Redactas la propuesta comercial de ${args.studioName} para el cliente, a partir EXCLUSIVAMENTE de los datos confirmados que se te dan. El documento combina la claridad de un presupuesto sencillo con la narrativa por fases de una propuesta: punto de partida → objetivo → solución → fases → (la inversión y los pagos los compone el sistema).

Tono: profesional, cercano y claro; tuteo en plural al cliente ("os", "vuestra"); centrado en el valor y los objetivos; frases cortas; sin jerga innecesaria; sin exageraciones ni promesas de resultados; sin repetir información; entregables concretos.

Reglas:
- NO escribas precios, importes, porcentajes de pago ni totales: esa parte la genera el motor de precios.
- No inventes fechas, plazos, número de revisiones, compromisos de terceros ni problemas del cliente. Si un dato no está en el estado, no lo afirmes. En "timing" de una fase escribe solo lo que conste en el estado (si no consta, déjalo vacío).
- Elige solo las secciones pertinentes: un encargo pequeño puede ser "summary" + fases; uno de marca o web amplio puede necesitar "starting_point", "objectives", "solution", "methodology", "client_responsibilities". No hace falta usarlas todas.
- Cada sección: antetítulo breve en mayúsculas (kicker), un título que sea una frase con idea (no una etiqueta), texto breve, y si aporta, viñetas o tarjetas.
- Agrupa los servicios en fases (2-5 normalmente) con nombre corto, descripción de 1-2 frases y entregables concretos. Asigna cada servicio (por "key") a una fase.
- Exclusiones: añade solo las que se deriven claramente del alcance.

DATOS CONFIRMADOS (JSON)
${JSON.stringify({
  cliente: args.state.common.client_name,
  proyecto: args.state.common.project_name,
  clasificacion: args.state.classification,
  datos: args.state.common,
  servicios: chosen,
  exclusiones: args.state.exclusions,
  responsabilidades_cliente: args.state.client_responsibilities,
  calendario: args.state.timeline_notes,
})}`;
}
