/**
 * Catálogo inicial de YKONO Quote Studio.
 *
 * Servicios: los que YKONO publica en ykono.es/servicios, más los que aparecen en
 * los presupuestos de referencia (desarrollo, SEO, formación, asistente a medida…).
 *
 * PRECIOS: propuesta inicial definida para arrancar (no salen de los PDF de referencia).
 * Son tarifas orientativas para un estudio pequeño en Bilbao y se revisan desde
 * Catálogo → cada cambio crea una versión nueva sin tocar presupuestos guardados.
 *
 * Los importes están en euros aquí por legibilidad; el script de seed los pasa a céntimos.
 */

import type { Discipline } from "./disciplines";
export { DISCIPLINE_LABEL, type Discipline } from "./disciplines";

type SeedRule =
  | { method: "fixed"; price: number; status?: "estimate_pending" }
  | { method: "per_unit"; price: number; qty?: number }
  | { method: "hourly"; rate: number; hours: number; status?: "estimate_pending" }
  | { method: "base_plus_addons"; price: number; addons: { label: string; price: number; qty?: number }[] }
  | { method: "complexity"; price: number; levels: { key: string; label: string; factor: number }[]; default_level: string }
  | { method: "external"; price: number | null; treatment: "informative" | "resale" | "suplido" };

export type SeedService = {
  key: string;
  name: string;
  unit: string;
  commercial: string;
  internal?: string;
  deliverables?: string[];
  exclusions?: string[];
  complements?: string[];
  optional?: boolean;
  rule: SeedRule;
};

export type SeedCategory = { key: Discipline; name: string; description: string; services: SeedService[] };

