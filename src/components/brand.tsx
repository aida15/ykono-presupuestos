import { LOGO_MARK, LOGO_WORDMARK } from "@/lib/brand/logo-paths";

export function Wordmark({ className, color = "currentColor", title = "ykono." }: { className?: string; color?: string; title?: string }) {
  return (
    <svg viewBox={`0 0 ${LOGO_WORDMARK.width} ${LOGO_WORDMARK.height}`} className={className} role="img" aria-label={title}>
      <path d={LOGO_WORDMARK.d} fill={color} fillRule="evenodd" />
    </svg>
  );
}

export function Mark({ className, color = "currentColor" }: { className?: string; color?: string }) {
  return (
    <svg viewBox={`0 0 ${LOGO_MARK.width} ${LOGO_MARK.height}`} className={className} aria-hidden>
      <path d={LOGO_MARK.d} fill={color} fillRule="evenodd" />
    </svg>
  );
}
