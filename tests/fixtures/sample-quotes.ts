/**
 * Presupuestos de ejemplo con datos ficticios (nunca datos de clientes reales)
 * para probar el motor y la maqueta del PDF.
 */
import { computeDraft, type QuoteDraft } from "@/lib/domain/quote";
import { makeSection } from "@/lib/domain/templates";
import type { PdfData, PdfStudio } from "@/lib/pdf/types";
import { SEED_SETTINGS } from "@/lib/catalog/seed-data";

let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

export const studio: PdfStudio = {
  trade_name: "YKONO",
  tagline: "Estudio Creativo",
  legal_name: null,
  tax_id: null,
  address_line: SEED_SETTINGS.address_line,
  postal_code: SEED_SETTINGS.postal_code,
  city: SEED_SETTINGS.city,
  phone: SEED_SETTINGS.phone,
  email: SEED_SETTINGS.email,
  website: SEED_SETTINGS.website,
  closing_text: SEED_SETTINGS.closing_text,
  accent: "#B4E600",
  show_cover: true,
  show_closing: true,
};

const baseDraft = (over: Partial<QuoteDraft>): QuoteDraft => ({
  id: id(),
  number: "YK-2026-001",
  version: 1,
  status: "draft",
  client_id: null,
  project_id: null,
  title: "",
  subtitle: "",
  addressee: "",
  issue_date: "2026-10-14",
  validity_days: 30,
  vat_rate_bp: 2100,
  global_discount_bp: 0,
  payment_mode: "percent",
  payment_terms: SEED_SETTINGS.default_payment_terms,
  conditions: SEED_SETTINGS.default_conditions,
  exclusions: [],
  notes_internal: "",
  sections: [],
  phases: [],
  items: [],
  payments: [],
  ...over,
});

const item = (over: Partial<QuoteDraft["items"][number]> & { name: string }): QuoteDraft["items"][number] => ({
  id: id(),
  phase_id: null,
  service_id: null,
  pricing_rule_id: null,
  description: "",
  unit: "ud.",
  method: "fixed",
  quantity: 100,
  unit_price: null,
  hours: null,
  hourly_rate: null,
  addons: [],
  complexity_level: null,
  complexity_factor_bp: null,
  discount_bp: 0,
  vat_rate_bp: null,
  kind: "own",
  external_treatment: null,
  price_status: "approved_rate",
  is_optional: false,
  optional_included: false,
  rule_snapshot: null,
  ...over,
});

/** Encargo sencillo, en la línea del presupuesto de pantallas interactivas. */
export function simpleQuote(): QuoteDraft {
  return baseDraft({
    number: "YK-2026-007",
    title: "Pantallas interactivas para el centro de visitantes",
    subtitle: "Diseño de 48 pantallas para 6 tótems informativos",
    sections: [
      makeSection("cover", id(), { content: {} }),
      makeSection("summary", id(), {
        title: "Diseño de pantallas informativas interactivas",
        content: {
          kicker: "Objetivo del proyecto",
          body: "Diseñamos las pantallas de seis tótems informativos para que cada visitante encuentre la información de forma clara.\n\nCada pantalla combina un texto breve con una imagen que lo complementa.",
          bullets: ["8 pantallas por cada uno de los 6 tótems", "Textos e imágenes aportados por el cliente"],
        },
      }),
      makeSection("phases", id(), { title: "Qué incluye" }),
      makeSection("investment", id(), { title: "Precio" }),
      makeSection("payment", id(), { title: "Forma de pago" }),
      makeSection("conditions", id(), { title: "Lo que conviene tener claro" }),
      makeSection("closing", id(), { title: "¡Muchas gracias!", content: { body: "Esperamos poder hacer grandes proyectos contigo." } }),
    ],
    items: [item({ name: "Diseño de pantallas interactivas", method: "per_unit", unit: "pantalla", quantity: 4800, unit_price: 4313, description: "Diseño de 48 pantallas a partir de los contenidos del cliente." })],
    payments: [
      { id: id(), label: "Inicio", milestone: "Al inicio del proyecto", due_hint: "", planned_date: null, percent_bp: 5000, amount: null },
      { id: id(), label: "Entrega", milestone: "En la entrega final", due_hint: "", planned_date: null, percent_bp: 5000, amount: null },
    ],
  });
}

