# FALBER — Documento maestro

Tienda online de decants y perfumes · Next.js + Supabase · v1.0 · 2026-10-04

Este documento reemplaza a `FALBER_arquitectura_tienda_y_Supabase.pdf`: toma esa propuesta como base, corrige lo necesario y suma el flujo de trabajo con skills.

| Archivo | Para qué sirve |
|---|---|
| `docs/FALBER_documento_maestro.md` | Este documento, para que lo lea el agente (Claude Code) |
| `docs/FALBER_documento_maestro.pdf` | El mismo contenido, para que lo leas vos |
| `supabase/migrations/0001_initial_schema.sql` | La base de datos definitiva, lista para ejecutar |
| `supabase/tests/schema.test.cjs` | 49 pruebas automáticas que verifican esa base de datos |

---

## 0. Conceptos: esquema, migración y tests

Si nunca trabajaste con una base de datos "de verdad", estas tres palabras aparecen todo el tiempo.

### Esquema = el plano de la base de datos

Es la definición de **qué tablas existen, qué columnas tienen y qué reglas cumplen**. Sigue sin haber datos: es el molde. Por ejemplo: "la tabla `orders` tiene un `total`, y si el pago es en efectivo, la entrega tiene que ser retiro".

Analogía con Java: el esquema es como la **definición de las clases** (atributos + validaciones). Las filas de la tabla son los **objetos**.

### Migración = el esquema escrito como un archivo SQL ejecutable

En vez de crear las tablas haciendo clicks en el panel de Supabase, se escriben en un archivo `.sql` que se ejecuta una vez y crea todo. Por qué conviene:

- **Se puede repetir:** si mañana creás otro proyecto en Supabase (pruebas, producción), ejecutás el mismo archivo y queda idéntico.
- **Queda en Git:** se ve quién cambió qué y cuándo, igual que el código.
- **Es incremental:** cuando haya que cambiar algo (por ejemplo, agregar Mercado Pago), no se edita `0001`; se crea `0002_add_mercadopago.sql`. Cada archivo es un "paso" en la historia de la base de datos.

Para aplicarla: Supabase → *SQL Editor* → pegar el contenido de `0001_initial_schema.sql` → *Run*. Más adelante podés usar la CLI de Supabase para que lo haga automáticamente.

### Por qué la lógica está en la base de datos y no solo en Next.js

La propuesta original validaba precios y stock en el servidor de Next.js. Este documento mueve las reglas críticas **adentro de la base de datos** (constraints, triggers y una función `create_order`):

- **Constraint:** una regla que la DB nunca deja romper. Ej: `stock >= 0`. Ningún bug de la web puede dejar stock negativo.
- **Trigger:** código que la DB ejecuta sola cuando pasa algo. Ej: cuando un pedido pasa a "cancelado", devuelve el stock.
- **Función (RPC):** un procedimiento que se ejecuta entero o no se ejecuta. `create_order` crea el pedido, los ítems y descuenta el stock **en un solo paso**: si algo falla, no queda nada a medias.

El criterio: el frontend puede tener bugs y cualquiera puede manipular lo que manda el navegador; la base de datos es la última línea de defensa.

### Tests del esquema = comprobar que las reglas funcionan

`schema.test.cjs` levanta un Postgres temporal, aplica la migración y **ataca** la base con 49 escenarios: comprar sin stock, pagar en efectivo con envío, que un visitante intente leer pedidos ajenos, cancelar dos veces... y verifica que la DB responda como debe. Hoy pasan los 49.

Es lo mismo que un test JUnit, pero para la base de datos: si en el futuro cambiás una regla y rompés otra sin darte cuenta, el test te avisa.

---

## 1. Veredicto de la revisión

**La propuesta original es buena.** Estas decisiones de fondo son correctas y se mantienen:

- Separar `products` de `product_variants` (un perfume, varias presentaciones).
- Guardar un *snapshot* de nombre y precio en `order_items`.
- Checkout como invitado, sin cuentas de cliente.
- `stock_movements` como historial del stock.
- No confiar en el frontend para precios ni stock.
- La lista de cosas fuera del MVP.

