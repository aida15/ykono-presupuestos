import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));
const { toStructuredSchema, extractJson } = await import("../claude");
const { StatePatch } = await import("@/lib/interview/state");
const { ProposalText } = await import("@/lib/interview/draft");

describe("toStructuredSchema", () => {
  it("cierra objetos y quita palabras clave de validación", () => {
    const s = toStructuredSchema(z.toJSONSchema(z.object({ a: z.string().max(10).default(""), b: z.array(z.string()).max(3) }), { io: "input" })) as Record<string, unknown>;
    const json = JSON.stringify(s);
    expect(s.additionalProperties).toBe(false);
    expect(json).not.toMatch(/maxLength|maxItems|"default"|\$schema/);
  });

  it("procesa los esquemas reales de la entrevista y la redacción", () => {
    for (const schema of [StatePatch, ProposalText]) {
      const json = JSON.stringify(toStructuredSchema(z.toJSONSchema(schema, { io: "input" })));
      expect(json).not.toMatch(/maxLength|"default"/);
    }
  });
});

describe("extractJson", () => {
  it("lee JSON suelto o dentro de un bloque de código", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('Aquí va:\n```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(() => extractJson("sin json")).toThrow();
  });
});