export const SEED_CATALOG: SeedCategory[] = [
  {
    key: "strategy",
    name: "Estrategia y marca",
    description: "Entender el contexto y definir qué tiene que decir la marca antes de diseñarla.",
    services: [
      {
        key: "brand-audit",
        name: "Análisis de marca y competencia",
        unit: "proyecto",
        commercial: "Revisión de la marca actual, sus puntos de contacto y los principales competidores para detectar oportunidades.",
        deliverables: ["Informe de análisis con conclusiones", "Mapa de competidores"],
        complements: ["strategic-platform"],
        rule: { method: "fixed", price: 650 },
      },
      {
        key: "strategic-platform",
        name: "Plataforma estratégica",
        unit: "proyecto",
        commercial: "Propósito, posicionamiento, públicos, atributos y personalidad de la marca, recogidos en un documento de trabajo.",
        deliverables: ["Documento de plataforma estratégica", "Sesión de presentación"],
        complements: ["verbal-identity"],
        rule: { method: "fixed", price: 1200 },
      },
      {
        key: "naming",
        name: "Naming",
        unit: "proyecto",
        commercial: "Creación del nombre de marca: territorios creativos, propuestas filtradas y comprobación básica de disponibilidad.",
        deliverables: ["Propuesta de nombres argumentada", "Comprobación básica de dominio y marca"],
        exclusions: ["Registro de la marca en la OEPM o EUIPO"],
        rule: {
          method: "base_plus_addons",
          price: 900,
          addons: [{ label: "Ronda adicional de propuestas", price: 250, qty: 0 }],
        },
      },
      {
        key: "verbal-identity",
        name: "Identidad verbal y tono de voz",
        unit: "proyecto",
        commercial: "Cómo habla la marca: tono, principios de redacción, mensajes clave y ejemplos de uso.",
        deliverables: ["Guía de tono de voz", "Mensajes clave"],
        rule: { method: "fixed", price: 700 },
      },
    ],
  },
  {
    key: "identity",
    name: "Identidad visual",
    description: "Logotipo, sistema visual y normas para aplicarlo con coherencia.",
    services: [
      {
        key: "logo",
        name: "Logotipo y marca gráfica",
        unit: "proyecto",
        commercial: "Diseño del logotipo y sus versiones, con propuestas iniciales y desarrollo de la elegida.",
        deliverables: ["Logotipo y versiones (horizontal, vertical, símbolo)", "Archivos finales en vector y digital"],
        complements: ["visual-system", "brand-manual", "brand-applications"],
        rule: {
          method: "complexity",
          price: 1200,
          default_level: "medium",
          levels: [
            { key: "simple", label: "Sencillo (adaptación o tipográfico)", factor: 0.7 },
            { key: "medium", label: "Estándar (creación desde cero)", factor: 1 },
            { key: "high", label: "Complejo (símbolo, varias líneas creativas)", factor: 1.5 },
          ],
        },
      },
      {
        key: "visual-system",
        name: "Sistema visual completo",
        unit: "proyecto",
        commercial: "Paleta de color, tipografías, recursos gráficos, iconografía y criterios de composición.",
        deliverables: ["Paleta y tipografías", "Recursos gráficos y patrones", "Plantillas base"],
        rule: { method: "fixed", price: 1400 },
      },
      {
        key: "brand-manual",
        name: "Manual de marca",
        unit: "manual",
        commercial: "Documento con las normas de uso de la identidad para que cualquier persona la aplique bien.",
        deliverables: ["Manual de marca en PDF"],
        rule: {
          method: "complexity",
          price: 600,
          default_level: "basic",
          levels: [
            { key: "basic", label: "Básico (logotipo, color y tipografía)", factor: 1 },
            { key: "full", label: "Completo (sistema y aplicaciones)", factor: 1.8 },
          ],
        },
      },
      {
        key: "art-direction",
        name: "Dirección de arte",
        unit: "h",
        commercial: "Definición y supervisión del estilo visual de sesiones fotográficas, campañas o piezas audiovisuales.",
        rule: { method: "hourly", rate: 55, hours: 10, status: "estimate_pending" },
      },
      {
        key: "brand-applications",
        name: "Aplicaciones de marca",
        unit: "aplicación",
        commercial: "Diseño de piezas de uso diario con la nueva identidad: papelería, firmas, plantillas, rotulación…",
        rule: { method: "per_unit", price: 90, qty: 5 },
      },
    ],
  },
  {
    key: "digital",
    name: "Diseño digital",
    description: "Webs, landings, interfaces y contenido digital.",
    services: [
      {
        key: "web-design-template",
        name: "Diseño web por plantilla",
        unit: "plantilla",
        commercial: "Diseño de cada plantilla de página en versión escritorio y móvil.",
        deliverables: ["Diseño escritorio y móvil de cada plantilla"],
        complements: ["web-copywriting", "seo-basic"],
        rule: { method: "per_unit", price: 220, qty: 6 },
      },
      {
        key: "web-dev-template",
        name: "Desarrollo web por plantilla (WordPress)",
        unit: "plantilla",
        commercial: "Maquetación y desarrollo de cada plantilla en WordPress, en un entorno de pruebas hasta el lanzamiento.",
        deliverables: ["Web en entorno de pruebas", "Publicación en el servidor del cliente"],
        exclusions: ["Hosting, dominio y licencias de terceros"],
        complements: ["training", "web-maintenance"],
        rule: { method: "per_unit", price: 260, qty: 6 },
      },
      {
        key: "landing",
        name: "Landing o micrositio",
        unit: "proyecto",
        commercial: "Página única de campaña o producto, diseñada y desarrollada.",
        rule: { method: "fixed", price: 950 },
      },
      {
        key: "ecommerce",
        name: "Tienda online",
        unit: "proyecto",
        commercial: "Configuración de la venta online: carrito, pasarela de pago, impuestos, envíos y correos de pedido.",
        exclusions: ["Carga masiva de productos", "Textos legales de venta"],
        rule: { method: "fixed", price: 1200 },
      },
      {
        key: "extra-language",
        name: "Versión en idioma adicional",
        unit: "idioma",
        commercial: "Configuración multidioma y traducción de los contenidos de la web.",
        exclusions: ["Revisión de la traducción por parte del cliente"],
        rule: { method: "per_unit", price: 450, qty: 1 },
      },
      {
        key: "web-copywriting",
        name: "Redacción de textos web",
        unit: "página",
        commercial: "Redacción u optimización de los textos de cada página a partir del contenido del cliente.",
        rule: { method: "per_unit", price: 60, qty: 6 },
      },
      {
        key: "seo-basic",
        name: "SEO básico",
        unit: "proyecto",
        commercial: "Palabra clave por página, títulos y descripciones, etiquetas de idioma, mapa del sitio y alta en Search Console.",
        exclusions: ["SEO avanzado y posicionamiento de pago"],
        rule: { method: "fixed", price: 400 },
      },
      {
        key: "custom-feature",
        name: "Funcionalidad a medida",
        unit: "h",
        commercial: "Desarrollo de una funcionalidad específica (asistente, configurador, integración…). Se estima por horas.",
        rule: { method: "hourly", rate: 55, hours: 20, status: "estimate_pending" },
      },
      {
        key: "interactive-screens",
        name: "Diseño de pantallas interactivas",
        unit: "pantalla",
        commercial: "Diseño de pantallas para tótems o soportes táctiles a partir de los textos e imágenes del cliente.",
        rule: { method: "per_unit", price: 50, qty: 8 },
      },
      {
        key: "newsletter",
        name: "Diseño de newsletter o email",
        unit: "plantilla",
        commercial: "Plantilla de email adaptada a la marca y lista para la herramienta de envío del cliente.",
        rule: { method: "per_unit", price: 280, qty: 1 },
      },
      {
        key: "training",
        name: "Formación",
        unit: "h",
        commercial: "Sesión online para que el equipo del cliente gestione la web o los materiales entregados.",
        optional: false,
        rule: { method: "hourly", rate: 50, hours: 1.5 },
      },
      {
        key: "web-maintenance",
        name: "Mantenimiento web",
        unit: "mes",
        commercial: "Actualizaciones, copias de seguridad y pequeños cambios mensuales.",
        optional: true,
        rule: { method: "per_unit", price: 60, qty: 12 },
      },
    ],
  },
  {
    key: "packaging",
    name: "Packaging y etiquetado",
    description: "Envases y etiquetas listos para producción.",
    services: [
      {
        key: "packaging-design",
        name: "Diseño de packaging (primera referencia)",
        unit: "referencia",
        commercial: "Diseño del envase o etiqueta principal a partir de la identidad de marca.",
        deliverables: ["Diseño de la referencia principal", "Maqueta en 3D o mockup"],
        exclusions: ["Producción e impresión", "Fotografía de producto"],
        complements: ["packaging-variant", "final-artwork"],
        rule: { method: "fixed", price: 750 },
      },
      {
        key: "packaging-variant",
        name: "Adaptación a variante o formato",
        unit: "variante",
        commercial: "Adaptación del diseño principal a sabores, tamaños o formatos adicionales.",
        rule: { method: "per_unit", price: 140, qty: 1 },
      },
      {
        key: "final-artwork",
        name: "Artes finales y preparación para imprenta",
        unit: "h",
        commercial: "Preparación de archivos sobre troquel, revisión de pruebas y coordinación con la imprenta.",
        rule: { method: "hourly", rate: 45, hours: 3 },
      },
    ],
  },
  {
    key: "editorial",
    name: "Editorial, cartelería y material comercial",
    description: "Piezas impresas y digitales para comunicar.",
    services: [
      {
        key: "editorial-page",
        name: "Diseño editorial",
        unit: "página",
        commercial: "Maquetación de catálogos, memorias, revistas o dossieres.",
        rule: { method: "per_unit", price: 35, qty: 16 },
      },
      {
        key: "poster",
        name: "Cartel o pieza comercial",
        unit: "pieza",
        commercial: "Diseño de cartel, folleto, flyer o pieza comercial.",
        complements: ["format-adaptation"],
        rule: { method: "per_unit", price: 180, qty: 1 },
      },
      {
        key: "format-adaptation",
        name: "Adaptación a otro formato",
        unit: "adaptación",
        commercial: "Adaptación de una pieza ya aprobada a otros tamaños o soportes.",
        rule: { method: "per_unit", price: 50, qty: 2 },
      },
      {
        key: "illustration",
        name: "Ilustración aplicada",
        unit: "ilustración",
        commercial: "Ilustraciones a medida para piezas de marca, editoriales o digitales.",
        rule: {
          method: "complexity",
          price: 250,
          default_level: "medium",
          levels: [
            { key: "simple", label: "Sencilla (icono o spot)", factor: 0.6 },
            { key: "medium", label: "Media", factor: 1 },
            { key: "complex", label: "Compleja (escena)", factor: 2.5 },
          ],
        },
      },
    ],
  },
  {
    key: "social",
    name: "Comunicación y redes sociales",
    description: "Contenido para redes y campañas.",
    services: [
      {
        key: "social-creative",
        name: "Creatividad para redes sociales",
        unit: "creatividad",
        commercial: "Diseño de publicaciones, historias o carruseles adaptados a cada plataforma.",
        rule: { method: "per_unit", price: 45, qty: 8 },
      },
      {
        key: "social-copy",
        name: "Copywriting para redes",
        unit: "publicación",
        commercial: "Redacción de los textos que acompañan cada publicación.",
        rule: { method: "per_unit", price: 15, qty: 8 },
      },
      {
        key: "social-templates",
        name: "Plantillas editables para redes",
        unit: "pack",
        commercial: "Pack de plantillas editables para que el equipo del cliente publique con autonomía.",
        rule: { method: "fixed", price: 450 },
      },
    ],
  },
  {
    key: "recurring",
    name: "Diseño recurrente",
    description: "Un equipo de diseño que acompaña a la marca de forma continua.",
    services: [
      {
        key: "monthly-retainer",
        name: "Bolsa mensual de diseño",
        unit: "mes",
        commercial: "Bolsa de horas mensual para piezas de campaña, redes, material comercial y nuevas aplicaciones.",
        internal: "Equivale a ~14 h/mes a tarifa reducida. Las horas no consumidas no se acumulan.",
        exclusions: ["Horas que excedan la bolsa mensual (se facturan aparte)", "Impresión y producción"],
        rule: { method: "per_unit", price: 650, qty: 3 },
      },
      {
        key: "design-hour",
        name: "Hora de diseño",
        unit: "h",
        commercial: "Trabajo de diseño puntual facturado por horas.",
        rule: { method: "hourly", rate: 50, hours: 1 },
      },
    ],
  },
  {
    key: "management",
    name: "Gestión del proyecto",
    description: "Reuniones y coordinación fuera del alcance estándar.",
    services: [
      {
        key: "extra-meeting",
        name: "Reunión adicional",
        unit: "h",
        commercial: "Reuniones de seguimiento por encima de las incluidas.",
        optional: true,
        rule: { method: "hourly", rate: 50, hours: 1 },
      },
      {
        key: "extra-revision",
        name: "Ronda de revisión adicional",
        unit: "ronda",
        commercial: "Cambios sobre un diseño ya aprobado o rondas por encima de las incluidas.",
        optional: true,
        rule: { method: "per_unit", price: 150, qty: 1 },
      },
    ],
  },
  {
    key: "external",
    name: "Costes de terceros",
    description: "Licencias, servicios y producción que no son trabajo de YKONO.",
    services: [
      {
        key: "software-license",
        name: "Licencia de software o plugin",
        unit: "año",
        commercial: "Licencia contratada a nombre del cliente. Precio orientativo del proveedor.",
        rule: { method: "external", price: null, treatment: "informative" },
      },
      {
        key: "hosting-domain",
        name: "Hosting y dominio",
        unit: "año",
        commercial: "Según el proveedor del cliente.",
        rule: { method: "external", price: null, treatment: "informative" },
      },
      {
        key: "printing",
        name: "Impresión y producción",
        unit: "pedido",
        commercial: "Impresión gestionada por YKONO con proveedor externo.",
        rule: { method: "external", price: null, treatment: "resale" },
      },
      {
        key: "photography",
        name: "Fotografía profesional",
        unit: "sesión",
        commercial: "Sesión con fotógrafo/a externo/a coordinada por YKONO.",
        rule: { method: "external", price: null, treatment: "resale" },
      },
      {
        key: "fees-on-behalf",
        name: "Tasas pagadas en nombre del cliente (suplido)",
        unit: "ud.",
        commercial: "Gastos pagados en nombre y por cuenta del cliente, repercutidos sin IVA.",
        rule: { method: "external", price: null, treatment: "suplido" },
      },
    ],
  },
];