Pero tenía huecos que, en producción, se convierten en pedidos rotos, stock negativo o datos expuestos.

### CRÍTICO — bugs o seguridad

| # | Problema | Qué pasaba | Corrección |
|---|---|---|---|
| C1 | El pedido se crea con varias llamadas separadas | Si falla en el 2º ítem, queda un pedido sin ítems o stock descontado sin pedido | `create_order` en la DB: todo o nada |
| C2 | Dos personas compran la última unidad a la vez | Las dos ven "hay 1", las dos compran: stock -1 | Bloqueo de la fila (`FOR UPDATE`) + `stock >= 0` |
| C3 | `stock` y `stock_movements` podían no coincidir | Dos fuentes de verdad: tarde o temprano difieren | El stock solo cambia vía movimientos; la columna no se puede editar, ni el admin |
| C4 | `/pedido/[id]` sin definir qué muestra | Con `FAL-0027` en la URL, cualquiera prueba números y ve nombre, teléfono y dirección | URL con UUID (no adivinable) + resumen sin datos sensibles |
| C5 | Pedidos sin límite | Cada pedido reserva stock: alguien puede "agotar" el catálogo con pedidos falsos | Máx. 3 pendientes por WhatsApp, 10 u. por ítem, 20 ítems por pedido |
| C6 | Las funciones quedaban expuestas a la API pública de Supabase | Se podía saltear el servidor de Next.js con la *anon key* (que es pública) | Solo el servidor (`service_role`) ejecuta las funciones |

### IMPORTANTE — diseño

| # | Cambio | Por qué |
|---|---|---|
| I1 | Se agrega el botón "Enviar pedido por WhatsApp" con mensaje armado | El flujo original terminaba en "FALBER contacta al cliente" |
| I2 | `customers.whatsapp` único y normalizado (`+5492215551234`) | Si no, cada compra crea un cliente nuevo y no ves el historial de una persona |
| I3 | Cancelar un pedido devuelve el stock automáticamente | Si no, cada cancelación "pierde" unidades |
| I4 | `total` calculado por la DB (subtotal + envío) | Imposible que quede desincronizado |
| I5 | Se agrega `shipping_cost` (`null` = a coordinar) | Estaba en el texto pero no en el SQL |
| I6 | Reglas de negocio como constraints | "Efectivo solo con retiro" no depende de que la web se acuerde |
| I7 | Se elimina el estado `payment_pending` | Duplicaba a `confirmed` (confirmado + transferencia = esperando pago) |
| I8 | Numeración `FAL-0001` con secuencia | `count(*) + 1` repite números con pedidos simultáneos |
| I9 | `perfume_requests.variant_id` opcional | Distingue "agotado" de "no lo tenemos" sin otra tabla |
| I10 | Índices en las claves foráneas | Postgres no los crea solo; sin ellos el admin se vuelve lento |
| I11 | `updated_at` automático | El texto lo pedía, el SQL no lo tenía |

### MEJORA — consistencia

| # | Cambio | Por qué |
|---|---|---|
| M1 | `gender` en inglés (`male / female / unisex`) | El resto de los valores estaba en inglés; mezclar idiomas genera errores de tipeo. La UI traduce |
| M2 | `text + check` en vez de `enum` | Un `enum` no permite quitar valores y es incómodo de cambiar |
| M3 | `image_url` → `image_path` | Guardar la ruta en el bucket, no la URL: si cambia el dominio no hay que tocar datos |
| M4 | Encargos con 6 estados | Cada estado tiene que corresponder a una acción tuya |
| M5 | Vista `perfume_requests_ranking` | El "top de perfumes pedidos" listo para el dashboard |

---

## 2. Decisiones cerradas

### A. ¿Calcular decants a partir de los ml del frasco? → No en el MVP

El stock se maneja en **unidades por variante** ("8 decants de 5 ml de Sauvage").

