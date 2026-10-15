import { redirect } from "next/navigation";
import { isSupabaseConfigured, supabaseDiagnostics } from "@/lib/env";
import { Wordmark } from "@/components/brand";

export const metadata = { title: "Puesta en marcha" };
export const dynamic = "force-dynamic";

function Row({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <li className="flex items-start gap-3 border-b border-line py-3 last:border-0">
      <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${ok ? "bg-lime text-ink" : "bg-danger text-white"}`}>
        {ok ? "✓" : "!"}
      </span>
      <div>
        <p className="font-semibold">{label}</p>
        <p className="text-sm text-muted">{detail}</p>
      </div>
    </li>
  );
}

/** Se muestra solo si faltan o no son válidas las variables de Supabase. */
export default function SetupPage() {
  if (isSupabaseConfigured()) redirect("/");
  const d = supabaseDiagnostics();
  const aiKey = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Wordmark className="h-8 w-auto" />
      <h1 className="mt-10 text-3xl font-bold tracking-tight">Falta conectar Supabase</h1>
      <p className="mt-2 text-muted">
        La aplicación está desplegada pero no puede usar las variables de entorno de Supabase.
        {d.vercelEnv ? ` Entorno de Vercel: ${d.vercelEnv}.` : ""}
      </p>

      <ul className="mt-8 rounded-xl border border-line bg-card px-4">
        <Row
          label="URL de Supabase"
          ok={Boolean(d.urlSource) && !d.problems.some((p) => p.includes("URL"))}
          detail={d.urlSource ? `Leída de ${d.urlSource}${d.host ? ` → ${d.host}` : ""}` : "No encontrada"}
        />
        <Row label="Clave pública (anon / publishable)" ok={Boolean(d.keySource) && !d.problems.some((p) => p.includes("clave") || p.includes("KEY"))} detail={d.keySource ? `Leída de ${d.keySource}` : "No encontrada"} />
        <Row label="ANTHROPIC_API_KEY (opcional)" ok={aiKey} detail={aiKey ? "Configurada" : "Sin configurar: la entrevista funcionará en modo guiado"} />
      </ul>

      {d.problems.length ? (
        <div className="mt-6 rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          <p className="font-semibold">Qué hay que corregir</p>
          <ul className="mt-1 list-disc pl-5">
            {d.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <h2 className="mt-10 font-bold">Cómo arreglarlo en Vercel</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
        <li>
          Project → Settings → Environment Variables: crea <code>SUPABASE_URL</code> (https://xxxx.supabase.co) y <code>SUPABASE_ANON_KEY</code>, marcadas para{" "}
          <strong>Production, Preview y Development</strong>.
        </li>
        <li>
          Deployments → el último → «⋯» → <strong>Redeploy</strong>. Las variables nuevas no se aplican a despliegues ya hechos.
        </li>
        <li>Abre la URL de producción del proyecto (no la de un despliegue antiguo).</li>
      </ol>
    </main>
  );
}
