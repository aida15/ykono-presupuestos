/**
 * Textos de la auditoría gratuita que se envía a un lead.
 *
 * Cada criterio que NO cumple se cuenta igual en todas las auditorías:
 *   1. el problema, dicho en su idioma;
 *   2. por qué importa;
 *   3. una cifra con su fuente (solo cifras verificadas en la fuente original);
 *   4. cómo se arregla.
 *
 * Cifras revisadas en octubre de 2026. Descartadas por no tener fuente primaria:
 * el «75 % juzga la credibilidad por el diseño», el «+32 % de rebote de 1 a 3 s»
 * y el «+23 % de ingresos por coherencia de marca».
 */
import type { CriterionResult } from "./criteria";
import { CRITERIA_BY_ID } from "./criteria";

export type AuditStat = { id: string; text: string; source: string; url: string };

export const STATS: Record<string, AuditStat> = {
  brightlocal: {
    id: "brightlocal",
    text: "El 98 % de los consumidores usó internet para informarse sobre negocios de su zona durante el último año.",
    source: "BrightLocal, Local Consumer Review Survey, 2023",
    url: "https://www.brightlocal.com/research/local-consumer-review-survey/",
  },
  chrome: {
    id: "chrome",
    text: "Desde julio de 2018, Google Chrome marca como «No seguro» todas las webs que no usan HTTPS.",
    source: "Google Security Blog, 2018",
    url: "https://security.googleblog.com/2018/02/a-secure-web-is-here-to-stay.html",
  },
  statcounter: {
    id: "statcounter",
    text: "En España, cerca de 7 de cada 10 visitas a páginas web se hacen ya desde el móvil.",
    source: "StatCounter, cuota de tráfico móvil en España, 2026",
    url: "https://gs.statcounter.com/platform-market-share/mobile-desktop/spain",
  },
  stanford: {
    id: "stanford",
    text: "En un estudio de Stanford con 2.684 personas, el diseño fue lo que más se mencionó al valorar si una web era creíble: el 46 % de los comentarios.",
    source: "Fogg et al., Stanford Persuasive Technology Lab, 2002",
    url: "https://advocacy.consumerreports.org/research/how-do-people-evaluate-a-web-sites-credibility",
  },
  speed: {
    id: "speed",
    text: "El 53 % de las visitas desde el móvil se abandona si la página tarda más de 3 segundos en cargar.",
    source: "Google / Think with Google, 2017",
    url: "https://thinkwithgoogle.com/_qs/documents/57/mobile-page-speed-new-industry-benchmarks.pdf",
  },
  deloitte: {
    id: "deloitte",
    text: "Mejorar solo una décima de segundo la carga en el móvil aumentó un 8,4 % las ventas de los comercios online estudiados.",
    source: "Deloitte para Google, «Milliseconds Make Millions», 2020",
    url: "https://web.dev/case-studies/milliseconds-make-millions",
  },
  backlinko: {
    id: "backlinko",
    text: "Solo el 0,63 % de quienes buscan en Google llega a hacer clic en la segunda página de resultados.",
    source: "Backlinko, estudio de CTR en Google (2019, actualizado en 2025)",
    url: "https://backlinko.com/google-ctr-stats",
  },
  lssi: {
    id: "lssi",
    text: "La LSSI obliga a identificar al titular de la web y a informar de las cookies. No hacerlo es una infracción que puede sancionarse con hasta 30.000 €.",
    source: "Ley 34/2002 (LSSI-CE), arts. 10, 22, 38 y 39",
    url: "https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758",
  },
  ine: {
    id: "ine",
    text: "En Euskadi, el 60 % de las personas de 16 a 74 años compró algo por internet en los últimos tres meses.",
    source: "INE, Encuesta TIC-H, 2025",
    url: "https://ine.es/dyngs/Prensa/TICH2025.htm",
  },
  csa: {
    id: "csa",
    text: "El 76 % de los compradores online prefiere comprar cuando la información está en su idioma.",
    source: "CSA Research, «Can't Read, Won't Buy», 2020",
    url: "https://csa-research.com/blogs-events/csa-in-the-media/press-releases/consumers-prefer-their-own-language",
  },
  gbp_trust: {
    id: "gbp_trust",
    text: "Según Google, con un perfil completo un negocio tiene 2,7 veces más probabilidades de parecer fiable y un 70 % más de recibir visitas.",
    source: "Google, Ayuda de Perfil de Empresa",
    url: "https://support.google.com/business/answer/10515606",
  },
  gbp_photos: {
    id: "gbp_photos",
    text: "Según Google, los negocios con fotos en su ficha reciben un 42 % más de peticiones de «cómo llegar» y un 35 % más de clics a su web.",
    source: "Google, guía oficial de Perfil de Empresa, 2026",
    url: "https://services.google.com/fh/files/helpcenter/official_gbp_best_practices_playbook_2026.pdf",
  },
  gbp_clicks: {
    id: "gbp_clicks",
    text: "Según Google, los perfiles completos reciben hasta 7 veces más clics que los incompletos.",
    source: "Google, guía oficial de Perfil de Empresa, 2026",
    url: "https://services.google.com/fh/files/helpcenter/official_gbp_best_practices_playbook_2026.pdf",
  },
  gbp_hours: {
    id: "gbp_hours",
    text: "El 96 % de los consumidores dice que es más probable que vaya a un negocio si ve su horario publicado.",
    source: "Uberall, 2025, recogido en la guía oficial de Perfil de Empresa de Google",
    url: "https://services.google.com/fh/files/helpcenter/official_gbp_best_practices_playbook_2026.pdf",
  },
  social: {
    id: "social",
    text: "El 20 % de los clientes mira las redes sociales de un negocio antes de ir.",
    source: "Uberall, 2025, recogido en la guía oficial de Perfil de Empresa de Google",
    url: "https://services.google.com/fh/files/helpcenter/official_gbp_best_practices_playbook_2026.pdf",
  },
};