- Es lo más simple que funciona: cargás cuántos decants tenés (o te comprometés a vender) y el sistema descuenta.
- Calcular ml obliga a modelar frascos, mermas y qué frasco alimenta qué variante: es un sistema de inventario aparte.
- Ese cálculo **ya existe en Decant Manager**. Duplicarlo crea dos fuentes de verdad.

**Riesgo:** el decant de 5 ml, el de 10 ml y el frasco completo de un mismo perfume salen del mismo frasco físico. En el MVP lo controlás vos al cargar el stock. Revisarlo cuando pases de ~30 perfumes o empieces a sobrevender: la evolución natural es sincronizar el stock desde Decant Manager.

### B. ¿Cuándo se descuenta el stock? → Al crear el pedido (reserva)

Si se descontara al confirmar, dos clientes podrían pedir la última unidad. A cambio aparecen los pedidos abandonados. **MVP:** el dashboard muestra los pendientes de más de 48 h, los cancelás a mano y el stock vuelve solo. **Después:** cancelación automática con `pg_cron`.

### C. ¿WhatsApp automático o con botón? → Botón en la confirmación

- Los navegadores bloquean abrir otra app después de una espera: la redirección automática falla en silencio, sobre todo en iPhone.
- El cliente ve su número de pedido antes de salir. Si no manda el mensaje, el pedido igual queda en `/admin`.

### D. ¿Quién crea pedidos? → Solo el servidor

```
Navegador → Server Action (valida con zod, normaliza WhatsApp)
          → supabase.rpc('create_order') con service_role (solo servidor)
          → la DB vuelve a validar todo (precio, stock, reglas)
```

Doble validación a propósito: el Server Action da mensajes de error amigables; la DB es la última defensa.

---

## 3. Arquitectura

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| UI | Next.js (App Router) + TypeScript + Tailwind | Catálogo, producto, carrito, checkout, admin |
| Servidor | Server Actions de Next.js | Validar (zod), normalizar WhatsApp, llamar a las funciones |
| Datos | Supabase PostgreSQL | Tablas, reglas, seguridad (RLS), `create_order` |
| Auth | Supabase Auth | Solo para el admin |
| Imágenes | Supabase Storage (`product-images`) | Lectura pública, escritura solo admin |
| Deploy | Vercel + Supabase | — |

**Regla de dependencias:** el catálogo se lee directo (es público). Todo lo que escribe pasa por Server Action → función de la DB.

### Rutas

| Ruta | Función |
|---|---|
| `/` | Home: hero, destacados, decants, perfumes, CTA de encargos |
| `/catalogo` | Catálogo con búsqueda y filtros |
| `/producto/[slug]` | Detalle y variantes; "Solicitar disponibilidad" si está agotado |
| `/carrito` | Guardado en `localStorage`: solo `variant_id` + cantidad, nunca precios |
| `/checkout` | Datos, entrega, pago, aclaración, resumen |
| `/pedido/[id]` | Confirmación + botón de WhatsApp (`id` = UUID) |
| `/encargos` | "¿No encontrás tu perfume?" |
| `/admin` | Dashboard: pendientes, pendientes de más de 48 h, stock bajo, top encargos |
| `/admin/productos` | Alta, edición, activar/desactivar, imágenes, variantes, precios |
| `/admin/stock` | Cargar, reponer y ajustar stock + historial |
| `/admin/pedidos` | Detalle, cambio de estado, costo de envío |
| `/admin/solicitudes` | Encargos y ranking |

---

## 4. Modelo de datos (8 tablas)

```
PRODUCTS ──1:N──► PRODUCT_VARIANTS ──1:N──► STOCK_MOVEMENTS (historial)
                       ▲        ▲
                       │        └──── (opcional) PERFUME_REQUESTS
                       │                              │ N:1
                  ORDER_ITEMS                         ▼
                       │ N:1                      CUSTOMERS
                       ▼                              ▲
                    ORDERS ───────────── N:1 ─────────┘

AUTH.USERS ──1:1──► PROFILES (role = admin)
```

### products — el perfume

