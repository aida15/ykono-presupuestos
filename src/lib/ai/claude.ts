import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/** La clave vive solo en el servidor (variable de entorno). Nunca en BD ni en el cliente. */
export function aiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY no configurada");
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 90_000 });
  return client;
}

type Strategy = "structured" | "text";
/** Modelos que han rechazado las salidas estructuradas: se recuerda para no repetir el intento. */
const structuredUnsupported = new Set<string>();

/**
 * Adapta el JSON Schema de Zod a lo que aceptan las salidas estructuradas:
 * objetos cerrados y sin palabras clave de validación (la validación real la hace Zod después).
 */
export function toStructuredSchema(schema: unknown): unknown {
  const DROP = new Set(["$schema", "default", "minLength", "maxLength", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "maxItems", "pattern", "format", "propertyNames"]);
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (DROP.has(k)) continue;
      if (k === "minItems" && typeof v === "number" && v > 1) continue;
      out[k] = k === "properties" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [pk, walk(pv)])) : walk(v);
    }
    if (out.type === "object" && out.properties && out.additionalProperties === undefined) out.additionalProperties = false;
    return out;
  };
  return walk(schema);
}

/** Extrae el primer objeto JSON de un texto (por si el modelo lo envuelve en ```json). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("La respuesta no contiene JSON");
  return JSON.parse(body.slice(start, end + 1));
}

function isFormatRejection(e: unknown) {
  return e instanceof Anthropic.BadRequestError && /output_config|output_format|json_schema|schema|structured/i.test(e.message);
}

/**
 * Pide al modelo una respuesta con forma fija y la valida con Zod.
 * 1) Salidas estructuradas (output_config.format) si el modelo las admite.
 * 2) Si no, JSON en texto siguiendo el esquema.
 * En ambos casos reintenta una vez indicando el error de validación.
 */
export async function callStructured<S extends z.ZodType>(opts: {
  model: string;
  system: string;
  messages: { role: "user" | "assistant"; content: string | Anthropic.ContentBlockParam[] }[];
  /** Nombre lógico de la respuesta (para mensajes y registros). */
  toolName: string;
  toolDescription: string;
  schema: S;
  maxTokens?: number;
}): Promise<z.output<S>> {
  const jsonSchema = z.toJSONSchema(opts.schema, { io: "input", target: "draft-2020-12" });
  let strategy: Strategy = structuredUnsupported.has(opts.model) ? "text" : "structured";

  const textInstructions = `\n\nFORMATO DE RESPUESTA (${opts.toolName}): ${opts.toolDescription}\nResponde ÚNICAMENTE con un objeto JSON válido que cumpla este JSON Schema, sin texto antes ni después:\n${JSON.stringify(toStructuredSchema(jsonSchema))}`;

  const messages: Anthropic.MessageParam[] = opts.messages.map((m) => ({ role: m.role, content: m.content }));
  let lastError = "";

  for (let attempt = 0; attempt < 3; attempt++) {
    let text: string;
    try {
      const res = await getClient().messages.create({
        model: opts.model,
        max_tokens: opts.maxTokens ?? 4096,
        system: strategy === "text" ? opts.system + textInstructions : opts.system,
        messages,
        ...(strategy === "structured"
          ? { output_config: { format: { type: "json_schema" as const, schema: toStructuredSchema(jsonSchema) as Record<string, unknown> } } }
          : {}),
      });
      text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      if (res.stop_reason === "max_tokens") throw new Error("La respuesta de la IA se cortó (demasiado larga)");
    } catch (e) {
      if (strategy === "structured" && isFormatRejection(e)) {
        console.warn(`[ai] ${opts.model} no acepta salidas estructuradas; se usa JSON en texto`, (e as Error).message);
        structuredUnsupported.add(opts.model);
        strategy = "text";
        continue;
      }
      throw e;
    }

    let candidate: unknown;
    try {
      candidate = extractJson(text);
    } catch {
      lastError = "la respuesta no era JSON";
      candidate = undefined;
    }
    if (candidate !== undefined) {
      const parsed = opts.schema.safeParse(candidate);
      if (parsed.success) return parsed.data;
      lastError = parsed.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`)
        .join("; ");
    }
    messages.push(
      { role: "assistant", content: text || "(vacío)" },
      { role: "user", content: `Tu respuesta no cumple el formato: ${lastError}. Devuelve de nuevo SOLO el objeto JSON corregido.` },
    );
  }
  throw new Error(`La respuesta de la IA no tiene el formato esperado (${lastError})`);
}
