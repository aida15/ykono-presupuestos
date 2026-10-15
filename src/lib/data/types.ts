import type {
  ComplexityConfig,
  ExternalTreatment,
  PaymentMode,
  PriceStatus,
  PricingMethod,
  QuoteStatus,
} from "@/lib/domain/schemas";

export type StudioSettings = {
  studio_id: string;
  product_name: string;
  trade_name: string;
  tagline: string;
  legal_name: string | null;
  tax_id: string | null;
  address_line: string | null;
  postal_code: string | null;
  city: string | null;
  province: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_path: string | null;
  quote_prefix: string;
  default_vat_rate_bp: number;
  default_validity_days: number;
  default_payment_mode: PaymentMode;
  default_payments: { label: string; milestone?: string; due_hint?: string; percent_bp?: number | null; amount?: number | null }[];
  default_payment_terms: string;
  default_conditions: { title: string; text: string }[];
  default_exclusions: string[];
  closing_text: string;
  ai_enabled: boolean;
  ai_model_interview: string;
  ai_model_drafting: string;
  pdf_preferences: { accent?: string; ink?: string; surface?: string; show_cover?: boolean; show_closing?: boolean };
  archive_pdfs: boolean;
};

export type Client = {
  id: string;
  studio_id: string;
  trade_name: string;
  legal_name: string | null;
  tax_id: string | null;
  address_line: string | null;
  postal_code: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  sector: string | null;
  notes: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type ClientContact = {
  id: string;
  client_id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
};

export type ServiceCategory = {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  active: boolean;
};

export type PricingRule = {
  id: string;
  service_id: string;
  version: number;
  method: PricingMethod;
  unit_price_cents: number | null;
  hourly_rate_cents: number | null;
  estimated_hours: number | null;
  default_quantity: number;
  addons: { label: string; price: number; qty: number }[];
  complexity: ComplexityConfig | null;
  default_price_status: PriceStatus;
  notes: string | null;
  is_current: boolean;
  valid_from: string;
  created_at: string;
};

export type Service = {
  id: string;
  category_id: string | null;
  name: string;
  internal_description: string | null;
  commercial_description: string | null;
  unit: string;
  is_external_cost: boolean;
  default_external_treatment: ExternalTreatment | null;
  is_optional_default: boolean;
  default_exclusions: string[];
  default_deliverables: string[];
  complements: string[];
  active: boolean;
  sort_order: number;
};

export type ServiceWithRule = Service & { rule: PricingRule | null };

export type ServiceQuestion = {
  id: string;
  discipline: string;
  service_id: string | null;
  question: string;
  help_text: string | null;
  answer_type: "text" | "number" | "boolean" | "choice" | "multi";
  options: string[];
  condition: Record<string, unknown> | null;
  sort_order: number;
  active: boolean;
};

export type QuoteListRow = {
  id: string;
  number: string;
  version: number;
  status: QuoteStatus;
  title: string;
  issue_date: string;
  valid_until: string;
  total_cents: number;
  taxable_base_cents: number;
  updated_at: string;
  client: { id: string; trade_name: string } | null;
};

/** Normaliza bigint de PostgREST (puede llegar como string) a number. */
export function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
