import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "YKONO Quote Studio", template: "%s · YKONO Quote Studio" },
  description: "Herramienta interna de presupuestos de YKONO.",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/ykono-mark.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
