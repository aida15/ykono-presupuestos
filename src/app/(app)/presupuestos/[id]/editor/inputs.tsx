"use client";

import { useState } from "react";
import { cx } from "@/components/ui";

const base =
  "h-9 w-full rounded-md border border-line-strong bg-card px-2 text-sm text-ink focus:border-ink focus:outline-none disabled:bg-surface disabled:text-muted";

function fmt(value: number | null, scale: number, decimals: number) {
  if (value == null) return "";
  return (value / scale).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: decimals, useGrouping: false });
}

function parse(text: string, scale: number): number | null | undefined {
  const t = text.trim();
  if (t === "") return null;
  const n = Number(t.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * scale);
}

/**
 * Input numérico en formato español. Trabaja en enteros escalados:
 * scale=100 → céntimos (euros) o centésimas (cantidades/horas); scale=100 con suffix % → puntos básicos.
 */
export function ScaledInput({
  value,
  onChange,
  scale = 100,
  decimals = 2,
  suffix,
  allowNull = true,
  disabled,
  className,
  placeholder,
  ariaLabel,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  scale?: number;
  decimals?: number;
  suffix?: string;
  allowNull?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(fmt(value, scale, decimals));
  const [focused, setFocused] = useState(false);
  const [seen, setSeen] = useState(value);
  // Sincroniza con cambios externos (deshacer, recálculos) sin pisar lo que se está escribiendo.
  if (!focused && value !== seen) {
    setSeen(value);
    setText(fmt(value, scale, decimals));
  }
  const parsed = parse(text, scale);
  const invalid = parsed === undefined || (!allowNull && parsed === null);
  return (
    <div className="relative">
      <input
        inputMode="decimal"
        aria-label={ariaLabel}
        aria-invalid={invalid}
        disabled={disabled}
        placeholder={placeholder}
        className={cx(base, "tabular text-right", suffix && "pr-6", invalid && "border-danger", className)}
        value={text}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setText(fmt(value, scale, decimals));
        }}
        onChange={(e) => {
          setText(e.target.value);
          const p = parse(e.target.value, scale);
          if (p !== undefined && (allowNull || p !== null)) onChange(p);
        }}
      />
      {suffix ? <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted">{suffix}</span> : null}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  className,
  ...rest
}: { value: string; onChange: (v: string) => void } & Omit<React.ComponentProps<"input">, "value" | "onChange">) {
  return <input className={cx(base, className)} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />;
}

export function TextArea({
  value,
  onChange,
  className,
  rows = 3,
  ...rest
}: { value: string; onChange: (v: string) => void } & Omit<React.ComponentProps<"textarea">, "value" | "onChange">) {
  return (
    <textarea
      rows={rows}
      className={cx("w-full rounded-md border border-line-strong bg-card px-2 py-1.5 text-sm leading-relaxed text-ink focus:border-ink focus:outline-none disabled:bg-surface", className)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    />
  );
}

export function SmallSelect({ className, ...p }: React.ComponentProps<"select">) {
  return <select className={cx(base, "pr-6", className)} {...p} />;
}

/** Lista editable como textarea, una entrada por línea. */
export function LinesInput({
  value,
  onChange,
  rows = 3,
  placeholder,
  disabled,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(value.join("\n"));
  const [focused, setFocused] = useState(false);
  const [seen, setSeen] = useState(value);
  if (!focused && value !== seen) {
    setSeen(value);
    setText(value.join("\n"));
  }
  return (
    <TextArea
      rows={rows}
      placeholder={placeholder}
      disabled={disabled}
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(t) => {
        setText(t);
        onChange(t.split("\n").map((s) => s.trim()).filter(Boolean));
      }}
    />
  );
}
