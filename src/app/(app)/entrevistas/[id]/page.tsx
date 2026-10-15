import { notFound, redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { loadSession } from "@/lib/interview/engine";
import { getCatalog } from "@/lib/data/catalog";
import { getSettings } from "@/lib/data/settings";
import { aiAvailable } from "@/lib/ai/claude";
import { describeRule } from "@/lib/domain/describe";
import { InterviewWorkspace } from "./workspace";

export const metadata = { title: "Entrevista" };
// Las llamadas a la IA pueden tardar; las acciones de esta página heredan este límite en Vercel.
export const maxDuration = 120;

export default async function InterviewPage({ params }: PageProps<"/entrevistas/[id]">) {
  const { id } = await params;
  const ctx = await requireMember();
  const session = await loadSession(ctx, id);
  if (!session) notFound();
  if (session.status === "completed" && session.quote_id) redirect(`/presupuestos/${session.quote_id}`);

  const [{ services, categories }, settings] = await Promise.all([getCatalog(ctx), getSettings(ctx)]);
  const lite = services.map((s) => ({
    id: s.id,
    name: s.name,
    unit: s.unit,
    category_id: s.category_id,
    price: s.rule ? describeRule(s.rule, s.unit) : "Sin tarifa",
    levels: s.rule?.complexity?.levels.map((l) => ({ key: l.key, label: l.label })) ?? [],
    default_quantity: s.rule?.default_quantity ?? 100,
  }));

  return (
    <InterviewWorkspace
      sessionId={session.id}
      initialState={session.state}
      initialMessages={session.messages}
      initialStatus={session.status === "summary" ? "summary" : "active"}
      services={lite}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      aiMode={settings.ai_enabled && aiAvailable()}
    />
  );
}
