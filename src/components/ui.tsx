/**
 * Componentes base de la interfaz. Se han escrito a mano con Tailwind en lugar de
 * generar shadcn/ui: son pocos, sin dependencias extra y con la estética de YKONO.
 */
import Link from "next/link";
import { forwardRef, type ComponentProps, type ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "lime" | "danger";
type Size = "sm" | "md";

const variantCls: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink-2 disabled:bg-ink/40",
  lime: "bg-lime text-ink hover:brightness-95 disabled:opacity-50",
  secondary: "bg-card text-ink border border-line-strong hover:bg-surface disabled:opacity-50",
  ghost: "text-ink hover:bg-ink/5 disabled:opacity-40",
  danger: "bg-card text-danger border border-danger/30 hover:bg-danger-soft disabled:opacity-50",
};
const sizeCls: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center rounded-lg font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed",
    variantCls[variant],
    sizeCls[size],
    extra,
  );
}

export const Button = forwardRef<HTMLButtonElement, ComponentProps<"button"> & { variant?: Variant; size?: Size }>(
  function Button({ variant = "primary", size = "md", className, type = "button", ...props }, ref) {
    return <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...props} />;
  },
);

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

const fieldCls =
  "w-full rounded-lg border border-line-strong bg-card px-3 text-sm text-ink placeholder:text-muted/70 focus:border-ink focus:outline-none disabled:bg-surface disabled:text-muted";

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cx(fieldCls, "h-10", className)} {...p} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(function Textarea(
  { className, rows = 3, ...p },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cx(fieldCls, "py-2 leading-relaxed", className)} {...p} />;
});

export const Select = forwardRef<HTMLSelectElement, ComponentProps<"select">>(function Select({ className, ...p }, ref) {
  return <select ref={ref} className={cx(fieldCls, "h-10 pr-8", className)} {...p} />;
});

export function Field({
  label,
  hint,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink-3">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

type Tone = "neutral" | "lime" | "dark" | "warn" | "danger" | "info";
const toneCls: Record<Tone, string> = {
  neutral: "bg-surface text-ink-3 border-line",
  lime: "bg-lime-soft text-lime-ink border-lime/50",
  dark: "bg-ink text-white border-ink",
  warn: "bg-warn-soft text-warn border-warn/30",
  danger: "bg-danger-soft text-danger border-danger/30",
  info: "bg-info-soft text-info border-info/20",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        toneCls[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-[var(--radius-card)] border border-line bg-card", className)}>{children}</div>;
}

export function PageHeader({
  kicker,
  title,
  actions,
  children,
}: {
  kicker?: string;
  title: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {kicker ? <p className="kicker mb-2">{kicker}</p> : null}
        <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
        {children ? <div className="mt-2 text-sm text-muted">{children}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line-strong bg-card/60 px-6 py-12 text-center">
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1 max-w-md text-sm text-muted">{children}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Alert({ tone = "warn", title, children }: { tone?: "warn" | "danger" | "info" | "lime"; title?: string; children: ReactNode }) {
  const cls = {
    warn: "border-warn/30 bg-warn-soft text-warn",
    danger: "border-danger/30 bg-danger-soft text-danger",
    info: "border-info/20 bg-info-soft text-info",
    lime: "border-lime/60 bg-lime-soft text-lime-ink",
  }[tone];
  return (
    <div className={cx("rounded-lg border px-3 py-2 text-[13px]", cls)} role={tone === "danger" ? "alert" : "status"}>
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={title ? "mt-0.5" : ""}>{children}</div>
    </div>
  );
}