export type SeedQuestion = {
  discipline: Discipline | "common";
  question: string;
  answer_type?: "text" | "number" | "boolean" | "choice" | "multi";
  options?: string[];
  help?: string;
};

export const SEED_QUESTIONS: SeedQuestion[] = [
  // Entrevista común
  ...[
    "¿Cómo se llama el proyecto y quién es el cliente?",
    "¿A qué se dedica el cliente y en qué contexto está ahora mismo?",
    "¿Qué quiere conseguir con el proyecto?",
    "¿A quién se dirige (público objetivo)?",
    "¿Cuál es la situación de partida? ¿Qué tienen hoy?",
    "¿Qué entregables espera recibir?",
    "¿Qué materiales tiene ya disponibles y cuáles aportará?",
    "¿En qué idiomas?",
    "¿Hay fecha deseada de entrega o algún hito que marque el calendario?",
    "¿Depende de terceros (imprenta, programadores, proveedores, permisos)?",
    "¿Conoces el presupuesto orientativo del cliente?",
    "¿Quién valida el trabajo por parte del cliente?",
  ].map((q) => ({ discipline: "common" as const, question: q })),
  // Estrategia y marca
  { discipline: "strategy", question: "¿La marca es nueva o ya existe?", answer_type: "choice", options: ["Nueva", "Existe", "En transición"] },
  { discipline: "strategy", question: "¿Se necesita auditoría, investigación o análisis de competencia?", answer_type: "boolean" },
  { discipline: "strategy", question: "¿Se requiere posicionamiento o plataforma estratégica?", answer_type: "boolean" },
  { discipline: "strategy", question: "¿Se necesita naming?", answer_type: "boolean" },
  { discipline: "strategy", question: "¿Se incluye identidad verbal o tono de voz?", answer_type: "boolean" },
  // Identidad visual
  { discipline: "identity", question: "¿Se crea una identidad desde cero o se adapta una existente?", answer_type: "choice", options: ["Desde cero", "Adaptación", "Rediseño profundo"] },
  { discipline: "identity", question: "¿Qué elementos se desarrollarán (logotipo, símbolo, color, tipografía, iconografía…)?" },
  { discipline: "identity", question: "¿Se necesita un sistema visual completo?", answer_type: "boolean" },
  { discipline: "identity", question: "¿Se requiere manual de marca?", answer_type: "choice", options: ["No", "Básico", "Completo"] },
  { discipline: "identity", question: "¿Qué aplicaciones se incluyen y cuántas?" },
  { discipline: "identity", question: "¿Se necesita dirección de arte?", answer_type: "boolean" },
  // Diseño web y digital
  { discipline: "digital", question: "¿Es una web nueva, una renovación o una intervención concreta?", answer_type: "choice", options: ["Nueva", "Renovación", "Intervención concreta"] },
  { discipline: "digital", question: "¿Cuántas páginas y plantillas distintas?", answer_type: "number" },
  { discipline: "digital", question: "¿Qué funcionalidades se necesitan?" },
  { discipline: "digital", question: "¿Cuántos idiomas?", answer_type: "number" },
  { discipline: "digital", question: "¿Incluye diseño, desarrollo o ambos?", answer_type: "choice", options: ["Diseño", "Desarrollo", "Ambos"] },
  { discipline: "digital", question: "¿Incluye redacción, traducción, SEO o integraciones?", answer_type: "multi", options: ["Redacción", "Traducción", "SEO", "Integraciones"] },
  { discipline: "digital", question: "¿Hay tienda online, formularios u otras funcionalidades especiales?" },
  { discipline: "digital", question: "¿Quién aporta el contenido?", answer_type: "choice", options: ["Cliente", "YKONO", "Mixto"] },
  { discipline: "digital", question: "¿Se requiere mantenimiento posterior?", answer_type: "boolean" },
  // Packaging
  { discipline: "packaging", question: "¿Cuántos productos y referencias?", answer_type: "number" },
  { discipline: "packaging", question: "¿Cuántos formatos o variantes?", answer_type: "number" },
  { discipline: "packaging", question: "¿Se adapta una identidad existente o es un diseño nuevo?", answer_type: "choice", options: ["Adaptación", "Diseño nuevo"] },
  { discipline: "packaging", question: "¿Hay troqueles y especificaciones técnicas disponibles?", answer_type: "boolean" },
  { discipline: "packaging", question: "¿Se incluyen artes finales y preparación para imprenta?", answer_type: "boolean" },
  { discipline: "packaging", question: "¿Hay que coordinar producción con proveedores?", answer_type: "boolean" },
  // Editorial
  { discipline: "editorial", question: "¿Qué tipo de pieza es?" },
  { discipline: "editorial", question: "¿Cuántas piezas?", answer_type: "number" },
  { discipline: "editorial", question: "¿Cuántas páginas, formatos o versiones?" },
  { discipline: "editorial", question: "¿Qué adaptaciones necesita?" },
  { discipline: "editorial", question: "¿Incluye redacción, ilustración o fotografía?", answer_type: "multi", options: ["Redacción", "Ilustración", "Fotografía"] },
  { discipline: "editorial", question: "¿Es para impresión o publicación digital?", answer_type: "choice", options: ["Impresión", "Digital", "Ambas"] },
  // Redes
  { discipline: "social", question: "¿En qué plataformas?", answer_type: "multi", options: ["Instagram", "LinkedIn", "TikTok", "Facebook", "X"] },
  { discipline: "social", question: "¿Cuántas creatividades y de qué tipo?" },
  { discipline: "social", question: "¿Con qué frecuencia se publica?" },
  { discipline: "social", question: "¿Necesita copywriting?", answer_type: "boolean" },
  { discipline: "social", question: "¿Hay campañas o adaptaciones a otros formatos?" },
  { discipline: "social", question: "¿Qué volumen y durante cuánto tiempo?" },
  // Recurrente
  { discipline: "recurring", question: "¿Durante cuánto tiempo se contrata el servicio?" },
  { discipline: "recurring", question: "¿Qué volumen de trabajo o unidades al mes?" },
  { discipline: "recurring", question: "¿Qué tipos de entregables entran en el servicio?" },
  { discipline: "recurring", question: "¿Cuántas revisiones por pieza?", answer_type: "number" },
  { discipline: "recurring", question: "¿Qué tiempo de respuesta se compromete?" },
  { discipline: "recurring", question: "¿Qué límites tiene el servicio y qué tareas quedan fuera?" },
];

