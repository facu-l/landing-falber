# FALBER — Documento maestro

Tienda online de decants y perfumes · Next.js + Supabase · v2.1 · 2026-10-05

**v2.0:** incorpora el design system FALBER y las 15 decisiones de la revisión de ingeniería (`/plan-eng-review`). El reporte está al final del documento.
**v2.1:** Fase 1 terminada (PR #1). Prompt real de la Fase 1 y las decisiones 16 a 25, tomadas al implementarla (sección 3.F).
**v2.2:** Fase 2 implementada en `feat/catalog`. Decisiones 26 a 33 (sección 3.G) y lecciones nuevas.

| Archivo | Para qué sirve |
|---|---|
| `docs/FALBER_documento_maestro.md` | Este documento, para el agente (Claude Code) |
| `docs/FALBER_documento_maestro.pdf` | El mismo contenido, para vos |
| `DESIGN.md` | El sistema visual: colores, tipografía, componentes, logos y voz |
| `design/falber-tokens.json` | Los tokens del design system, copiados del artifact |
| `supabase/migrations/0001_initial_schema.sql` | La base de datos: tablas, reglas, seguridad y funciones |
| `supabase/migrations/0002_schedule_jobs.sql` | Tareas automáticas (pg_cron) |
| `supabase/tests/schema.test.cjs` | Pruebas automáticas de la base de datos |
| `TODOS.md` | Lo que queda para después, con la señal de cuándo hacerlo |

---

## 0. Conceptos: esquema, migración y tests

### Esquema = el plano de la base de datos

Define **qué tablas existen, qué columnas tienen y qué reglas cumplen**. Todavía no hay datos: es el molde. Analogía con Java: el esquema son las **clases** (atributos + validaciones); las filas de la tabla son los **objetos**.

### Migración = el esquema escrito como un archivo SQL ejecutable

En vez de crear las tablas con clicks en Supabase, se escriben en un `.sql` que se ejecuta y crea todo:

- **Se puede repetir:** un proyecto nuevo de Supabase queda idéntico ejecutando los mismos archivos.
- **Queda en Git:** se ve quién cambió qué y cuándo.
- **Es incremental:** después del primer deploy, `0001` no se toca más; cada cambio es un archivo nuevo (`0003_...`). **Mientras no haya deploy, `0001` se edita directamente** (decisión 15e).

Para aplicarla: Supabase → *SQL Editor* → pegar `0001` → *Run*; habilitar la extensión `pg_cron` → pegar `0002` → *Run*. En local: `npm run db:start` (o `npm run db:reset`) aplica las dos solas.

### Por qué la lógica está en la base de datos

- **Constraint:** una regla que la DB nunca deja romper. Ej: `stock >= 0`.
- **Trigger:** código que la DB ejecuta sola cuando pasa algo. Ej: al cancelar un pedido, devuelve el stock.
- **Función (RPC):** un procedimiento que se ejecuta entero o no se ejecuta. `create_order` crea pedido, ítems y reserva stock **en un solo paso**.
- **Enum:** un tipo con valores fijos (`'pending' | 'confirmed' | ...`). TypeScript lo recibe tal cual con `supabase gen types`.

El criterio: el navegador se puede manipular y la web puede tener bugs; la base de datos es la última línea de defensa. Y como varias reglas son triggers, valen **también** cuando editás desde Supabase Studio.

### Tests del esquema

`schema.test.cjs` levanta un Postgres temporal (PGlite), aplica la migración y la **ataca**: comprar sin stock, doble click, pedidos falsos, borrar un pedido desde Studio, saltear estados, un visitante leyendo pedidos ajenos. Se verificó con una **prueba de mutación**: al quitar una protección, el test correspondiente falla.

---

## 1. Design system FALBER

**Fuente de verdad:** https://claude.ai/artifact/8MRV6N7UQkE1uDYGWUBB9j. El detalle completo está en `DESIGN.md`; esto es lo que hay que saber antes de construir.

- **Concepto:** luz platino sobre negro carbón. Marca unisex, sobria, con mucho espacio en blanco.
- **Temas:** **Noir** (oscuro) en la tienda pública y **Platinum** (claro) en `/admin` (decisión 2).
- **Colores de marca:** `carbon-black` #0B0C0E · `graphite` #202226 · `platinum` #BFC2C5. En la UI se usan **siempre los tokens semánticos** (`surface`, `text`, `accent`...), nunca el hex directo.
- **Tipografía:** Cinzel (`display`, ceremonial, siempre en MAYÚSCULAS) + Montserrat (`sans`, todo lo funcional). Se cargan con `next/font/google`.
- **Forma:** esquinas rectas (`radius-none`) en botones, inputs y cards. Espaciado en escala de 4px; las secciones grandes respiran a 64–96px.
- **Voz:** frases cortas, títulos en mayúsculas, **sin emojis y sin signos de exclamación**. El nombre siempre `FALBER`. Cuenta: @falber.parfum. Línea: "Fragrance experience".
- **Componentes:** Button, Input y Card se **reimplementan** en `src/components/ui/` con los tokens. El bundle del artifact no se usa: pide React 18, Next.js usa React 19 y además no funciona en Server Components (decisión 1).
- **Logos:** solo existen como JPG grandes sobre negro (no hay vector). El header usa el nombre en tipografía `wordmark`; el favicon sale del monograma; todo pasa por `next/image` (decisión 9).

### Cómo entra al código

```
design/falber-tokens.json
        │
        ▼
src/app/globals.css
  [data-theme="dark"]  { --surface: #0b0c0e; ... }  ← Noir
  [data-theme="light"] { --surface: #f4f5f6; ... }  ← Platinum
  @theme { --color-surface: var(--surface); ... }   ← Tailwind v4
        │
        ▼
src/components/ui/Button.tsx, Input.tsx, Card.tsx
  className="bg-surface-raised text-text border-border"
```

---

## 2. Veredicto de la revisión de la propuesta original

**La propuesta original es buena.** Se mantienen: separar `products` de `product_variants`, el snapshot en `order_items`, el checkout como invitado, el historial de stock y la desconfianza hacia el frontend. Lo que se corrigió:

### CRÍTICO — bugs o seguridad

| # | Problema | Qué pasaba | Corrección |
|---|---|---|---|
| C1 | El pedido se creaba con varias llamadas separadas | Pedidos sin ítems o stock descontado sin pedido | `create_order` en la DB: todo o nada |
| C2 | Dos personas compran la última unidad a la vez | Stock en -1 | Bloqueo de la fila (`FOR UPDATE`) + `stock >= 0` |
| C3 | `stock` y el historial podían no coincidir | Dos fuentes de verdad | El stock solo cambia vía movimientos; un trigger lo garantiza incluso en Studio |
| C4 | `/pedido/[id]` sin definir qué muestra | Con `FAL-0027` cualquiera veía datos de clientes | URL con UUID + resumen sin datos sensibles |
| C5 | Pedidos falsos sin límite | Agotar el catálogo con pedidos que reservan stock | Turnstile + límite por IP + 3 pendientes por WhatsApp |
| C6 | Funciones expuestas a la API pública | Saltear el servidor con la *anon key* | Solo el servidor (`service_role`) ejecuta las funciones |
| C7 | Borrar un pedido | Su stock reservado se perdía para siempre | Los pedidos no se borran: se cancelan |
| C8 | Datos de un cliente pisables | Cualquiera con su número le cambiaba el nombre | No se pisan; cada pedido guarda su propio snapshot |

### IMPORTANTE y MEJORA

| # | Cambio | Por qué |
|---|---|---|
| I1 | Botón "Completar pedido en WhatsApp" | El canal de cierre de venta |
| I2 | `customers.whatsapp` único y normalizado | Historial por persona |
| I3 | Cancelar devuelve el stock | Sin pérdidas de unidades |
| I4 | `total` y `line_total` calculados por la DB | Nunca desincronizados |
| I5 | `shipping_cost` (`null` = a coordinar) | Por eso el resumen dice "Total estimado" |
| I6 | Reglas de negocio como constraints + validación con códigos | Doble red |
| I7 | Transiciones de estado válidas | No se puede volver de "completado" a "pendiente" |
| I8 | Numeración `FAL-0001` con secuencia | Sin números repetidos |
| I9 | Índices en las claves foráneas | El admin no se vuelve lento |
| M1 | Enums de Postgres (antes `text + check`) | Tipos generados para TS, sin listas duplicadas (decisión 5) |
| M2 | Columna generada `label` ("Decant 5 ml") | Una sola fuente para el nombre de la presentación (decisión 6) |
| M3 | `image_path` en vez de `image_url` | Independiente del dominio de Supabase |
| M4 | Vista `perfume_requests_ranking` | El top de perfumes pedidos |

---

## 3. Decisiones cerradas

### A. ¿Calcular decants a partir de los ml del frasco? → No en el MVP

El stock se maneja en **unidades por variante**. Riesgo: el decant de 5 ml, el de 10 ml y el frasco completo salen del mismo frasco físico. Ejemplo: un frasco de 100 ml cargado como "10 decants de 5 ml" y "5 decants de 10 ml". Si se venden 6 de 10 ml, al frasco le quedan 40 ml, pero la web sigue mostrando 50 ml en decants de 5. En el MVP lo controlás vos al cargar stock. La solución definitiva (que la web consulte los ml a **Decant Manager**) está en `TODOS.md`.

### B. ¿Cuándo se descuenta el stock? → Al crear el pedido (reserva)

Los pedidos `pending` de más de 48 h se **cancelan solos cada hora** (pg_cron) y el stock vuelve.

### C. ¿WhatsApp automático o con botón? → Botón en la confirmación

Los navegadores bloquean abrir otra app después de una espera, y así el cliente ve su número de pedido antes de salir.

### D. ¿Quién crea pedidos? → Solo el servidor

```
Navegador ──► Server Action
               1. verifica Turnstile (captcha invisible)
               2. valida con zod, normaliza WhatsApp, calcula hash de la IP
               3. supabase.rpc('create_order', { p_request_id, p_client_key, ... })  ← service_role
                      │
                      ▼
               create_order (DB, una transacción)
               idempotencia → validación → límite IP → cliente → límite pendientes
               → pedido → ítems (FOR UPDATE, precio y stock reales) → reserva de stock
                      │
               4. revalidateTag('catalog')  (el stock cambió)
               5. redirect('/pedido/<uuid>')
```

### E. Las 15 decisiones de la revisión de ingeniería

| # | Decisión |
|---|---|
| 1 | Design system: tokens → CSS + Tailwind; Button/Input/Card reimplementados (el bundle pide React 18) |
| 2 | Noir en la tienda, Platinum en `/admin` |
| 3 | Catálogo cacheado; se invalida (`revalidateTag('catalog')`) al editar en el admin **y** al crear o cancelar pedidos |
| 4 | Errores: `message` = código estable (`INSUFFICIENT_STOCK`), `detail` = dato; mapa en TS |
| 5 | Tipos generados con `supabase gen types`; estados y métodos como enums |
| 6 | Columna generada `product_variants.label` |
| 7 | Tests: Vitest (lógica) + Playwright (E2E) + tests del esquema |
| 8 | Idempotencia: `orders.request_id` único + botón deshabilitado mientras envía |
| 9 | `next/image` en todo, logos optimizados, favicon del monograma, wordmark tipográfico |
| 10 | **MVP con admin solo de pedidos**; productos, stock y encargos se operan desde Supabase Studio |
| 11 | Anti-abuso: Turnstile + límite por IP (5/hora) + snapshot del cliente sin pisar datos |
| 12 | Blindaje: pedidos no se borran, ítems inmutables, historial solo se agrega, stock solo vía historial (también en Studio), transiciones válidas, auditoría `created_by` |
| 13 | Hosting: **Netlify Free** (permite uso comercial; Vercel Hobby no) + keepalive y backup diario de Supabase |
| 14 | Un solo punto de retiro: "Retiro en La Plata" |
| 15 | Ajustes: caché también tras pedidos; `requireAdmin()` en cada acción; idempotencia busca primero; errores de constraints mapeados + log; probar 0001 contra `supabase start` |

### F. Decisiones de la Fase 1 (implementación, 2026-10-05)

| # | Decisión | Por qué |
|---|---|---|
| 16 | **Tokens en `src/app/globals.css`:** variables por tema (`:root` = Noir, `[data-theme="light"]` = Platinum) + `@theme inline`. Estilos de texto como utilidades `text-<estilo>` en `rem`; `display-xl` con `clamp()` (44 → 72 px). Un test (`src/styles/tokens.test.ts`) falla si el CSS se desfasa de `falber-tokens.json` | La sincronización es manual: un hex mal copiado no rompe nada visible |
| 17 | **Espaciado: escala de Tailwind, sin redefinirla.** Tabla de equivalencias en DESIGN.md (`space-5` = `6`, `space-12` = `24`) | Redefinirla rompería lo que se sabe de Tailwind; los nombres no coinciden a partir de `space-5` |
| 18 | **Sin `tailwind-merge`:** `cn()` solo une clases; el `className` de un componente es para layout | `tailwind-merge` confunde `text-label` con un color y lo borra en silencio |
| 19 | **Tres clientes de Supabase:** `client.ts` (navegador), `server.ts` (sesión por cookies, para el admin) y `service.ts` (`service_role`, solo para las 3 RPC). Los dos de servidor importan `server-only` | Si la clave de servicio se importa desde el cliente, la build falla |
| 20 | **Variables de entorno:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (clave publishable nueva, no la anon), `SUPABASE_SERVICE_ROLE_KEY` (acepta la secret `sb_secret_...`), `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `IP_HASH_SECRET`. Plantilla en `.env.example` con las claves de prueba de Turnstile (`1x00000000000000000000BB`: invisible, siempre pasa) | Un solo lugar documenta qué necesita cada entorno |
| 21 | **Registro público de Auth desactivado** (en local por `config.toml`; en la nube a mano, en el checklist) | Solo existe el admin: cualquier cuenta nueva es superficie de ataque gratis |
| 22 | **Storage en `0001`:** si faltan las tablas de Storage, la migración falla con `STORAGE_TABLES_MISSING`, salvo en local, donde existe el rol marcador `falber_local_dev` (`supabase/roles.sql`, que corre antes de las migraciones). Storage local no funciona con CLI 2.119 (TODOS.md) | En local `storage-api` crea sus tablas después de las migraciones; en la nube es mejor un deploy frenado que producción sin bucket ni policies |
| 23 | **Node 24** fijado en `.nvmrc` (lo leen CI, nvm y Netlify) y `@types/node@^24` | Los tipos tienen que corresponder al runtime real |
| 24 | **CI en cada PR** (`.github/workflows/ci.yml`): lint con 0 warnings, `typecheck` (`next typegen` + `tsc`), `test:db`, Vitest y build en un job; Playwright (escritorio + Pixel 7) sobre la build de producción en otro | Tests en verde en una sola máquina no alcanzan; el CI encontró dos fallos que en local no aparecían |
| 25 | **Git:** LF obligatorio (`.gitattributes`); lockfile validado en Linux (`npm ci` del runner); PRs con **merge commit** para conservar los commits atómicos. Sin protección de rama (repo privado en plan gratis): antes de mergear se verifica el CI en verde a mano, nunca con auto-merge | En el plan gratis, el auto-merge de GitHub no espera al CI |

### G. Decisiones de la Fase 2 (catálogo, 2026-10-05)

| # | Decisión | Por qué |
|---|---|---|
| 26 | **`products.is_featured`** (boolean, default false), editado en `0001` con su test. Los destacados se marcan a mano en Studio; un destacado agotado no se muestra | Regla explícita en vez de "los más nuevos", que es implícita y tarde o temprano se quiere controlar |
| 27 | **CI con Supabase local + `supabase/seed.sql`** (`npm run db:start:lite`: solo db, auth y API) en vez de secrets de la nube | La build prerenderiza el catálogo y necesita datos. Con un seed fijo los tests no dependen de datos reales que cambian. Reemplaza la nota "secrets en el CI" de la Fase 2 |
| 28 | **Fotos:** `image_path` es la ruta dentro del bucket; `productImageSrc()` arma la URL. `NEXT_PUBLIC_PRODUCT_IMAGES_BASE_URL=/product-images` en local y CI (placeholders en `public/product-images/`); vacía en producción usa Storage. `next.config.ts` habilita el host de Storage para `next/image` | La base guarda lo mismo en todos los entornos; solo cambia una variable |
| 29 | **Caché:** `cacheComponents: true`. `getCatalog()` hace **una** consulta anidada (`products` + `product_variants`) con `'use cache'`, `cacheTag('catalog')` y `cacheLife('minutes')`, con un cliente anónimo **sin cookies**. `/catalogo` y `/producto` filtran sobre ese resultado | Una función cacheada no puede leer cookies. `cacheLife('minutes')` porque las ediciones en Studio no pueden invalidar el tag. Con pocos perfumes, una entrada de caché es más simple que una por filtro |
| 30 | **`/producto/[slug]` sin `generateStaticParams`**. El detalle se lee dentro de `<Suspense>`; un slug inexistente o inactivo muestra `not-found` con **status 200 + `noindex`** (el stream ya empezó) | Con Cache Components, `generateStaticParams` tiene que devolver al menos un slug: un catálogo vacío (ej. el primer deploy) rompería la build |
| 31 | **Filtros en la URL** (`?q=&marca=&genero=&tipo=`) con un form GET. Búsqueda sin tildes ni mayúsculas, palabra por palabra. Género **exacto** (Masculino no trae Unisex) | Funciona sin JavaScript, se puede compartir el link y es predecible |
| 32 | **Route group `(store)`** con header y footer propios; el admin tendrá otro layout. `wordmark` escala con `clamp()` (28 → 40 px) como `display-xl` | El header no entraba en mobile con 40 px |
| 33 | **El detalle no tiene botón de carrito** hasta la Fase 3. Un producto agotado enlaza a `/encargos?producto=<slug>`: **la Fase 4 tiene que leer ese parámetro** | No se muestra un botón que no hace nada |

---

## 4. Arquitectura

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| UI | Next.js (App Router) + TypeScript + Tailwind v4 | Tienda (Noir) y admin de pedidos (Platinum) |
| Servidor | Server Actions | Turnstile, zod, normalizar WhatsApp, hash de IP, llamar RPC, invalidar caché |
| Datos | Supabase PostgreSQL | Tablas, enums, triggers, RLS, `create_order` |
| Auth | Supabase Auth | Solo el admin |
| Imágenes | Supabase Storage (`product-images`) + `next/image` | Lectura pública, escritura solo admin |
| Anti-bots | Cloudflare Turnstile | Checkout y encargos |
| Hosting | **Netlify** (Free) | Uso comercial permitido |
| Operación | GitHub Actions | Keepalive diario de Supabase + backup (`pg_dump`) |

**Regla de dependencias:** el catálogo se lee directo (público, RLS lo permite). Todo lo que escribe pasa por Server Action → función de la DB. Ninguna acción del admin usa `service_role`: usa la sesión del usuario, y RLS decide.

### Rutas del MVP

| Ruta | Función |
|---|---|
| `/` | Home: hero (FALBER en Cinzel), destacados, decants, perfumes, CTA de encargos |
| `/catalogo` | Catálogo con búsqueda y filtros (marca, género, tipo) |
| `/producto/[slug]` | Detalle y variantes; "Solicitar disponibilidad" si está agotado |
| `/carrito` | En `localStorage`: solo `variant_id` + cantidad, nunca precios |
| `/checkout` | Datos, entrega, pago, aclaración, Turnstile |
| `/pedido/[id]` | "Detalle de tu compra" + "Completar pedido en WhatsApp" (`id` = UUID) |
| `/encargos` | "¿No encontrás tu perfume?" |
| `/admin/login` | Login (Supabase Auth) |
| `/admin/pedidos` | Lista (pendientes primero, alerta de más de 48 h), detalle, cambio de estado, costo de envío |

Productos, stock y encargos: **Supabase Studio** en el MVP (las protecciones de la DB valen también ahí). Su interfaz propia está en `TODOS.md`.

---

## 5. Modelo de datos

```
PRODUCTS ──1:N──► PRODUCT_VARIANTS ──1:N──► STOCK_MOVEMENTS (historial, solo se agrega)
                       ▲        ▲                     │ reference_id
                       │        └──── (opcional) PERFUME_REQUESTS
                       │                              │ N:1
                  ORDER_ITEMS (inmutables)            ▼
                       │ N:1                      CUSTOMERS
                       ▼                              ▲
                    ORDERS (no se borran) ── N:1 ─────┘

AUTH.USERS ──1:1──► PROFILES (role = admin)
RATE_LIMIT_EVENTS (anti-abuso, sin acceso desde la web)
```

### Tablas

| Tabla | Qué guarda | Claves |
|---|---|---|
| `products` | El perfume | `slug` único, `gender` y `status` enums |
| `product_variants` | Lo que se vende | `label` generado, `price`, `stock` (solo vía historial), `is_available` |
| `customers` | Compradores invitados | `whatsapp` único (E.164); no se pisan sus datos |
| `orders` | El pedido | `request_id` único (idempotencia), snapshot `customer_name`/`customer_email`, `total` generado |
| `order_items` | Lo comprado, congelado | Snapshot de nombre, etiqueta y precio; `line_total` generado |
| `stock_movements` | Historial del stock | Tipo y signo coherentes, `reference_id` al pedido, `created_by` |
| `perfume_requests` | Encargos | `variant_id` opcional (agotado) o perfume libre; snapshot del nombre |
| `profiles` | Administradores | Vinculado a Supabase Auth |
| `rate_limit_events` | Intentos por IP (hasheada) | Se purga a diario |

### Estados del pedido

```
pending ─► confirmed ─► paid ──────► preparing ─┬─► ready_for_pickup ─► completed   (retiro)
               │                        ▲       └─► shipped ─────────► completed   (envío)
               └──── (efectivo) ────────┘
cancelled: desde cualquier estado salvo shipped / completed. Devuelve el stock. No se reabre.
pending de más de 48 h: se cancela solo (pg_cron, cada hora).
```

### Historial del stock

| Tipo | Signo | Quién lo crea |
|---|---|---|
| `initial_stock` | + | Admin / Studio |
| `restock` | + | Admin / Studio |
| `adjustment` | ± | Admin / Studio (corrección tras un conteo) |
| `damaged` | − | Admin / Studio |
| `sale` | − | Solo `create_order` |
| `order_cancelled` | + | Solo el trigger de cancelación |

**Cargar stock desde Studio:** nunca se edita la columna `stock` (el trigger lo rechaza). Se inserta un movimiento:

```sql
insert into public.stock_movements (variant_id, movement_type, quantity, note)
values ('<variant_id>', 'initial_stock', 10, 'Carga inicial');
```

---

## 6. Flujo de compra con WhatsApp

1. El cliente arma el carrito.
2. En `/checkout`: nombre, WhatsApp, retiro o envío, transferencia o efectivo, dirección si corresponde, aclaración (máx. 100). Turnstile invisible.
3. "Realizar compra" → el botón se deshabilita → Server Action → `create_order`.
4. `/pedido/[uuid]` muestra:

```
DETALLE DE TU COMPRA                          FAL-0042
Estado del pago: Pendiente

1 × Sauvage EDT — Decant 5 ml               $10.000,00

Total estimado                              $10.000,00
(el envío, si corresponde, se coordina por WhatsApp)

[ COMPLETAR PEDIDO EN WHATSAPP ]
```

5. El botón abre WhatsApp con el mensaje armado. Respeta la voz de la marca: sin emojis ni exclamaciones.

```
Hola FALBER. Quiero confirmar mi pedido FAL-0042.

• 1x Sauvage EDT — Decant 5 ml ($10.000)

Total estimado: $10.000
Entrega: Retiro en La Plata
Pago: Transferencia
```

6. Confirmás por chat y actualizás el estado en `/admin/pedidos`.

### Errores: de la DB al usuario

```ts
// src/lib/order-errors.ts
export const ORDER_ERRORS: Record<string, string> = {
  INSUFFICIENT_STOCK: 'No queda stock suficiente de uno de los productos. Revisá tu carrito.',
  VARIANT_UNAVAILABLE: 'Uno de los productos ya no está disponible.',
  CASH_REQUIRES_PICKUP: 'El pago en efectivo es solo para retiro en La Plata.',
  ADDRESS_REQUIRED: 'Para envío a domicilio necesitamos dirección y ciudad.',
  TOO_MANY_PENDING_ORDERS: 'Ya tenés pedidos pendientes. Escribinos por WhatsApp.',
  RATE_LIMITED: 'Demasiados intentos. Probá de nuevo en un rato.',
  // ... un mensaje por cada código de create_order
};
// Desconocido (o una violación de constraint 23514): mensaje genérico + console.error con el error crudo.
```

### WhatsApp: código y primer test

```ts
// src/lib/whatsapp.ts
export function buildWhatsAppMessage(order: OrderSummary): string {
  const items = order.items.map(
    (i) => `• ${i.quantity}x ${i.productName} — ${i.variantLabel} (${formatARS(i.lineTotal)})`
  );
  return [
    `Hola FALBER. Quiero confirmar mi pedido ${order.orderNumber}.`,
    '',
    ...items,
    '',
    `Total estimado: ${formatARS(order.total)}`,
    `Entrega: ${order.deliveryMethod === 'pickup' ? 'Retiro en La Plata' : 'Envío a domicilio'}`,
    `Pago: ${order.paymentMethod === 'transfer' ? 'Transferencia' : 'Efectivo'}`,
  ].join('\n');
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}
```

> **Trampa con números argentinos:** en `wa.me` el número va con 54 + 9 y **sin** el 0 ni el 15: `0221 15 555-1234` → `5492215551234`.

---

## 7. Seguridad

| Quién | Qué puede hacer |
|---|---|
| Visitante | Leer productos y variantes activos. Nada más. |
| Usuario logueado no admin | Lo mismo que un visitante |
| Admin (app) | Leer todo; cambiar estado y costo de envío de pedidos; cargar movimientos manuales de stock; editar productos y precios |
| Admin no puede | Borrar pedidos, editar ítems o subtotales, editar `stock` directo, cargar `sale`/`order_cancelled`, borrar historial |
| Servidor (`service_role`) | Ejecutar `create_order`, `create_perfume_request`, `get_order_summary` |
| Studio (rol postgres) | Casi todo, **pero** los triggers igual bloquean: editar stock directo, borrar pedidos, editar ítems, editar/borrar historial, saltear estados |

Al implementar:

1. `SUPABASE_SERVICE_ROLE_KEY` solo en el servidor, **nunca** con `NEXT_PUBLIC_`.
2. **`requireAdmin()` en la primera línea de cada Server Action del admin.** El middleware (en Next 16, `proxy.ts`) solo redirige; no es una frontera de seguridad (antecedente: CVE-2025-29927).
3. Las acciones del admin usan el cliente con la **sesión del usuario**, nunca `service_role`: así RLS sigue protegiendo.
4. Turnstile verificado en el servidor antes de llamar a la RPC.
5. Hash de la IP (`sha256(ip + secreto)`) como `p_client_key`: nunca se guarda la IP en crudo.
6. Aviso de uso de datos personales (Ley 25.326) en el checkout.

---

## 8. Plan de desarrollo con skills

Una **sesión nueva por fase**, una **rama por fase** (`git switch -c feat/...`) y un **commit por cambio lógico**. Al arrancar cada sesión: *"Leé docs/FALBER_documento_maestro.md y DESIGN.md"*.

### Fase 0 — Preparación (sin Claude)

- Fotos reales de productos (fondo oscuro o neutro), catálogo inicial, número de WhatsApp.
- Cuentas: Supabase, Netlify y Cloudflare (Turnstile). Docker instalado (para `supabase start`).

### Fase 1 — Base + Supabase + design system (hecha: PR #1, 2026-10-05)

```text
Leé docs/FALBER_documento_maestro.md, DESIGN.md y CLAUDE.md. Arrancamos la Fase 1
en la rama feat/base. Creá el proyecto Next.js + TypeScript + Tailwind v4. Pasá
design/falber-tokens.json a variables CSS por tema (Noir/Platinum) + @theme de
Tailwind, cargá Cinzel y Montserrat con next/font y reimplementá Button, Input y
Card en src/components/ui. Configurá Supabase (supabase CLI como devDependency,
supabase init, clientes browser/server), aplicá las migraciones contra
`supabase start`, corré supabase/tests/schema.test.cjs y generá los tipos con
`supabase gen types`. Configurá Vitest y Playwright. Para Turnstile usá las claves
de prueba de Cloudflare. Commits atómicos por cada paso.
```

Después, en la misma sesión: CI de GitHub Actions para los PR, `.gitattributes` (LF), `/review` y merge con merge commit. Las decisiones que salieron están en la sección 3.F.

**Lecciones para las próximas fases:**
- Liberá espacio antes de `supabase start`: las imágenes de Docker pesan ~6 GB, y con el disco lleno el primer arranque deja todo a medias.
- Si `next dev` ya corre, `npm ci` falla con `EPERM` en Windows: frená el dev server antes de reinstalar dependencias.
- "En mi máquina anda" no alcanza: el CI encontró dos cosas que en local pasaban (tipos de Next sin generar y un lockfile incompleto para Linux).

### Fase 2 — Tienda (catálogo y producto) (implementada en `feat/catalog`, 2026-10-05)

```text
Usá taste-skill siguiendo DESIGN.md (tema Noir, esquinas rectas, Cinzel solo
ceremonial). Construí /, /catalogo y /producto/[slug] con una sola consulta
anidada (products + product_variants), caché con tag 'catalog' y next/image.
Diales: DESIGN_VARIANCE 6, MOTION_INTENSITY 3, VISUAL_DENSITY 3.
Antes de codear, decime qué dirección de diseño inferís.
```

**Por qué esos diales:** la marca pide sobriedad. Motion bajo (3) porque el lujo está en la quietud y el espacio, no en la animación.

**Dirección de diseño inferida:** tienda de perfumería de lujo sobrio para quien llega desde Instagram con el celular; lenguaje editorial oscuro sobre el design system propio. Cuando taste-skill choca con DESIGN.md, gana DESIGN.md (Cinzel solo en el hero, siempre Noir, acento = platino). Cada sección de la home tiene un layout distinto: hero partido, destacados (uno grande + dos), decants en fila con scroll-snap, frascos en grilla con desfase, franja de encargos.

Los pendientes de la Fase 1 se resolvieron con las decisiones 27 (CI) y 28 (fotos).

**Lecciones:**
- En Windows, `next dev` **no detecta carpetas nuevas** para Tailwind: las clases de una ruta nueva no aparecen hasta reiniciar el dev server. Si un breakpoint "no anda" en una página recién creada, reiniciar antes de debuggear.
- `npm run db:start` (stack completo) falla el health check por el bug de Storage local. Usar `npm run db:start:lite`.
- Next 16 conserva la ruta anterior **oculta en el DOM** para volver atrás al instante: en Playwright, acotar las búsquedas a la página actual (ej. `page.getByRole("article")`).
- `error.tsx` en Next 16 usa `retry()` (vuelve a pedir los datos), no `reset()`.

### Fase 3 — Carrito, checkout, pedidos y WhatsApp

```text
Usá superpowers:test-driven-development. Implementá: carrito (localStorage, solo
variant_id + cantidad), normalización de WhatsApp argentino, checkout con zod +
Turnstile + request_id (UUID al cargar) + botón deshabilitado al enviar, Server
Action que llama create_order con service_role y hash de IP, mapa ORDER_ERRORS,
revalidateTag('catalog'), /pedido/[id] con get_order_summary y el botón de
WhatsApp. Test E2E de Playwright: compra completa.
```

**Antes de empezar:** en Next 16, una Server Action que cambia el stock y después muestra datos frescos debería usar `updateTag('catalog')` (lectura inmediata de lo que acaba de escribir) en vez de `revalidateTag`, que sirve datos viejos mientras revalida. Confirmarlo en `node_modules/next/dist/docs/` antes de implementar. El carrito se agrega en `/producto/[slug]` (decisión 33).

DESIGN.md no define un color semántico de error. Hoy `Input` marca el error con borde `accent-strong` y el texto del mensaje (sin depender solo del color). Definirlo en el design system antes del checkout.

### Fase 4 — Encargos

```text
Implementá /encargos y "Solicitar disponibilidad" en productos agotados con
create_perfume_request (Turnstile + hash de IP). Seguí DESIGN.md.
```

**Antes de empezar:** el botón "Solicitar disponibilidad" ya enlaza a `/encargos?producto=<slug>` (decisión 33). El form tiene que leer ese parámetro y precargar el perfume.

### Fase 5 — Admin de pedidos

```text
Construí /admin/login y /admin/pedidos con tema Platinum según DESIGN.md:
lista (pendientes primero, alerta de más de 48 h), detalle, cambio de estado
(solo transiciones válidas) y costo de envío. requireAdmin() en cada acción,
sesión del usuario (nunca service_role), revalidateTag('catalog') al cancelar.
Test E2E: /admin sin sesión redirige y un no-admin no ve pedidos.
```

**Antes de empezar (pendientes de la Fase 1):**
- Hoy el layout raíz fija `<html data-theme="dark">`. Para Platinum en `/admin`, el layout de admin pone `data-theme="light"` en un contenedor con `bg-surface` (los tokens funcionan en cualquier elemento) o se usan route groups con layouts raíz separados.
- Falta `src/proxy.ts` (el middleware de Next 16) para refrescar la sesión en cada navegación. Solo redirige: la seguridad sigue en `requireAdmin()` + RLS.

### Fase 6 — Operación y lanzamiento

```text
GitHub Action diaria: ping a Supabase (evita la pausa del plan gratuito) +
pg_dump como artefacto. Deploy en Netlify. Después:
/design-review → /qa → /cso → /review.
```

### Flujo completo

```
Fase 1 base + DS ─► Fase 2 tienda (taste-skill) ─► Fase 3 checkout (TDD) ─► Fase 4 encargos
       ─► Fase 5 admin pedidos ─► Fase 6 operación + /design-review /qa /cso /review ─► lanzamiento
```

---

## 9. Plan de tests

| Capa | Herramienta | Qué cubre |
|---|---|---|
| Base de datos | `schema.test.cjs` (PGlite) | Todas las reglas de la sección 7, el flujo de `create_order` y los tres caminos de Storage (decisión 22) |
| Lógica pura | Vitest | Ya existen: tokens vs `falber-tokens.json`, contrato de `Button`/`Input`/`Select`, `required()` de env, reglas del catálogo (filtros, precio "desde", agotados, destacados), mapeo de filas, URL de fotos y `formatARS`. Por venir: `whatsapp.ts` (mensaje y URL), `phone.ts` (formatos reales + inválidos), `cart.ts` (agregar, quitar, cantidad máx.), `order-errors.ts` (cada código + desconocido), schema zod del checkout |
| Flujos | Playwright | Ya existen: smoke de la home (tema Noir, `es-AR`, sin desborde en mobile) y catálogo (home → destacado → detalle, filtros por URL, búsqueda sin tildes, estado vacío, agotado, inexistente/inactivo). Por venir: compra completa (carrito → pedido → link de WhatsApp correcto); `/admin` sin sesión → login; no-admin no ve pedidos |

Las tres capas corren en el CI en cada PR (decisión 24): `npm run test:db`, `npm test` y `npm run test:e2e`.

Casos de borde que hay que cubrir sí o sí: doble click en "Realizar compra", carrito con un producto que ya no existe o está inactivo, sin stock al confirmar, efectivo + envío.

---

## 10. Fuera del MVP

| Funcionalidad | Señal para agregarla |
|---|---|
| Admin de productos, stock y encargos | Cargar productos en Studio te lleva más de 10 min por semana (TODOS.md) |
| Stock calculado desde Decant Manager | Sobreventa o más de ~30 perfumes (TODOS.md) |
| Logo vectorial | Cuando lo tenga diseño (TODOS.md) |
| Mercado Pago | Muchos pedidos se caen en la transferencia |
| Cuentas, favoritos, reviews, cupones | Clientes recurrentes que lo pidan |
| WhatsApp Business API | Volumen que no podés atender a mano |
| Varios admins | Sumás a alguien al negocio |

---

## 11. Checklist antes de publicar

- [ ] Todos los tests pasan: esquema, Vitest y Playwright.
- [ ] Migraciones probadas una vez contra `supabase start`.
- [ ] La `service_role key` no aparece en el cliente ni con `NEXT_PUBLIC_`.
- [ ] Cada acción del admin empieza con `requireAdmin()`.
- [ ] Turnstile activo en checkout y encargos, con claves reales (no las de prueba de `.env.example`).
- [ ] Supabase → Authentication → Sign In / Providers: registro público desactivado (solo existe el admin).
- [ ] Pedido de prueba completo en el celular: WhatsApp abre con el mensaje correcto.
- [ ] Doble click en "Realizar compra" crea un solo pedido.
- [ ] Cancelar un pedido devuelve el stock y la tienda lo muestra.
- [ ] pg_cron activo (`select * from cron.job`).
- [ ] Bucket `product-images` y sus 3 policies creados (`select * from storage.buckets`; `select policyname from pg_policies where schemaname = 'storage'`). Si las tablas de Storage no existieran al migrar, `0001` falla con `STORAGE_TABLES_MISSING` (solo en local, con el rol `falber_local_dev` de `supabase/roles.sql`, se omite con un NOTICE).
- [ ] GitHub Action de keepalive + backup corriendo.
- [ ] Deploy en Netlify (no Vercel Hobby: prohíbe uso comercial).
- [ ] Prueba en iPhone y Android; aviso de datos personales en el checkout.

---

## Anexo — Correr los tests del esquema

```bash
npm run test:db
```

**Huecos en la numeración:** un pedido rechazado consume un número de la secuencia. Que exista `FAL-0003` y después `FAL-0005` es normal.

---

## NOT in scope (revisión de ingeniería)

- **Admin de productos, stock y encargos:** se opera en Studio; las protecciones de la DB valen ahí (decisión 10).
- **Sincronización con Decant Manager:** solo con más de ~30 perfumes o ante una sobreventa (decisión A).
- **Pasarela de pago, cuentas de cliente, cupones:** el cierre es por WhatsApp.
- **Logo vectorial:** trabajo de diseño, no de código.

## What already exists

- **Design system FALBER** (artifact): tokens, 3 componentes y logos. Se reutiliza; reemplaza la fase de `stitch-skill` del plan anterior.
- **Migraciones 0001/0002 y sus tests:** la base de datos completa, probada.
- **Decant Manager:** la fuente futura del stock en ml; no se duplica.

## Failure modes

| Camino | Falla realista | Test | Manejo | Visible |
|---|---|---|---|---|
| `create_order` | Sin stock al confirmar | Sí (esquema) | `INSUFFICIENT_STOCK` | Mensaje claro |
| Checkout | Doble click / reintento de red | Sí (esquema) + E2E | `request_id` | Mismo pedido |
| Checkout | Ataque con números inventados | Sí (esquema) | Turnstile + límite IP | `RATE_LIMITED` |
| Catálogo | Stock viejo en caché | E2E (fase 3) | `revalidateTag` | — |
| Admin | Acción sin sesión | E2E (fase 5) | `requireAdmin()` + RLS | Redirige a login |
| Supabase Free | Pausa tras 7 días sin uso | Manual | Keepalive diario | **Silencioso sin el keepalive** |
| `/pedido/[id]` | ID adivinado | Sí (esquema) | UUID + resumen sin datos sensibles | — |

## Parallelization

Lane A: Fase 1 → Fase 2 → Fase 3 (comparten `src/components`, `src/lib`). Lane B: GitHub Action de keepalive (independiente, `.github/`). Lane C: Fase 5 admin, **después** de la Fase 3 (comparte el cliente de Supabase y los tipos). Arrancar A y B en paralelo; C cuando termine la Fase 3.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 15 issues, 0 critical gaps (todas resueltas) |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **CROSS-MODEL:** la segunda opinión (subagente de Claude) encontró 11 puntos; 9 se incorporaron (decisiones 11, 12, 13, 15), 1 tensión de alcance se resolvió con un punto intermedio (decisión 10) y el resto ya estaba cubierto.
- **VERDICT:** ENG CLEARED — listo para implementar.

NO UNRESOLVED DECISIONS
