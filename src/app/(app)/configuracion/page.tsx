import { requireMember } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { Card, PageHeader } from "@/components/ui";
import { Wordmark } from "@/components/brand";
import { SettingsForm } from "./settings-form";
import { LogoForm } from "./logo-form";

export const metadata = { title: "Configuración" };

export default async function SettingsPage() {
  const ctx = await requireMember();
  const settings = await getSettings(ctx);
  let logoUrl: string | null = null;
  if (settings.logo_path) {
    const { data } = await ctx.supabase.storage.from("brand").createSignedUrl(settings.logo_path, 600);
    logoUrl = data?.signedUrl ?? null;
  }
  const aiKeyConfigured = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 lg:px-10 lg:py-10">
      <PageHeader kicker="Configuración" title="Estudio y documentos">
        Estos valores se usan por defecto en los presupuestos nuevos. Los ya guardados no cambian.
      </PageHeader>
      <Card className="mb-6 p-6">
        <h2 className="kicker mb-4">Logotipo</h2>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex h-20 w-48 items-center justify-center rounded-lg bg-surface p-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logotipo personalizado" className="max-h-full max-w-full object-contain" />
            ) : (
              <Wordmark className="h-8 w-auto" />
            )}
          </div>
          <LogoForm hasCustom={Boolean(settings.logo_path)} />
        </div>
        <p className="mt-3 text-xs text-muted">
          Por defecto se usa el logotipo vectorial de YKONO extraído de los documentos oficiales. Puedes sustituirlo por un PNG o JPG.
        </p>
      </Card>
      <SettingsForm settings={settings} aiKeyConfigured={aiKeyConfigured} />
    </main>
  );
}
