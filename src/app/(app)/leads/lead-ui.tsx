import { Badge, cx } from "@/components/ui";

export const LEAD_STATUS_LABEL: Record<string, string> = {
  new: "Nuevo",
  analyzed: "Analizado",
  contacted: "Contactado",
  replied: "Ha respondido",
  converted: "Presupuesto",
  discarded: "Descartado",
};

const STATUS_TONE: Record<string, "neutral" | "lime" | "dark" | "warn" | "danger" | "info"> = {
  new: "neutral",
  analyzed: "info",
  contacted: "dark",
  replied: "warn",
  converted: "lime",
  discarded: "neutral",
};

export function LeadStatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{LEAD_STATUS_LABEL[status] ?? status}</Badge>;
}

export function levelOf(score: number | null) {
  if (score === null) return null;
  return score >= 55 ? "alta" : score >= 30 ? "media" : "baja";
}

/** Puntuación de oportunidad: cuanto más alta, más hay que mejorar. */
export function ScoreBadge({ score, size = "sm" }: { score: number | null; size?: "sm" | "lg" }) {
  const level = levelOf(score);
  if (level === null) return <span className="text-xs text-muted">Sin analizar</span>;
  const cls = level === "alta" ? "bg-lime text-ink" : level === "media" ? "bg-ink text-white" : "bg-surface text-muted border border-line";
  return (
    <span
      className={cx("tabular inline-flex items-center justify-center rounded-full font-bold", cls, size === "lg" ? "h-20 w-20 text-3xl" : "h-8 min-w-12 px-2 text-sm")}
      title={`Oportunidad ${level}`}
    >
      {score}
    </span>
  );
}

export function hostOf(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
