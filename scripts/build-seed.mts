/**
 * Genera supabase/seed.sql a partir de src/lib/catalog/seed-data.ts.
 * Uso: npm run seed:build
 * IDs deterministas (md5 del identificador) para que el seed sea idempotente.
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { SEED_CATALOG, SEED_QUESTIONS, SEED_SETTINGS } from "../src/lib/catalog/seed-data.ts";

const uuid = (key: string) => {
  const h = createHash("md5").update(`ykono:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const q = (v: unknown): string => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return `'${String(v).replace(/'/g, "''")}'`;
};
const j = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;
const cents = (euros: number) => Math.round(euros * 100);

export const STUDIO_ID = uuid("studio");
const out: string[] = [
  "-- Generado por scripts/build-seed.mts — no editar a mano.",
  "-- Catálogo inicial y configuración de YKONO. Idempotente.",
  "begin;",
  `insert into public.studios (id, name) values (${q(STUDIO_ID)}, 'YKONO') on conflict (id) do nothing;`,
];

const s = SEED_SETTINGS;
out.push(
  `insert into public.studio_settings (studio_id, product_name, trade_name, tagline, address_line, postal_code, city, province, phone, email, website, quote_prefix, default_vat_rate_bp, default_validity_days, default_payment_mode, default_payments, default_payment_terms, default_conditions, default_exclusions, closing_text, pdf_preferences)
values (${q(STUDIO_ID)}, ${q(s.product_name)}, ${q(s.trade_name)}, ${q(s.tagline)}, ${q(s.address_line)}, ${q(s.postal_code)}, ${q(s.city)}, ${q(s.province)}, ${q(s.phone)}, ${q(s.email)}, ${q(s.website)}, ${q(s.quote_prefix)}, ${s.default_vat_rate_bp}, ${s.default_validity_days}, ${q(s.default_payment_mode)}, ${j(s.default_payments)}, ${q(s.default_payment_terms)}, ${j(s.default_conditions)}, ${j(s.default_exclusions)}, ${q(s.closing_text)}, ${j(s.pdf_preferences)})
on conflict (studio_id) do nothing;`,
);

const keyToId = new Map<string, string>();
for (const cat of SEED_CATALOG) for (const svc of cat.services) keyToId.set(svc.key, uuid(`service:${svc.key}`));

SEED_CATALOG.forEach((cat, ci) => {
  const catId = uuid(`category:${cat.key}`);
  out.push(
    `insert into public.service_categories (id, studio_id, name, slug, description, sort_order) values (${q(catId)}, ${q(STUDIO_ID)}, ${q(cat.name)}, ${q(cat.key)}, ${q(cat.description)}, ${ci}) on conflict (id) do nothing;`,
  );
  cat.services.forEach((svc, si) => {
    const id = keyToId.get(svc.key)!;
    const r = svc.rule;
    const external = r.method === "external";
    out.push(
      `insert into public.services (id, studio_id, category_id, name, internal_description, commercial_description, unit, is_external_cost, default_external_treatment, is_optional_default, default_exclusions, default_deliverables, complements, sort_order)
values (${q(id)}, ${q(STUDIO_ID)}, ${q(catId)}, ${q(svc.name)}, ${q(svc.internal ?? null)}, ${q(svc.commercial)}, ${q(svc.unit)}, ${external}, ${external ? q(r.treatment) : "null"}, ${svc.optional ?? false}, ${j(svc.exclusions ?? [])}, ${j(svc.deliverables ?? [])}, ${j((svc.complements ?? []).map((k) => keyToId.get(k)).filter(Boolean))}, ${si})
on conflict (id) do nothing;`,
    );
    let unitPrice: number | null = null;
    let hourly: number | null = null;
    let hours: number | null = null;
    let qty = 100;
    let addons: unknown[] = [];
    let complexity: unknown = null;
    let status = "approved_rate";
    switch (r.method) {
      case "fixed":
        unitPrice = cents(r.price);
        status = r.status ?? status;
        break;
      case "per_unit":
        unitPrice = cents(r.price);
        qty = Math.round((r.qty ?? 1) * 100);
        break;
      case "hourly":
        hourly = cents(r.rate);
        hours = Math.round(r.hours * 100);
        status = r.status ?? status;
        break;
      case "base_plus_addons":
        unitPrice = cents(r.price);
        addons = r.addons.map((a) => ({ label: a.label, price: cents(a.price), qty: Math.round((a.qty ?? 1) * 100) }));
        break;
      case "complexity":
        unitPrice = cents(r.price);
        complexity = {
          levels: r.levels.map((l) => ({ key: l.key, label: l.label, factor_bp: Math.round(l.factor * 10000) })),
          default_level: r.default_level,
        };
        break;
      case "external":
        unitPrice = r.price == null ? null : cents(r.price);
        status = r.price == null ? "pending_valuation" : "approved_rate";
        break;
    }
    out.push(
      `insert into public.pricing_rules (id, studio_id, service_id, version, method, unit_price_cents, hourly_rate_cents, estimated_hours, default_quantity, addons, complexity, default_price_status, notes)
values (${q(uuid(`rule:${svc.key}:1`))}, ${q(STUDIO_ID)}, ${q(id)}, 1, ${q(r.method)}, ${q(unitPrice)}, ${q(hourly)}, ${q(hours)}, ${qty}, ${j(addons)}, ${complexity ? j(complexity) : "null"}, ${q(status)}, 'Tarifa inicial propuesta (octubre 2026). Revisar.')
on conflict (id) do nothing;`,
    );
  });
});

SEED_QUESTIONS.forEach((qq, i) => {
  out.push(
    `insert into public.service_questions (id, studio_id, discipline, question, help_text, answer_type, options, sort_order) values (${q(uuid(`question:${i}`))}, ${q(STUDIO_ID)}, ${q(qq.discipline)}, ${q(qq.question)}, ${q(qq.help ?? null)}, ${q(qq.answer_type ?? "text")}, ${j(qq.options ?? [])}, ${i}) on conflict (id) do nothing;`,
  );
});

out.push("commit;", "");
writeFileSync(new URL("../supabase/seed.sql", import.meta.url), out.join("\n"));
console.log(`seed.sql generado: ${SEED_CATALOG.reduce((a, c) => a + c.services.length, 0)} servicios, ${SEED_QUESTIONS.length} preguntas`);
