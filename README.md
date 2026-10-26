# YKONO Quote Studio

Herramienta interna de YKONO para preparar presupuestos y propuestas comerciales: entrevista guiada por IA, catálogo de servicios con tarifas versionadas, motor de precios determinista, editor de propuestas y PDF editorial con la identidad de YKONO.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript estricto · Tailwind CSS 4 · Supabase (PostgreSQL, Auth, Storage, RLS) · Claude API · Zod · @react-pdf/renderer · Vitest · Vercel.

---

## Puesta en marcha

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com) (región UE, p. ej. Frankfurt).
2. **SQL Editor** → ejecuta en este orden:
   1. `supabase/migrations/20261014000001_core_schema.sql`
   2. `supabase/migrations/20261014000002_security_and_functions.sql`
   3. `supabase/seed.sql` (estudio YKONO, configuración, 40 servicios con tarifas y 56 preguntas de briefing)

   Con la CLI de Supabase: `supabase link --project-ref <ref>` y `supabase db push`, y luego ejecuta `seed.sql`.
3. **Authentication → Sign In / Providers → Email**: desactiva **«Allow new users to sign up»**. No hay registro público.
4. **Authentication → Users → Add user**: crea la usuaria (email + contraseña, «Auto confirm»). Aida y Mer comparten este acceso.
5. **SQL Editor**: edita el email en `supabase/bootstrap.sql` y ejecútalo para asociar la usuaria al estudio.
6. **Authentication → URL Configuration**: pon la URL de Vercel como *Site URL*.

### 2. Vercel

1. Sube el repositorio a GitHub e impórtalo en Vercel (framework detectado: Next.js; sin ajustes de build).
2. **Settings → Environment Variables** (Production y Preview):

| Variable | Dónde se obtiene | Ámbito |
|---|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API | público |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API (anon / publishable) | público |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | **solo servidor** |
| `GOOGLE_API_KEY` (o `GOOGLE_PI_KEY`) | console.cloud.google.com → APIs: *Places API (New)* y *PageSpeed Insights API* | **solo servidor**, para Leads |

