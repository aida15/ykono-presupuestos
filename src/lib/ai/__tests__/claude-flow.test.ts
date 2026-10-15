import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { z } from "zod";

vi.mock("server-only", () => ({}));

/** API de Anthropic simulada: cada test define cómo responde. */
let handler: (body: Record<string, unknown>) => { status: number; json: unknown };
const calls: Record<string, unknown>[] = [];
let server: http.Server;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw);
      calls.push(body);
      const r = handler(body);
      res.writeHead(r.status, { "content-type": "application/json" });
      res.end(JSON.stringify(r.json));
    });
  });
  await new Promise<void>((ok) => server.listen(0, ok));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.ANTHROPIC_API_KEY = "test-key";
});
afterAll(() => server.close());

const message = (text: string) => ({
  status: 200,
  json: { id: "m", type: "message", role: "assistant", model: "x", stop_reason: "end_turn", content: [{ type: "text", text }], usage: { input_tokens: 1, output_tokens: 1 } },
});
const Schema = z.object({ reply: z.string(), n: z.number().default(0) });

describe("callStructured", () => {
  it("usa salidas estructuradas cuando el modelo las admite", async () => {
    const { callStructured } = await import("../claude");
    calls.length = 0;
    handler = () => message('{"reply":"hola","n":2}');
    const out = await callStructured({ model: "modelo-a", system: "s", messages: [{ role: "user", content: "x" }], toolName: "t", toolDescription: "d", schema: Schema });
    expect(out).toEqual({ reply: "hola", n: 2 });
    expect(calls[0].output_config).toBeTruthy();
    expect(calls[0].tool_choice).toBeUndefined();
  });

  it("si el modelo rechaza el esquema, pasa a JSON en texto y lo recuerda", async () => {
    const { callStructured } = await import("../claude");
    calls.length = 0;
    handler = (b) =>
      b.output_config
        ? { status: 400, json: { type: "error", error: { type: "invalid_request_error", message: "output_config.format: json_schema is not supported for this model." } } }
        : message('Claro:\n```json\n{"reply":"vale"}\n```');
    const out = await callStructured({ model: "modelo-b", system: "s", messages: [{ role: "user", content: "x" }], toolName: "t", toolDescription: "d", schema: Schema });
    expect(out).toEqual({ reply: "vale", n: 0 });
    expect(calls).toHaveLength(2);
    expect(String(calls[1].system)).toMatch(/JSON Schema/);
    // Segunda llamada con el mismo modelo: va directa a texto.
    calls.length = 0;
    await callStructured({ model: "modelo-b", system: "s", messages: [{ role: "user", content: "x" }], toolName: "t", toolDescription: "d", schema: Schema });
    expect(calls).toHaveLength(1);
    expect(calls[0].output_config).toBeUndefined();
  });

  it("reintenta si el JSON no cumple el esquema", async () => {
    const { callStructured } = await import("../claude");
    calls.length = 0;
    let i = 0;
    handler = () => (i++ === 0 ? message('{"n":"no"}') : message('{"reply":"ok"}'));
    const out = await callStructured({ model: "modelo-c", system: "s", messages: [{ role: "user", content: "x" }], toolName: "t", toolDescription: "d", schema: Schema });
    expect(out.reply).toBe("ok");
    expect(calls).toHaveLength(2);
  });
});
