export type Discipline =
  | "strategy"
  | "identity"
  | "digital"
  | "packaging"
  | "editorial"
  | "social"
  | "recurring"
  | "external"
  | "management";

export const DISCIPLINE_LABEL: Record<Discipline | "common", string> = {
  common: "Entrevista común",
  strategy: "Estrategia y marca",
  identity: "Identidad visual",
  digital: "Diseño web y digital",
  packaging: "Packaging y etiquetado",
  editorial: "Editorial, cartelería y material comercial",
  social: "Comunicación y redes sociales",
  recurring: "Diseño recurrente",
  external: "Costes de terceros",
  management: "Gestión del proyecto",
};
