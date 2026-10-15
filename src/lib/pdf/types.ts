import type { QuoteDraft } from "@/lib/domain/quote";
import type { QuoteTotals } from "@/lib/domain/pricing";
import type { PaymentSchedule } from "@/lib/domain/payments";

export type PdfStudio = {
  trade_name: string;
  tagline: string;
  legal_name: string | null;
  tax_id: string | null;
  address_line: string | null;
  postal_code: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  closing_text: string;
  accent: string;
  show_cover: boolean;
  show_closing: boolean;
};

export type PdfClient = {
  trade_name: string;
  legal_name: string | null;
  tax_id: string | null;
  address_line: string | null;
  postal_code: string | null;
  city: string | null;
  province: string | null;
} | null;

/** Todo lo que necesita la plantilla. La plantilla no calcula: solo pinta estos datos. */
export type PdfData = {
  draft: QuoteDraft;
  totals: QuoteTotals;
  schedule: PaymentSchedule;
  client: PdfClient;
  studio: PdfStudio;
  /** data URL PNG/JPG si el estudio subió un logotipo propio */
  customLogo: string | null;
  /** "preview" añade marca de agua de borrador */
  mode: "preview" | "final";
  generatedAt: string;
};