/** Propuesta amplia por fases, en la línea de la propuesta web. Cliente ficticio. */
export function phasedQuote(): QuoteDraft {
  const p1 = id(), p2 = id(), p3 = id(), p4 = id();
  return baseDraft({
    number: "YK-2026-012",
    version: 2,
    title: "Nueva web Panadería Ejemplo",
    subtitle: "Diseño y desarrollo en WordPress · castellano y euskera · tienda online · SEO básico",
    addressee: "Ane y Jon",
    payment_mode: "fixed",
    exclusions: ["Fotografía de producto", "Redacción de textos legales", "Mantenimiento tras el lanzamiento"],
    sections: [
      makeSection("cover", id(), { content: {} }),
      makeSection("starting_point", id(), {
        title: "La web actual no cuenta lo que hacéis en el obrador",
        content: {
          kicker: "Punto de partida",
          body: "Tenéis una clientela fiel en la tienda, pero la web no transmite el oficio ni permite hacer pedidos.",
          cards: [
            { title: "Sin pedidos online", text: "Los encargos llegan solo por teléfono." },
            { title: "Sin euskera", text: "Todo el contenido está en castellano." },
          ],
        },
      }),
      makeSection("objectives", id(), {
        title: "Una web que traiga más encargos a la tienda",
        content: { kicker: "Objetivo", body: "La web es un canal más para que os encuentren, os conozcan y os hagan pedidos.", bullets: ["Catálogo claro por familias", "Pedidos de encargos con recogida en tienda", "Contenido en dos idiomas"] },
      }),
      makeSection("phases", id(), { title: "Cuatro fases, un mismo equipo" }),
      makeSection("client_responsibilities", id(), {
        title: "Lo que necesitamos de vosotros",
        content: { kicker: "Vuestra parte", bullets: ["Accesos al dominio y hosting", "Fotografías del obrador si las tenéis", "Revisar la traducción al euskera"] },
      }),
      makeSection("exclusions", id(), { title: "Lo que no incluye esta propuesta" }),
      makeSection("investment", id(), { title: "Precio cerrado para todo el proyecto" }),
      makeSection("payment", id(), { title: "Cuatro pagos por la web y uno por la tienda" }),
      makeSection("conditions", id(), { title: "Lo que conviene tener claro desde el principio" }),
      makeSection("closing", id(), { title: "¿Empezamos?", content: {} }),
    ],
    phases: [
      { id: p1, name: "Diseño", description: "Partimos de la estructura aprobada y la convertimos en un diseño completo.", deliverables: ["8 plantillas de página", "Versión móvil", "2 rondas de revisión"], timing: "Meses 1–2" },
      { id: p2, name: "Desarrollo", description: "Construimos la web en un entorno de pruebas.", deliverables: ["Web en WordPress", "Traducción al euskera", "SEO básico"], timing: "Meses 2–3" },
      { id: p3, name: "Formación", description: "Para que gestionéis la web con autonomía.", deliverables: ["Sesión de 1,5 h"], timing: "Mes 3" },
      { id: p4, name: "Tienda online", description: "Activamos los pedidos cuando esté todo listo.", deliverables: ["Carrito y pedidos", "Pasarela de pago"], timing: "Meses 4–5" },
    ],
    items: [
      item({ name: "Diseño web por plantilla", phase_id: p1, method: "per_unit", unit: "plantilla", quantity: 800, unit_price: 22000 }),
      item({ name: "Desarrollo web por plantilla", phase_id: p2, method: "per_unit", unit: "plantilla", quantity: 800, unit_price: 26000 }),
      item({ name: "Versión en euskera", phase_id: p2, method: "per_unit", unit: "idioma", quantity: 100, unit_price: 45000 }),
      item({ name: "SEO básico", phase_id: p2, unit_price: 40000 }),
      item({ name: "Formación", phase_id: p3, method: "hourly", hours: 150, hourly_rate: 5000 }),
      item({ name: "Tienda online", phase_id: p4, unit_price: 120000, price_status: "manual_approved" }),
      item({ name: "Mantenimiento web", method: "per_unit", unit: "mes", quantity: 1200, unit_price: 6000, is_optional: true, description: "Actualizaciones y copias de seguridad." }),
      item({ name: "Licencia de plugin de traducción", kind: "external", method: "external", external_treatment: "informative", unit: "año", unit_price: 9900 }),
      item({ name: "Hosting y dominio", kind: "external", method: "external", external_treatment: "informative", unit_price: null, price_status: "pending_valuation", description: "Según vuestro proveedor" }),
    ],
    payments: [
      { id: id(), label: "Arranque", milestone: "Al aceptar la propuesta", due_hint: "Mes 1", planned_date: null, percent_bp: null, amount: 120000 },
      { id: id(), label: "Diseño aprobado", milestone: "Al cerrar la fase 1", due_hint: "Mes 2", planned_date: null, percent_bp: null, amount: 120000 },
      { id: id(), label: "Web en pruebas", milestone: "Cuando os enseñamos la web", due_hint: "Mes 3", planned_date: null, percent_bp: null, amount: 120000 },
      { id: id(), label: "Lanzamiento", milestone: "Web publicada", due_hint: "Mes 3", planned_date: null, percent_bp: null, amount: 116500 },
      { id: id(), label: "Tienda online", milestone: "Solo si activáis la venta", due_hint: "Al activarla", planned_date: null, percent_bp: null, amount: 120000 },
    ],
  });
}

export function toPdfData(draft: QuoteDraft, mode: "preview" | "final" = "final"): PdfData {
  const { totals, schedule } = computeDraft(draft);
  return {
    draft,
    totals,
    schedule,
    client: { trade_name: "Cliente Ejemplo S.L.", legal_name: "Cliente Ejemplo S.L.", tax_id: "B00000000", address_line: "Calle Ficticia, 1", postal_code: "48001", city: "Bilbao", province: "Bizkaia" },
    studio,
    customLogo: null,
    mode,
    generatedAt: "2026-10-14T20:00:00.000Z",
  };
}
