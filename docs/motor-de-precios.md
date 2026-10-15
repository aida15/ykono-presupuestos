# Motor de precios

Código: `src/lib/domain/pricing.ts`, `src/lib/domain/payments.ts`, `src/lib/domain/money.ts`.
Pruebas: `src/lib/domain/__tests__/pricing.test.ts` (reproducen al céntimo los dos presupuestos de referencia).

## Principios

- **Determinista e independiente de la IA.** La IA nunca calcula ni escribe importes. Los textos que redacta pasan por un filtro (`stripMoney`) que elimina cualquier frase con cifras en euros.
- **Una sola implementación.** El editor (vista en vivo), las acciones de servidor (que guardan el snapshot) y el PDF usan las mismas funciones. Al generar el PDF se recalcula con los datos guardados y se comprueba que el total coincide con el almacenado; si no, se bloquea.
- **Sin coma flotante.** Importes en céntimos enteros; porcentajes y tipos en puntos básicos (21 % = 2100); cantidades y horas en centésimas (1,5 h = 150).

## Métodos de cálculo

| Método | Importe bruto |
|---|---|
| Precio fijo | precio × cantidad (normalmente 1) |
| Por unidad | precio unitario × cantidad |
| Por horas | tarifa horaria × horas |
| Base + complementos | (base + Σ complemento × cantidad del complemento) × cantidad |
| Por complejidad | (base × factor del nivel) × cantidad |
| Manual | precio × cantidad |
| Coste externo | precio × cantidad, con tratamiento fiscal propio |

Una partida **pendiente de valoración** o sin datos suficientes no tiene importe (`null`) y bloquea el cierre.

## Orden de aplicación

1. Importe bruto de cada partida.
2. Descuento de partida (pb) → **neto de partida**.
3. Clasificación:
   - opcional no incluido → se informa aparte, no suma;
   - externo **informativo** (lo contrata el cliente a su nombre) → se informa, no suma;
   - externo **suplido** (pagado en nombre del cliente) → suma al total, fuera de la base imponible, sin IVA;
   - externo **refacturado** → suma a la base imponible con IVA;
   - resto → trabajo propio de YKONO.
4. **Descuento global** (pb) solo sobre el trabajo propio incluido.
5. **Base imponible** = trabajo propio − descuento global + externos refacturados.
6. **IVA** por tipo impositivo, calculado sobre la base de cada grupo (el descuento global se reparte entre grupos de forma proporcional y exacta).
7. **Total** = base imponible + IVA + suplidos.

## Redondeo

Una sola vez por operación, al céntimo, *half away from zero* (0,005 € → 0,01 €).
Los repartos (descuento global entre tipos de IVA, IVA entre pagos) usan reparto proporcional con ajuste del último elemento, de modo que las partes siempre suman exactamente el todo.

## Calendario de pagos

Cada pago tiene neto (sin IVA) y total (con IVA), y ambas columnas suman exactamente el importe acordado:

- **Por porcentajes:** deben sumar 100 %. El último pago absorbe los céntimos de redondeo.
- **Por importes:** la usuaria fija el neto; deben sumar exactamente el acordado. El total con IVA se reparte en proporción, con ajuste en el último.

No hay anticipo universal: se usan los pagos por defecto de Configuración (inicialmente 50 % / 50 %, como en el presupuesto de pantallas) o los definidos en cada presupuesto.

## Precios históricos

Las tarifas del catálogo son **versionadas e inmutables** (un trigger impide reescribirlas). Al añadir un servicio a un presupuesto se copia la tarifa vigente en `rule_snapshot`, y el presupuesto guarda sus propios importes. Cambiar el catálogo no altera presupuestos existentes.

Cada PDF definitivo queda registrado en `generated_documents` con una copia completa de los datos que lo originaron, su SHA-256 y, si el archivo documental está activo, el propio PDF en Supabase Storage.
