import "server-only";
import type { MemberContext } from "@/lib/auth";
import { num, type PricingRule, type ServiceCategory, type ServiceQuestion, type ServiceWithRule } from "./types";

export function normalizeRule(r: Record<string, unknown>): PricingRule {
  return {
    ...(r as unknown as PricingRule),
    unit_price_cents: num(r.unit_price_cents),
    hourly_rate_cents: num(r.hourly_rate_cents),
    estimated_hours: num(r.estimated_hours),
    default_quantity: num(r.default_quantity) ?? 100,
    addons: ((r.addons as PricingRule["addons"]) ?? []).map((a) => ({ ...a, price: Number(a.price), qty: Number(a.qty ?? 100) })),
  };
}

export async function getCatalog(ctx: MemberContext, opts: { includeInactive?: boolean } = {}) {
  let servicesQuery = ctx.supabase
    .from("services")
    .select("*, pricing_rules(*)")
    .eq("studio_id", ctx.studioId)
    .eq("pricing_rules.is_current", true)
    .order("sort_order");
  if (!opts.includeInactive) servicesQuery = servicesQuery.eq("active", true);

  const [{ data: categories, error: e1 }, { data: services, error: e2 }] = await Promise.all([
    ctx.supabase.from("service_categories").select("*").eq("studio_id", ctx.studioId).order("sort_order"),
    servicesQuery,
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const withRules: ServiceWithRule[] = (services ?? []).map((s: Record<string, unknown>) => {
    const rules = (s.pricing_rules as Record<string, unknown>[] | null) ?? [];
    const { pricing_rules: _ignored, ...rest } = s;
    void _ignored;
    return { ...(rest as unknown as ServiceWithRule), rule: rules[0] ? normalizeRule(rules[0]) : null };
  });
  return { categories: (categories ?? []) as ServiceCategory[], services: withRules };
}

export async function getQuestions(ctx: MemberContext, opts: { includeInactive?: boolean } = {}) {
  let q = ctx.supabase.from("service_questions").select("*").eq("studio_id", ctx.studioId).order("sort_order");
  if (!opts.includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ServiceQuestion[];
}
