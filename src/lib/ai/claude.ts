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

/**
 * Pide al modelo que responda llamando a una herramienta con un esquema concreto
 * (salida estructurada) y valida el resultado con Zod. Reintenta una vez si el
 * resultado no cumple el esquema, indicando al modelo el error.
 */
export async function callStructured<S extends z.ZodType>(opts: {
  model: string;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  toolName: string;
  toolDescription: string;
  schema: S;
  maxTokens?: number;
}): Promise<z.output<S>> {
  const { $schema: _drop, ...jsonSchema } = z.toJSONSchema(opts.schema, { io: "input", target: "draft-2020-12" }) as Record<string, unknown>;
  void _drop;
  const inputSchema = jsonSchema as Anthropic.Tool.InputSchema;
  const tool: Anthropic.Tool = { name: opts.toolName, description: opts.toolDescription, input_schema: inputSchema };
  const messages: Anthropic.MessageParam[] = opts.messages.map((m) => ({ role: m.role, content: m.content }));

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await getClient().messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 4096,
      system: opts.system,
      messages,
      tools: [tool],
      tool_choice: { type: "tool", name: opts.toolName },
    });
    const block = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === opts.toolName);
    if (!block) throw new Error("El modelo no devolvió una respuesta estructurada");
    const parsed = opts.schema.safeParse(block.input);
    if (parsed.success) return parsed.data;
    if (attempt === 0) {
      messages.push(
        { role: "assistant", content: res.content },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: block.id,
              is_error: true,
              content: `La respuesta no cumple el esquema: ${parsed.error.issues
                .slice(0, 5)
                .map((i) => `${i.path.join(".")}: ${i.message}`)
                .join("; ")}. Vuelve a llamar a la herramienta corrigiéndolo.`,
            },
          ],
        },
      );
      continue;
    }
    throw new Error("La respuesta de la IA no tiene el formato esperado");
  }
  throw new Error("Sin respuesta de la IA");
}
