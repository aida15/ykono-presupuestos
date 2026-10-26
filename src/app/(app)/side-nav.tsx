"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { FileText, Home, LogOut, Menu, Radar, Settings, Shapes, Users, X, Plus } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { buttonClass, cx } from "@/components/ui";
import { signOut } from "@/lib/actions/auth";

const NAV = [
  { href: "/", label: "Inicio", icon: Home, exact: true },
  { href: "/presupuestos", label: "Presupuestos", icon: FileText },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/leads", label: "Leads", icon: Radar },
  { href: "/catalogo", label: "Catálogo y tarifas", icon: Shapes },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

export function SideNav({ productName, email }: { productName: string; email: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));

  const nav = (
    <nav className="flex flex-1 flex-col gap-1">
      <Link href="/presupuestos/nuevo" className={buttonClass("lime", "md", "mb-4 w-full")} onClick={() => setOpen(false)}>
        <Plus size={16} /> Crear presupuesto
      </Link>
      {NAV.map(({ href, label, icon: Icon, exact }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          className={cx(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isActive(href, exact) ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white",
          )}
          aria-current={isActive(href, exact) ? "page" : undefined}
        >
          <Icon size={16} strokeWidth={2} />
          {label}
        </Link>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-white/10 pt-4">
      <p className="truncate text-xs text-white/50" title={email ?? undefined}>
        {email}
      </p>
      <form action={signOut}>
        <button type="submit" className="mt-2 flex items-center gap-2 text-xs font-semibold text-white/70 hover:text-white">
          <LogOut size={14} /> Cerrar sesión
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* Escritorio */}
      <aside className="sticky top-0 hidden h-screen flex-col bg-ink p-5 text-white lg:flex">
        <Link href="/" className="mb-1 block">
          <Wordmark className="h-7 w-auto" color="#fff" />
        </Link>
        <p className="mb-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-lime">
          {productName.replace(/^YKONO\s*/i, "") || "Quote Studio"}
        </p>
        {nav}
        {footer}
      </aside>

      {/* Tablet y móvil */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-ink px-4 py-3 text-white lg:hidden">
        <Link href="/">
          <Wordmark className="h-6 w-auto" color="#fff" />
        </Link>
        <button onClick={() => setOpen(true)} aria-label="Abrir menú" className="p-1">
          <Menu size={22} />
        </button>
      </div>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal>
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-ink p-5 text-white">
            <div className="mb-8 flex items-center justify-between">
              <Wordmark className="h-6 w-auto" color="#fff" />
              <button onClick={() => setOpen(false)} aria-label="Cerrar menú">
                <X size={20} />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      ) : null}
    </>
  );
}
