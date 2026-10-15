import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { Mark, Wordmark } from "@/components/brand";

export const metadata: Metadata = { title: "Acceso" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/";
  const noStudio = sp.error === "no-studio";
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Wordmark className="h-10 w-auto" color="#fff" />
        <div>
          <p className="kicker !text-lime">Quote Studio</p>
          <h1 className="mt-3 max-w-md text-5xl font-bold leading-[1.05] tracking-tight">
            Presupuestos claros, con la voz de YKONO.
          </h1>
        </div>
        <Mark className="absolute -right-6 bottom-10 h-72 w-auto" color="#B4E600" />
        <p className="text-sm text-white/50">Herramienta interna · acceso privado</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Wordmark className="mb-10 h-8 w-auto lg:hidden" />
          <h2 className="text-2xl font-bold tracking-tight">Inicia sesión</h2>
          <p className="mt-1 text-sm text-muted">No hay registro público. El acceso lo da de alta la administradora.</p>
          <LoginForm next={next} noStudio={noStudio} />
        </div>
      </section>
    </main>
  );
}