export type FindingCopy = {
  /** El problema, como lo diría una persona. */
  problem: string;
  /** Por qué importa. */
  why: string;
  /** Cifras candidatas, por orden de preferencia. Cada cifra aparece una sola vez por auditoría. */
  stats: string[];
  /** Cómo lo arreglaríamos. */
  fix: string;
};

export const FINDINGS: Record<string, FindingCopy> = {
  has_website: {
    problem: "No tenéis web propia",
    why: "Cuando alguien oye hablar de vosotros, lo primero que hace es buscaros en el móvil. Si no encuentra una web, se queda con lo que digan otros, o con la web de la competencia, que sí aparece.",
    stats: ["brightlocal"],
    fix: "Una web sencilla, de una sola página si hace falta, con lo esencial: qué hacéis, dónde estáis y cómo contactar. Pensada para el móvil y, sobre todo, vuestra.",
  },
  https: {
    problem: "El navegador avisa de que la web «no es segura»",
    why: "Junto a vuestra dirección aparece un «No seguro». Mucha gente no sabe exactamente qué significa, pero no le da buena espina, y menos si va a dejar sus datos en un formulario.",
    stats: ["chrome"],
    fix: "Instalar un certificado de seguridad (normalmente es gratuito) y hacer que toda la web cargue en su versión segura. Es trabajo de una mañana.",
  },
  mobile: {
    problem: "La web no está pensada para el móvil",
    why: "Si hay que hacer zoom para leer o los botones no se pueden pulsar con el dedo, la visita dura segundos. Y es justo desde el móvil desde donde os busca casi todo el mundo.",
    stats: ["statcounter"],
    fix: "Rehacer la web con un diseño que se adapte a cualquier pantalla, empezando por la del móvil.",
  },
  updated: {
    problem: "La web da sensación de abandono",
    why: "Un año antiguo en el pie de página, noticias viejas o un diseño de otra época hacen pensar que el negocio está parado, aunque no sea así. Y la gente decide muy rápido.",
    stats: ["stanford"],
    fix: "Revisar textos, fotos y fechas, y dejar la web preparada para que podáis tenerla al día vosotros sin depender de nadie.",
  },
  modern_tech: {
    problem: "La web está hecha con tecnología que se ha quedado atrás",
    why: "Las webs antiguas o montadas con constructores gratuitos son difíciles de actualizar, suelen verse peor en el móvil y Google las tiene menos en cuenta. Cada cambio pequeño cuesta más de lo que debería.",
    stats: ["stanford"],
    fix: "Pasarla a una base actual y fácil de gestionar, aprovechando lo que ya funciona.",
  },
  own_domain: {
    problem: "No tenéis dominio propio",
    why: "Una dirección prestada (un subdominio gratuito o una red social como web principal) resta seriedad y, sobre todo, no es vuestra: depende de una plataforma que puede cambiar las reglas cuando quiera.",
    stats: [],
    fix: "Registrar vuestro dominio y llevar a él la web y el correo.",
  },
  pro_email: {
    problem: "El correo del negocio es de Gmail, Hotmail o similar",
    why: "Funciona, pero un presupuesto que llega desde info@vuestronegocio transmite otra cosa que uno que llega desde una cuenta personal. Además, si alguien deja el negocio, el correo se queda en casa.",
    stats: [],
    fix: "Crear las cuentas de correo con vuestro dominio y dejarlas configuradas en el móvil y el ordenador.",
  },
  performance: {
    problem: "La web tarda en cargar en el móvil",
    why: "Nadie espera. Si la pantalla se queda en blanco unos segundos, la gente vuelve atrás y entra en el siguiente resultado.",
    stats: ["speed", "deloitte"],
    fix: "Optimizar imágenes, código y alojamiento hasta que la web cargue rápido incluso con poca cobertura.",
  },
  seo_basics: {
    problem: "A Google le cuesta entender de qué va vuestra web",
    why: "Faltan elementos básicos, como el título y la descripción que aparecen en los resultados o un encabezado claro. Sin eso, Google no sabe en qué búsquedas mostraros y os quedáis por detrás.",
    stats: ["backlinko"],
    fix: "Ajustar títulos, descripciones y encabezados de cada página con las palabras con las que os busca la gente de vuestra zona.",
  },
  legal: {
    problem: "Faltan los textos legales de la web",
    why: "El aviso legal y las políticas de privacidad y cookies no son un trámite: la ley los exige a cualquier web de un negocio, y quien os deja sus datos espera encontrarlos.",
    stats: ["lssi"],
    fix: "Redactar y publicar los textos legales y un aviso de cookies como manda la normativa.",
  },
  shop: {
    problem: "Vendéis productos, pero no se pueden comprar online",
    why: "Hay clientes que os comprarían a las once de la noche, o desde fuera de la zona, y ahora mismo no pueden hacerlo.",
    stats: ["ine"],
    fix: "Una tienda online sencilla, con vuestros productos, pagos y envíos, que podáis gestionar vosotros.",
  },
  basque: {
    problem: "La web no está en euskera",
    why: "Una parte de vuestra clientela vive en euskera, y encontrarse la web en su idioma acerca mucho. Para trabajar con entidades públicas, además, suele ser imprescindible.",
    stats: ["csa"],
    fix: "Añadir la versión en euskera, con una traducción revisada y no automática.",
  },
  favicon: {
    problem: "La pestaña del navegador no muestra vuestra marca",
    why: "Es un detalle pequeño (el icono de la pestaña, de los favoritos o del acceso directo en el móvil), pero es en los detalles donde se nota si una marca está cuidada.",
    stats: [],
    fix: "Crear el icono a partir de vuestro logotipo y aplicarlo en la web.",
  },
  logo_quality: {
    problem: "El logotipo no está a la altura del negocio",
    why: "El logotipo aparece en todas partes: rótulo, web, redes, facturas… Si se ve pixelado, anticuado o poco profesional, le quita valor a todo lo demás.",
    stats: ["stanford"],
    fix: "Rediseñar o redibujar el logotipo para que sea nítido y funcione en cualquier tamaño, del rótulo a la foto de perfil.",
  },
  visual_consistency: {
    problem: "La imagen no sigue una misma línea",
    why: "Colores que cambian, varias tipografías, estilos que no casan… Cuando la imagen no sigue un sistema, cuesta reconoceros y el conjunto parece improvisado.",
    stats: ["stanford"],
    fix: "Definir un sistema visual sencillo (colores, tipografías y estilo de imagen) y aplicarlo en la web, las redes y la papelería.",
  },
  photo_quality: {
    problem: "Las fotos no enseñan lo que hacéis de verdad",
    why: "Las fotos de banco las tiene cualquiera, y las oscuras o borrosas restan. La gente quiere ver vuestro local, vuestro equipo y vuestro trabajo.",
    stats: ["gbp_photos"],
    fix: "Una sesión de fotos propia, pensada para usarla en la web, en Google y en redes.",
  },
  social: {
    problem: "Las redes sociales no están conectadas con la web",
    why: "Quien llega a la web y quiere ver vuestro día a día no encuentra cómo hacerlo. Y debería pasar también al revés: que las redes lleven a la web.",
    stats: ["social"],
    fix: "Enlazar los perfiles desde la web y darles una línea visual común con plantillas propias.",
  },
  gbp_exists: {
    problem: "No aparecéis en Google Maps",
    why: "Cuando alguien busca lo que hacéis «cerca de mí», Google enseña primero el mapa con las fichas de los negocios. Si no tenéis ficha, sencillamente no estáis en esa lista.",
    stats: ["gbp_trust"],
    fix: "Crear y verificar la ficha de Google con su categoría, horario, fotos, web y teléfono.",
  },
  gbp_website: {
    problem: "Vuestra ficha de Google no lleva a la web",
    why: "Mucha gente os encuentra en el mapa y quiere saber más antes de llamar o ir. Si la ficha no enlaza la web, ahí se corta el camino.",
    stats: ["gbp_clicks", "gbp_trust"],
    fix: "Enlazar la web en la ficha y completar el resto de datos.",
  },
  gbp_photos: {
    problem: "La ficha de Google tiene pocas fotos",
    why: "Antes de ir a un sitio nuevo, la gente mira las fotos. Una ficha casi vacía hace dudar.",
    stats: ["gbp_photos", "gbp_trust"],
    fix: "Subir buenas fotos del local, del equipo y del trabajo, y renovarlas de vez en cuando.",
  },
  gbp_hours: {
    problem: "La ficha de Google no tiene horario",
    why: "Si alguien no sabe si estáis abiertos, no se arriesga a ir: busca otro sitio.",
    stats: ["gbp_hours", "gbp_trust"],
    fix: "Publicar el horario, incluidos festivos y vacaciones.",
  },
};

export type AuditFinding = {
  id: string;
  problem: string;
  seen: string;
  why: string;
  stat: AuditStat | null;
  fix: string;
};

/**
 * Hallazgos ordenados por importancia, con una cifra distinta en cada uno
 * cuando es posible (no se repite la misma cifra en el documento).
 */
export function buildFindings(results: CriterionResult[]): AuditFinding[] {
  const used = new Set<string>();
  return results
    .filter((r) => r.met === false && FINDINGS[r.id] && CRITERIA_BY_ID[r.id])
    .sort((a, b) => CRITERIA_BY_ID[b.id].weight - CRITERIA_BY_ID[a.id].weight)
    .map((r) => {
      const copy = FINDINGS[r.id];
      const statId = copy.stats.find((s) => !used.has(s));
      if (statId) used.add(statId);
      return {
        id: r.id,
        problem: copy.problem,
        seen: r.evidence,
        why: copy.why,
        stat: statId ? STATS[statId] : null,
        fix: copy.fix,
      };
    });
}