| Campo | Tipo | Notas |
|---|---|---|
| name, brand | text | Obligatorios |
| slug | text | Único, formato `dior-sauvage-edt` |
| description | text | |
| image_path | text | Ruta en el bucket |
| gender | text | `male` / `female` / `unisex` |
| status | text | `active` / `inactive` (nunca se borra un producto vendido) |

### product_variants — lo que se vende

| Campo | Tipo | Notas |
|---|---|---|
| product_id | uuid | FK |
| variant_type | text | `decant` / `full_bottle` |
| size_ml | integer | > 0 |
| price | numeric(12,2) | ≥ 0 |
| stock | integer | ≥ 0 — se actualiza solo desde el historial |
| is_available | boolean | Ocultar una variante sin tocar el stock |

### customers — compradores invitados

| Campo | Tipo | Notas |
|---|---|---|
| full_name | text | 2 a 80 caracteres |
| whatsapp | text | Único, formato `+5492215551234` |
| email | text | Opcional |

### orders — el pedido

| Campo | Notas |
|---|---|
| order_number | `FAL-0001` automático |
| status | Ver diagrama abajo |
| payment_method | `transfer` / `cash` |
| delivery_method | `pickup` / `delivery` |
| shipping_cost | `null` = a coordinar |
| delivery_address, city, postal_code, reference | Dirección y ciudad obligatorias si es envío |
| order_note | Máx. 100 caracteres |
| subtotal / total | Calculados por la DB |

**Estados:**

```
pending ─► confirmed ─► paid ─► preparing ─┬─► ready_for_pickup ─► completed  (retiro)
                                           └─► shipped ─────────► completed  (envío)
cualquiera ─► cancelled  (devuelve stock; no se reabre)
```

### order_items — lo comprado, congelado

`product_name`, `variant_label` y `unit_price` se copian al comprar. Si mañana Sauvage 5 ml pasa a $10.000, el pedido `FAL-0027` sigue mostrando $8.000.

### stock_movements — historial del stock

| Tipo | Signo | Cuándo |
|---|---|---|
| `initial_stock` | + | Carga inicial |
| `restock` | + | Reposición |
| `sale` | − | Al crear un pedido |
| `order_cancelled` | + | Al cancelar (automático) |
| `adjustment` | ± | Corrección tras un conteo |
| `damaged` | − | Rotura o pérdida |

El historial no se edita ni se borra: un error se corrige con un `adjustment`.

### perfume_requests — encargos

`variant_id` opcional (perfume existente agotado) o `perfume_name` + `brand` (perfume que no tenés). Estados: `pending → contacted → quoted → sourcing → completed` / `cancelled`.

### profiles — administradores

Vinculado al usuario de Supabase Auth. Se crea a mano una vez (instrucciones al final de la migración).

---

## 5. Flujo de compra con WhatsApp

1. El cliente arma el carrito.
2. En `/checkout` completa nombre, WhatsApp, entrega, pago, dirección si corresponde y aclaración.
3. El Server Action valida, normaliza el WhatsApp y llama a `create_order`.
4. La DB, en un solo paso: cliente, control anti-abuso, precio y stock reales, pedido, ítems y reserva de stock.
5. Redirige a `/pedido/[uuid]`: resumen, número `FAL-0042` y botón **"Enviar pedido por WhatsApp"**.
6. El cliente toca el botón: se abre WhatsApp con el mensaje listo.
7. Vos confirmás por chat y actualizás el estado en `/admin/pedidos`.

### Mensaje de ejemplo

```
¡Hola FALBER! Quiero confirmar mi pedido FAL-0042

• 2x Dior Sauvage EDT — Decant 5 ml ($16.000)
• 1x Azzaro The Most Wanted — Decant 10 ml ($14.000)

Total: $30.000
Entrega: Retiro en La Plata
Pago: Transferencia
```

### Código y primer test (TDD)

`buildWhatsAppMessage` es una función pura (recibe un pedido, devuelve texto): el mejor lugar para tu primer test del proyecto.

