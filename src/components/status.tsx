import { Badge } from "./ui";
import { PRICE_STATUS_LABEL, QUOTE_STATUS_LABEL, type PriceStatus, type QuoteStatus } from "@/lib/domain/schemas";

const quoteTone: Record<QuoteStatus, "neutral" | "lime" | "dark" | "warn" | "danger" | "info"> = {
  draft: "neutral",
  ready: "info",
  sent: "dark",
  accepted: "lime",
  rejected: "danger",
  archived: "neutral",
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <Badge tone={quoteTone[status]}>{QUOTE_STATUS_LABEL[status]}</Badge>;
}

const priceTone: Record<PriceStatus, "lime" | "warn" | "info" | "danger"> = {
  approved_rate: "lime",
  manual_approved: "info",
  estimate_pending: "warn",
  pending_valuation: "danger",
};

export function PriceStatusBadge({ status, short }: { status: PriceStatus; short?: boolean }) {
  const shortLabel: Record<PriceStatus, string> = {
    approved_rate: "Tarifa",
    manual_approved: "Manual",
    estimate_pending: "Estimación",
    pending_valuation: "Sin valorar",
  };
  return (
    <Badge tone={priceTone[status]} className={status === "estimate_pending" ? "border-dashed" : undefined}>
      {short ? shortLabel[status] : PRICE_STATUS_LABEL[status]}
    </Badge>
  );
}
