/**
 * Prueba de integración del esquema: aplica las migraciones reales y el seed sobre
 * PGlite (Postgres en WASM) y verifica RLS, numeración y guardado atómico.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { toSaveBundle, computeDraft } from "@/lib/domain/quote";
import { phasedQuote } from "../fixtures/sample-quotes";

const root = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");

const ALICE = "11111111-1111-4111-8111-111111111111"; // miembro del estudio
const MALLORY = "22222222-2222-4222-8222-222222222222"; // usuaria autenticada sin estudio

let db: PGlite;
let studioId: string;

async function as<T>(userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${userId ? "authenticated" : "anon"}`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ""]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(read("tests/db/supabase-stub.sql"));
  for (const f of readdirSync(path.join(root, "supabase/migrations")).sort()) {
    await db.exec(read(`supabase/migrations/${f}`));
  }
  await db.exec(read("supabase/seed.sql"));
  // Privilegios que Supabase concede por defecto al rol authenticated.
  await db.exec(`
    grant usage on schema public to authenticated, anon;
    grant select, insert, update, delete on all tables in schema public to authenticated, anon;
    grant select, insert, update, delete on storage.objects to authenticated;
    insert into auth.users (id, email) values ('${ALICE}', 'aida@example.com'), ('${MALLORY}', 'otra@example.com');
    select public.add_studio_member('aida@example.com');
  `);
  studioId = (await db.query<{ id: string }>("select id from public.studios")).rows[0].id;
}, 120000);

describe("seed", () => {
  it("carga catálogo, tarifas y preguntas", async () => {
    const r = await db.query<{ s: number; r: number; q: number }>(
      `select (select count(*)::int from services) s, (select count(*)::int from pricing_rules where is_current) r,
              (select count(*)::int from service_questions) q`,
    );
    expect(r.rows[0].s).toBe(40);
    expect(r.rows[0].r).toBe(40);
    expect(r.rows[0].q).toBeGreaterThan(50);
  });
});

describe("RLS", () => {
  it("la miembro ve el catálogo y una usuaria ajena no ve nada", async () => {
    const mine = await as(ALICE, () => db.query("select id from services"));
    expect(mine.rows.length).toBe(40);
    const other = await as(MALLORY, () => db.query("select id from services"));
    expect(other.rows.length).toBe(0);
    const anon = await as(null, () => db.query("select studio_id from studio_settings"));
    expect(anon.rows.length).toBe(0);
  });

  it("una usuaria ajena no puede insertar en el estudio", async () => {
    await expect(
      as(MALLORY, () =>
        db.query(`insert into clients (studio_id, trade_name) values ($1, 'Intruso')`, [studioId]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("las tarifas son inmutables", async () => {
    await expect(
      as(ALICE, () => db.query(`update pricing_rules set unit_price_cents = 1 where is_current`)),
    ).rejects.toThrow(/inmutables/);
  });
});

describe("presupuestos", () => {
  it("numera YK-AAAA-NNN de forma correlativa", async () => {
    const year = new Date().getFullYear();
    const a = await as(ALICE, () => db.query<{ n: string }>(`select next_quote_number($1) n`, [studioId]));
    const b = await as(ALICE, () => db.query<{ n: string }>(`select next_quote_number($1) n`, [studioId]));
    expect(a.rows[0].n).toBe(`YK-${year}-001`);
    expect(b.rows[0].n).toBe(`YK-${year}-002`);
    await expect(as(MALLORY, () => db.query(`select next_quote_number($1)`, [studioId]))).rejects.toThrow(
      /Sin acceso/,
    );
  });

  it("guarda el presupuesto completo de forma atómica y elimina lo que sobra", async () => {
    const quoteId = randomUUID();
    const phaseId = randomUUID();
    const itemA = randomUUID();
    const itemB = randomUUID();
    await as(ALICE, () =>
      db.query(`insert into quotes (id, studio_id, number, title) values ($1, $2, 'YK-TEST-001', 'Prueba')`, [
        quoteId,
        studioId,
      ]),
    );
    const bundle = (items: unknown[]) => ({
      id: quoteId,
      client_id: null,
      project_id: null,
      title: "Prueba guardada",
      issue_date: "2026-10-14",
      validity_days: 30,
      vat_rate_bp: 2100,
      global_discount_bp: 0,
      payment_mode: "percent",
      totals: { total: 121000, taxableBase: 100000, lines: { [itemA]: { net: 100000 } } },
      phases: [{ id: phaseId, name: "Diseño", deliverables: ["Logo"] }],
      items,
      sections: [{ id: randomUUID(), type: "summary", title: "Resumen", content: { body: "Hola" } }],
      payments: [{ id: randomUUID(), label: "Inicio", percent_bp: 10000, net: 100000, total: 121000 }],
    });
    const item = (id: string, name: string) => ({
      id,
      phase_id: phaseId,
      name,
      method: "fixed",
      quantity: 100,
      unit_price: 100000,
      price_status: "approved_rate",
      rule_snapshot: null,
    });
    await as(ALICE, () => db.query(`select save_quote_bundle($1::jsonb)`, [JSON.stringify(bundle([item(itemA, "A"), item(itemB, "B")]))]));
    let rows = await as(ALICE, () => db.query<{ name: string; net_cents: string | null }>(`select name, net_cents from quote_items where quote_id = $1 order by sort_order`, [quoteId]));
    expect(rows.rows.map((r) => r.name)).toEqual(["A", "B"]);

    await as(ALICE, () => db.query(`select save_quote_bundle($1::jsonb)`, [JSON.stringify(bundle([item(itemA, "A editada")]))]));
    rows = await as(ALICE, () => db.query(`select name, net_cents from quote_items where quote_id = $1`, [quoteId]));
    expect(rows.rows).toEqual([{ name: "A editada", net_cents: 100000 }]);

    const q = await as(ALICE, () => db.query<{ title: string; total_cents: number; valid_until: Date }>(`select title, total_cents, valid_until from quotes where id = $1`, [quoteId]));
    expect(q.rows[0].title).toBe("Prueba guardada");
    expect(Number(q.rows[0].total_cents)).toBe(121000);
    expect(new Date(q.rows[0].valid_until).toISOString().slice(0, 10)).toBe("2026-11-13");

    // Un presupuesto definitivo ya no se puede reescribir.
    await as(ALICE, () => db.query(`update quotes set status = 'ready' where id = $1`, [quoteId]));
    await expect(
      as(ALICE, () => db.query(`select save_quote_bundle($1::jsonb)`, [JSON.stringify(bundle([]))])),
    ).rejects.toThrow(/Solo se pueden editar borradores/);

    // Y una usuaria ajena no lo encuentra.
    await expect(
      as(MALLORY, () => db.query(`select save_quote_bundle($1::jsonb)`, [JSON.stringify(bundle([]))])),
    ).rejects.toThrow(/no encontrado/);
  });

  it("impide filas hijas que apunten a otro estudio", async () => {
    const otherStudio = randomUUID();
    await db.query(`insert into studios (id, name) values ($1, 'Otro')`, [otherStudio]);
    const quote = await db.query<{ id: string }>(`select id from quotes limit 1`);
    await expect(
      db.query(`insert into quote_sections (studio_id, quote_id, type) values ($1, $2, 'custom')`, [
        otherStudio,
        quote.rows[0].id,
      ]),
    ).rejects.toThrow(/studio_id no coincide/);
  });
});

describe("ida y vuelta de un presupuesto completo", () => {
  it("guarda el paquete del motor y conserva importes y pagos", async () => {
    const draft = phasedQuote();
    await as(ALICE, () =>
      db.query(`insert into quotes (id, studio_id, number, version) values ($1, $2, $3, $4)`, [draft.id, studioId, draft.number, draft.version]),
    );
    const { bundle, totals } = toSaveBundle(draft);
    await as(ALICE, () => db.query(`select save_quote_bundle($1::jsonb)`, [JSON.stringify(bundle)]));
    const q = await as(ALICE, () => db.query<{ total_cents: string; payment_mode: string }>(`select total_cents, payment_mode from quotes where id = $1`, [draft.id]));
    expect(Number(q.rows[0].total_cents)).toBe(totals.total);
    expect(q.rows[0].payment_mode).toBe("fixed");
    const pays = await as(ALICE, () => db.query<{ total_cents: string }>(`select total_cents from quote_payments where quote_id = $1 order by sort_order`, [draft.id]));
    expect(pays.rows.reduce((a, r) => a + Number(r.total_cents), 0)).toBe(totals.total);
    const items = await as(ALICE, () => db.query<{ n: number }>(`select count(*)::int n from quote_items where quote_id = $1`, [draft.id]));
    expect(items.rows[0].n).toBe(draft.items.length);
    expect(computeDraft(draft).totals.total).toBe(totals.total);
  });
});

describe("storage", () => {
  it("solo permite subir a la carpeta del propio estudio", async () => {
    await as(ALICE, () =>
      db.query(`insert into storage.objects (bucket_id, name) values ('documents', $1)`, [`${studioId}/q/doc.pdf`]),
    );
    await expect(
      as(MALLORY, () =>
        db.query(`insert into storage.objects (bucket_id, name) values ('documents', $1)`, [`${studioId}/q/x.pdf`]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});