```ts
// src/lib/whatsapp.ts
export function buildWhatsAppMessage(order: OrderSummary): string {
  const items = order.items.map(
    (i) => `• ${i.quantity}x ${i.productName} — ${i.variantLabel} (${formatARS(i.lineTotal)})`
  );
  return [
    `¡Hola FALBER! Quiero confirmar mi pedido ${order.orderNumber}`,
    '',
    ...items,
    '',
    `Total: ${formatARS(order.total)}`,
    `Entrega: ${order.deliveryMethod === 'pickup' ? 'Retiro en La Plata' : 'Envío a domicilio'}`,
    `Pago: ${order.paymentMethod === 'transfer' ? 'Transferencia' : 'Efectivo'}`,
  ].join('\n');
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}
```

```ts
// src/lib/whatsapp.test.ts (Vitest)
it('incluye número de pedido, ítems y total', () => {
  const msg = buildWhatsAppMessage(pedidoDeEjemplo);
  expect(msg).toContain('FAL-0042');
  expect(msg).toContain('2x Dior Sauvage EDT — Decant 5 ml');
  expect(msg).toContain('Total: $30.000');
});

it('codifica el mensaje para la URL', () => {
  const url = buildWhatsAppUrl('+5492215551234', '¡Hola!\nTotal: $30.000');
  expect(url).toBe('https://wa.me/5492215551234?text=%C2%A1Hola!%0ATotal%3A%20%2430.000');
});
```

> **Trampa con números argentinos:** en `wa.me` el número va con 54 + 9 y **sin** el 0 ni el 15: `0221 15 555-1234` → `5492215551234`. Escribí un test de normalización con 3 o 4 formatos que la gente tipea de verdad.

---

## 6. Reglas de negocio y dónde se garantizan

| Regla | Dónde |
|---|---|
| Efectivo solo con retiro | Constraint `cash_only_for_pickup` |
| Envío requiere dirección y ciudad | Constraint `delivery_requires_address` |
| No se vende sin stock | `create_order` + `stock >= 0` |
| Precio real, no el del navegador | `create_order` lee el precio de la DB |
| Producto inactivo no se compra | `create_order` |
| Historial de precios intacto | Copia en `order_items` |
| Cancelar devuelve stock una sola vez | Trigger de cambio de estado |
| Un cancelado no se reabre | Mismo trigger |
| Máx. 3 pendientes por cliente, 10 u. por ítem | `create_order` |

**Criterio:** si una regla es crítica para el negocio, vive en la DB. El frontend la repite solo para mostrar errores amigables.

---

## 7. Seguridad

| Quién | Qué puede hacer |
|---|---|
| Visitante | Leer productos y variantes activos. Nada más. |
| Usuario logueado no admin | Lo mismo que un visitante |
| Admin | Todo, salvo editar `stock` directo o borrar el historial |
| Servidor (`service_role`) | Ejecutar `create_order`, `create_perfume_request`, `get_order_summary` |

No olvidar al implementar:

1. `SUPABASE_SERVICE_ROLE_KEY` solo en el servidor, **nunca** con prefijo `NEXT_PUBLIC_`: esa clave saltea toda la seguridad.
2. `/admin` protegido dos veces: middleware de Next.js (redirige sin sesión) **y** RLS (aunque se saltee la UI, la DB no devuelve datos).
3. Validar con `zod` cada Server Action, incluido el largo de los textos.
4. Datos personales (Ley 25.326): una línea en el checkout que diga para qué se usan.
5. Si aparecen pedidos basura: Cloudflare Turnstile (captcha gratuito).

---

## 8. Plan de desarrollo con skills

Una **sesión nueva por fase** y un **commit al terminar cada una**. Al arrancar: *"Leé docs/FALBER_documento_maestro.md"*.

### Fase 0 — Preparación (sin Claude)

- Fotos reales, catálogo inicial, logo y número de WhatsApp.
- `git init` + commit: `docs(architecture): add FALBER master document and initial schema`.

### Fase 1 — Revisión del plan

```text
Usá /plan-eng-review sobre docs/FALBER_documento_maestro.md.
Buscá huecos antes de empezar a construir.
```

