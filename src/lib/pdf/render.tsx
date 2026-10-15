import { renderToBuffer } from "@react-pdf/renderer";
import { QuoteDocument } from "./document";
import type { PdfData } from "./types";

export async function renderQuotePdf(data: PdfData): Promise<Buffer> {
  return renderToBuffer(<QuoteDocument data={data} />);
}

/** "YK-2026-004_v2_Nueva-web-Ortopedia-Almirall.pdf" */
export function pdfFileName(number: string, version: number, title: string, docVersion?: number): string {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${number}_v${version}${slug ? `_${slug}` : ""}${docVersion ? `_doc${docVersion}` : ""}.pdf`;
}