También valen `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Si cambias estas variables, **vuelve a desplegar**: el login del navegador las incorpora al compilar.

3. Despliega. Las funciones de IA y PDF tienen `maxDuration` de 60–120 s (el plan Hobby permite hasta 60 s; con Pro no hay problema).

La aplicación **nunca** usa la *service role key* de Supabase: todo pasa por la sesión de la usuaria y RLS.

### 3. Local

```bash
cp .env.example .env.local   # y rellena las variables
npm install
npm run dev                  # http://localhost:3000
npm run check                # typecheck + lint + tests + build
```

Sin `ANTHROPIC_API_KEY` la app funciona igual: la entrevista pasa a **modo guiado** (preguntas comunes en orden) y el borrador usa textos de respaldo construidos con los datos recogidos.

---

## Cómo se usa

1. **Crear presupuesto** → *Entrevista con IA* o *Crear manualmente*.
2. **Entrevista:** describe el encargo con tus palabras. El asistente clasifica el proyecto (revisable), extrae varios datos por mensaje, pregunta solo lo que falta y propone servicios del catálogo. Las **sugerencias** se añaden, descartan o dejan *pendientes* con un clic: nada que suba el precio entra sin tu confirmación.
3. **Resumen editable** → **Generar borrador**: crea cliente y proyecto si no existían, partidas desde el catálogo (con la tarifa copiada) y textos redactados por la IA.
4. **Editor:** tres paneles (datos y secciones · fases/partidas/textos/pagos · resumen económico y vista previa). Guardado explícito (Ctrl+S) y autoguardado cada 20 s, deshacer/rehacer, reordenar secciones y fases, opcionales, descuentos, IVA por partida y costes de terceros.
5. **Marcar definitivo:** el servidor valida datos fiscales del cliente, partidas sin valorar o estimaciones sin aprobar y cuadre de pagos. Congela una copia de los datos del cliente.
6. **PDF:** la vista previa lleva marca «BORRADOR» mientras haya cosas pendientes. La descarga definitiva queda versionada (Doc. 1, 2…) con su snapshot de datos y copia en Storage.
7. **Nueva versión** (YK-2026-004 v2) o **duplicar** (número nuevo) para modificar algo ya cerrado.

Estados: Borrador → Definitivo → Enviado → Aceptado / Rechazado; cualquiera puede archivarse.

---

## Arquitectura

```
src/
  app/
    (app)/                 páginas privadas (layout comprueba sesión y estudio)
      presupuestos/[id]/   editor (cliente) — editor/*.tsx
      entrevistas/[id]/    entrevista y resumen
      clientes/ catalogo/ configuracion/
    api/quotes/[id]/pdf    vista previa y descarga (valida, archiva, versiona)
    api/documents/[id]     descarga de PDFs archivados
    login/ setup/
  proxy.ts                 refresco de sesión y redirección a /login (antes «middleware»)
  lib/
    domain/                lógica pura y testeada: dinero, precios, pagos, validación
    interview/             estado estructurado, prompts, fusión de parches, borrador
    ai/claude.ts           llamadas con salida estructurada (tool use + Zod, reintento)
    pdf/                   plantilla editorial, construcción de datos y render
    data/ actions/         acceso a datos y Server Actions (todas re-verifican sesión)
    brand/logo-paths.ts    logotipo vectorizado de los PDF oficiales
supabase/
  migrations/              esquema, RLS, triggers, funciones (save_quote_bundle, numeración)
  seed.sql                 generado con `npm run seed:build` desde src/lib/catalog/seed-data.ts
tests/
  db/                      migraciones + RLS sobre PGlite (Postgres real en WASM)
  pdf/                     render de presupuestos de ejemplo (datos ficticios)
```

### Decisiones técnicas

- **Cache Components desactivado.** Toda la app es privada y depende de cookies de sesión; el renderizado dinámico es más simple y no deja datos en cachés compartidas.
- **Seguridad en capas.** `proxy.ts` redirige sin sesión; cada página, Server Action y Route Handler vuelve a validar con `supabase.auth.getUser()` y pertenencia al estudio; RLS en todas las tablas (`force row level security`), triggers que impiden filas hijas de otro estudio, buckets privados con carpeta por estudio.
- **Multiusuario preparado.** Todo cuelga de `studios` y `studio_members`; añadir otra persona es un `add_studio_member`.
- **Guardado atómico.** El presupuesto completo (cabecera, fases, partidas, secciones, pagos y snapshot de totales) se guarda en una sola función SQL `save_quote_bundle` con `SECURITY INVOKER` (aplica RLS). Solo se pueden editar borradores.
- **IA con salida estructurada.** La entrevista devuelve un parche validado con Zod que se fusiona de forma conservadora: no borra datos, solo acepta servicios del catálogo con una frase de la usuaria que los respalde, las recomendaciones entran siempre «pendientes» y la IA no puede confirmar la clasificación.
- **Numeración** `YK-AAAA-NNN` correlativa por estudio y año, con contador transaccional; el prefijo es configurable.
- **Costes de terceros** con tres tratamientos (informativo, refacturado con IVA, suplido sin IVA). Por defecto, *informativo*, como en los presupuestos de referencia.
- **Logotipo.** Vectorizado a partir de los PDF oficiales (`scripts/vectorize-logo.py`). Colores tomados de la propuesta de referencia: tinta `#111111`, lima `#B4E600`, superficie `#F3F3EE`. Tipografía Helvetica (la de los documentos); se puede sustituir el logotipo desde Configuración.
- **Componentes de interfaz propios** con Tailwind en lugar de generar shadcn/ui: son pocos, sin dependencias y con la estética del estudio.

Detalle del cálculo: [`docs/motor-de-precios.md`](docs/motor-de-precios.md).

### Tarifas iniciales

Los precios del seed son **una propuesta inicial** para arrancar (no salen de los PDF de referencia). Revísalos en *Catálogo y tarifas*: cada cambio crea una versión nueva y los presupuestos guardados conservan la suya. Los servicios por horas de alcance incierto (dirección de arte, funcionalidad a medida) entran como *estimación pendiente de aprobación*.

---

## Pruebas

```bash
npm test
```

- **Motor de precios** (20 casos): métodos, redondeo, descuentos, IVA por tipos, externos, opcionales, pagos; reproduce al céntimo el presupuesto de pantallas (2.070 € + IVA = 2.504,70 €) y la propuesta por fases (8.200 € + IVA = 9.922 €, 4 × 2.178 € + 1.210 €).
- **Base de datos** (9 casos sobre PGlite): migraciones y seed reales, RLS entre usuarias, numeración, guardado atómico e ida y vuelta de un presupuesto completo, inmutabilidad de tarifas, integridad entre estudios, Storage.
- **Entrevista** (7 casos): fusión de parches, guardas frente a la IA, modo guiado, composición del borrador.
- **PDF** (3 casos): render de un presupuesto sencillo y de una propuesta por fases, nombres de archivo.

`PDF_OUT_DIR=/tmp/pdf npm test -- tests/pdf` guarda los PDF de ejemplo para revisarlos.

## Pendiente / siguientes pasos

- Probar en un proyecto Supabase real (las migraciones están probadas sobre PostgreSQL en PGlite, no sobre Supabase).
- Ajustar las tarifas iniciales y las condiciones por defecto.
- Si se quiere tipografía corporativa propia en el PDF, añadir los archivos de fuente y registrarlos con `Font.register`.

## Leads

`/leads` busca negocios en Google (Places API) o los añade a mano y analiza cada uno en dos pasos: datos (web, ficha de Google, velocidad móvil) y argumentario (IA con captura y logo, o plantilla si no hay IA). Para cada lead muestra lo que cumple y lo que no con su evidencia, señales de momento, productos del catálogo con precio, argumentos internos, argumentos para el cliente, objeciones y un primer mensaje. No usa reseñas, valoraciones, empleados ni facturación. Un lead se convierte en cliente + presupuesto en borrador con un clic.