Ya hay una especificación: no hace falta brainstorming, hace falta que alguien la ataque.

### Fase 2 — Identidad visual

```text
Usá stitch-skill para generar el DESIGN.md de FALBER: perfumería contemporánea,
[tono]. Color de marca: [color]. Podés tomar la estructura del DESIGN.md de apple
de awesome-design-md, pero con identidad propia.
```

### Fase 3 — Base + Supabase

```text
Creá el proyecto Next.js + TypeScript + Tailwind según el documento maestro.
Configurá Supabase (clientes browser/server, middleware de /admin), aplicá
supabase/migrations/0001_initial_schema.sql y corré supabase/tests/schema.test.cjs.
```

### Fase 4 — Catálogo y producto

```text
Usá taste-skill siguiendo DESIGN.md. Construí /, /catalogo y /producto/[slug].
Diales: DESIGN_VARIANCE 6, MOTION_INTENSITY 4, VISUAL_DENSITY 3.
Antes de codear, decime qué dirección de diseño inferís.
```

### Fase 5 — Carrito, checkout y WhatsApp

```text
Usá superpowers:test-driven-development. Implementá carrito (localStorage, solo
variant_id + cantidad), checkout con zod, normalización de WhatsApp argentino,
Server Action que llama create_order con service_role, /pedido/[id] con
get_order_summary y el botón de WhatsApp.
```

### Fase 6 — Encargos

```text
Implementá /encargos y "Solicitar disponibilidad" en productos agotados
usando create_perfume_request. Seguí DESIGN.md.
```

### Fase 7 — Admin

```text
Construí /admin según el documento maestro: dashboard, productos, stock (solo vía
stock_movements), pedidos y solicitudes con ranking. Interfaz funcional: solo DESIGN.md.
```

En un panel interno importan más la claridad y la velocidad que la estética de marca.

### Fase 8 — Revisión y publicación

```text
/design-review   → QA visual
/qa              → carrito → pedido → WhatsApp → admin → cancelar
/cso             → auditoría de seguridad
/review          → revisión del código
```

### Flujo completo

```
plan-eng-review → stitch-skill → base + Supabase → taste-skill (UI)
   → TDD (checkout + WhatsApp) → encargos → admin
   → design-review → qa → cso → deploy
```

---

## 9. Fuera del MVP (y cuándo reconsiderarlo)

| Funcionalidad | Señal para agregarla |
|---|---|
| Mercado Pago | Muchos pedidos se caen en la transferencia |
| Cancelación automática de pendientes | Te cansás de cancelar a mano |
| Stock desde Decant Manager | Sobreventa o más de ~30 perfumes |
| Captcha | Aparecen pedidos falsos |
| Cuentas, favoritos, reviews, cupones | Clientes recurrentes que lo pidan |
| WhatsApp Business API | Volumen que no podés atender a mano |
| Varios admins | Sumás a alguien al negocio |

---

## 10. Checklist antes de publicar

- [ ] `schema.test.cjs` pasa (49/49).
- [ ] La `service_role key` no aparece en el cliente ni con `NEXT_PUBLIC_`.
- [ ] `/admin` sin sesión redirige; un usuario no admin no ve datos.
- [ ] Pedido de prueba completo en el celular: WhatsApp abre con el mensaje correcto.
- [ ] Cancelar un pedido de prueba devuelve el stock.
- [ ] Efectivo + envío muestra un error claro.
- [ ] Las fotos cargan desde el bucket.
- [ ] Prueba en iPhone y Android.
- [ ] Aviso de uso de datos personales en el checkout.
- [ ] Backups: en el plan gratuito de Supabase, exportar la base periódicamente.

---

## Anexo — Correr los tests del esquema

```bash
npm i -D @electric-sql/pglite
node supabase/tests/schema.test.cjs
```

PGlite es Postgres real compilado para Node: no hace falta instalar Postgres ni Docker.

**Huecos en la numeración:** un pedido rechazado (por ejemplo, sin stock) consume un número. Que exista `FAL-0003` y después `FAL-0005` es normal.
