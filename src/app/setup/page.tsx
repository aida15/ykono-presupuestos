import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { Wordmark } from "@/components/brand";

export const metadata = { title: "Puesta en marcha" };
export const dynamic = "force-dynamic";

/** Se muestra solo si faltan las variables de Supabase. */
export default function SetupPage() {
  if (isSupabaseConfigured()) redirect("/");
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Wordmark className="h-8 w-auto" />
      <h1 className="mt-10 text-3xl font-bold tracking-tight">Falta conectar Supabase</h1>
      <p className="mt-2 text-muted">La aplicación está desplegada pero no encuentra las variables de entorno.</p>
      <ol className="mt-8 list-decimal space-y-3 pl-5 text-sm leading-relaxed">
        <li>Crea un proyecto en Supabase y aplica las migraciones de <code>supabase/migrations</code> y <code>supabase/seed.sql</code>.</li>
        <li>
          Añade en Vercel (o en <code>.env.local</code>) <code>NEXT_PUBLIC_SUPABASE_URL</code> y <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
        </li>
        <li>Para la IA, añade <code>ANTHROPIC_API_KEY</code> (solo servidor).</li>
        <li>Crea la usuaria en Authentication → Users y ejecuta <code>supabase/bootstrap.sql</code>.</li>
      </ol>
      <p className="mt-8 text-sm text-muted">Los pasos detallados están en el README del repositorio.</p>
    </main>
  );
}