export const SEED_SETTINGS = {
  product_name: "YKONO Quote Studio",
  trade_name: "YKONO",
  tagline: "Estudio Creativo",
  address_line: "c/ Bertendona, 4, 1º",
  postal_code: "48008",
  city: "Bilbao",
  province: "Bizkaia",
  phone: "+34 623 062 586",
  email: "info@ykono.es",
  website: "ykono.es",
  quote_prefix: "YK",
  default_vat_rate_bp: 2100,
  default_validity_days: 30,
  default_payment_mode: "percent",
  default_payments: [
    { label: "Inicio", milestone: "Al aceptar la propuesta", due_hint: "", percent_bp: 5000 },
    { label: "Entrega", milestone: "En la entrega final", due_hint: "", percent_bp: 5000 },
  ],
  default_payment_terms: "Transferencia bancaria a 7 días desde cada factura.",
  default_conditions: [
    { title: "Plazos", text: "Empiezan con el primer pago y la entrega de accesos y materiales. El ritmo depende también de vuestras respuestas." },
    { title: "Cambios de alcance", text: "El precio final puede variar si las indicaciones del proyecto cambian. Los cambios sobre un diseño aprobado se presupuestan aparte." },
    { title: "Propiedad", text: "El trabajo es vuestro una vez abonado el importe de cada fase. Las licencias de terceros están a vuestro nombre." },
    { title: "Portfolio", text: "YKONO podrá mostrar el proyecto en su portfolio, redes y concursos de diseño, salvo que nos indiquéis lo contrario." },
  ],
  default_exclusions: [] as string[],
  closing_text: "Esperamos poder hacer grandes proyectos con vosotros.",
  pdf_preferences: { accent: "#B4E600", ink: "#111111", surface: "#F3F3EE", show_cover: true, show_closing: true },
};
