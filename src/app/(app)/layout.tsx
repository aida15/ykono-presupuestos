import { requireMember } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { SideNav } from "./side-nav";

// Todo lo que hay bajo (app) depende de la sesión: nunca se prerenderiza.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await requireMember();
  const settings = await getSettings(ctx);
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[232px_1fr]">
      <SideNav productName={settings.product_name} email={ctx.email} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
