# FALBER — Documento maestro

Tienda online de decants y perfumes · Next.js + Supabase · v6.3 · 2026-10-10

**v2.0:** incorpora el design system FALBER y las 15 decisiones de la revisión de ingeniería (`/plan-eng-review`). El reporte está al final del documento.
**v2.1:** Fase 1 terminada (PR #1). Prompt real de la Fase 1 y las decisiones 16 a 25, tomadas al implementarla (sección 3.F).
**v2.2:** Fase 2 implementada en `feat/catalog`. Decisiones 26 a 33 (sección 3.G) y lecciones nuevas.
**v3.0:** Fase 3 implementada en `feat/checkout` (PR #5): carrito, checkout, pedidos y WhatsApp. Decisiones 34 a 43 (sección 3.H), diagrama de la Server Action actualizado, lecciones, plan de tests y checklist de publicación.
**v4.0:** Fase 4 implementada en `feat/requests`: `/encargos` con precarga desde un producto agotado. Decisiones 44 a 54 (sección 3.I), entre ellas el fix del checkout que perdía "Envío a domicilio" tras un error del servidor y las que salieron del `/review`; lecciones y plan de tests.
**v5.0:** Fase 5 implementada en `feat/admin-orders`: login del admin, lista y detalle de pedidos, cambio de estado y costo de envío, tema Platinum y `src/proxy.ts`. Decisiones 55 a 70 (sección 3.J), entre ellas la regla del costo de envío en la base, el fix de `config.toml` que apagaba el login con email y, del `/review`, el compare-and-set del estado y la lista con todos los activos; lecciones, plan de tests y checklist.
**v6.0:** Fase 6, parte A (código antes del lanzamiento) en `feat/launch-hardening`: sesión del admin endurecida (cookies `httpOnly`, fallos de Auth, `requireAdminAction`, `(select is_admin())`), CAPTCHA nativo de Supabase en el login, GitHub Action de keepalive y backup cifrado, largos de envío en la base, logs sin datos personales y foco al primer error. Decisiones 71 a 80 (sección 3.K), backups, lecciones, plan de tests y checklist.
**v6.1:** envíos estimados en el checkout (`feat/shipping-estimates`): el checkout muestra el envío estimado a sucursal y a domicilio, que el admin edita en `/admin/envios`. Decisiones 81 a 86 (sección 3.L).
**v6.2:** Fase 6, parte B (`feat/launch-deploy`, PR #10): la tienda en producción en `https://falber.com.ar` (Supabase, Netlify, dominio, backup). Token de Turnstile atado a la acción y al dominio, con `SITE_HOSTNAMES` validada en el build de producción (decisión 87), headers contra el embebido (decisión 88), arreglos de `/design-review` (áreas táctiles de 44 px, Destacados con dos productos) y resultados de `/qa`, `/cso` y `/review` (sección 3.M); lecciones y checklist.
**v6.3:** cierre de la Fase 6, parte B (`docs/phase-6-part-b-closure`): deploy de producción y compra real `FAL-0003` verificados en `falber.com.ar`, y el catálogo vacío deja de hablar de filtros cuando se llega desde el menú (`emptyCatalogMessage()`).

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
Navegador ──► Server Action (src/app/(store)/checkout/actions.ts)
               1. valida con zod y normaliza WhatsApp (sin red; decisión 35)
               2. verifica Turnstile con la IP real (captcha invisible)
               3. HMAC de la IP + supabase.rpc('create_order', { p_request_id, p_client_key, ... })  ← service_role
                      │
                      ▼
               create_order (DB, una transacción)
               idempotencia → validación → límite IP → cliente → límite pendientes
               → pedido → ítems (FOR UPDATE, precio y stock reales) → reserva de stock
                      │
               4. updateTag('catalog')  (el stock cambió; decisión 34)
               5. devuelve { orderId } → el navegador vacía el carrito y va a /pedido/<uuid> (decisión 36)
```

### E. Las 15 decisiones de la revisión de ingeniería

| # | Decisión |
|---|---|
| 1 | Design system: tokens → CSS + Tailwind; Button/Input/Card reimplementados (el bundle pide React 18) |
| 2 | Noir en la tienda, Platinum en `/admin` |
| 3 | Catálogo cacheado; se invalida (`updateTag('catalog')`, decisión 34) al editar en el admin **y** al crear o cancelar pedidos |
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
| 20 | **Variables de entorno:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (clave publishable nueva, no la anon), `SUPABASE_SERVICE_ROLE_KEY` (acepta la secret `sb_secret_...`), `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `IP_HASH_SECRET`, `SITE_HOSTNAMES` (decisión 87). Plantilla en `.env.example` con las claves de prueba de Turnstile (`1x00000000000000000000BB`: invisible, siempre pasa) | Un solo lugar documenta qué necesita cada entorno |
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

### H. Decisiones de la Fase 3 (checkout, 2026-10-05)

| # | Decisión | Por qué |
|---|---|---|
| 34 | **`updateTag('catalog')` en las Server Actions** que cambian stock o productos (crear pedido, cancelar, editar en el admin). `revalidateTag(tag, 'max')` solo fuera de una Server Action (Route Handler, webhook). Reemplaza a `revalidateTag('catalog')` de la decisión 3 | `updateTag` vence el caché al instante y el próximo request espera los datos nuevos (leer lo que uno acaba de escribir). `revalidateTag` con `'max'` sirve stock viejo mientras revalida, y sin perfil está deprecado. Fuente: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md` y `revalidateTag.md` (Next 16.3) |
| 35 | **zod antes que Turnstile** en `createOrder` (cambia el orden del diagrama D) | El token de Turnstile sirve una sola vez: verificarlo primero lo gastaría en un error de tipeo. Validar no toca la red ni la base, así que la seguridad no cambia: Turnstile sigue corriendo antes de `create_order` |
| 36 | **La acción devuelve `{ orderId }`; el navegador vacía el carrito y navega** con `router.replace('/pedido/<id>')`. No se usa `redirect()` | Con `redirect()` el navegador no se entera de que la compra salió bien y no puede vaciar el carrito. Vaciarlo al entrar a `/pedido` borraría un carrito nuevo si el cliente reabre el link. El checkout ya necesita JavaScript (carrito y Turnstile) |
| 37 | **IP del cliente:** `x-nf-client-connection-ip` (Netlify) y, solo si falta, el primer valor de `x-forwarded-for` (local y CI); sin ninguno, `"unknown"`. **`p_client_key` = HMAC-SHA256(ip, `IP_HASH_SECRET`)**, secreto de 32 caracteres o más | `x-forwarded-for` lo puede inventar el cliente para saltear el límite por IP; el header de Netlify lo pone el proxy. HMAC es la construcción estándar de un hash con clave: sin secreto largo, el hash de una IPv4 se revierte probando las ~4.300 millones posibles |
| 38 | **Turnstile:** render explícito, `"response-field": false` y el token en estado de React (input oculto propio). Se resetea después de **cualquier** error del servidor. La verificación del servidor **falla cerrado** (timeout de 5 s, HTTP o JSON raro = rechazado) | El form se monta después de leer el carrito, cuando el render implícito ya pasó. Con el token en estado, el form se testea sin el script de Cloudflare. Un pedido rechazado se reintenta; uno falso reserva stock 48 h |
| 39 | **Los precios salen siempre del servidor:** `/carrito` y `/checkout` cruzan el carrito con el índice de variantes del catálogo cacheado (`resolveCart`). Una variante sin stock o inexistente bloquea "Finalizar compra" | El carrito de `localStorage` lo puede editar cualquiera; además los precios cambian. El total es "estimado": el real lo fija `create_order` |
| 40 | **Reglas cruzadas del checkout fuera de zod** (`crossFieldErrors`: efectivo solo con retiro, dirección y ciudad con envío). Los largos de dirección (120), ciudad (60), código postal (10) y referencia (120) existen **solo en zod** | zod 4 no corre un refine del objeto si otro campo ya falló: el cliente vería los errores de a uno. La base no limita esos largos (pendiente en TODOS.md) |
| 41 | **En mobile el carrito del header es un ícono** de bolsa con la cantidad; desde `md`, la palabra "Carrito". El nombre accesible es siempre "Carrito, N unidades" | Con la palabra, el header necesitaba 396 px y en 375 px hay 343. "Catálogo" queda siempre visible: es la entrada principal desde Instagram |
| 42 | **`/pedido/[id]` sin caché**, dentro de `<Suspense>`. Un id que no es UUID es "no encontrado" sin consultar; un error de la base o una respuesta con forma inesperada lanza (`error.tsx`). El botón de WhatsApp lleva `rel="noopener noreferrer"` | El resumen es de una sola persona y cambia cuando el admin confirma. Postgres responde 400 a un id que no es UUID. Sin `noreferrer`, WhatsApp recibiría la URL privada del pedido |
| 43 | **Los E2E de compra escriben en la base (y los de encargos, Fase 4):** cada test manda su propia IP (`x-forwarded-for`) y su propio WhatsApp, y compran el decant de 5 ml de Sauvage (24 en el seed). En CI: clave secreta de Supabase, claves de prueba de Turnstile e `IP_HASH_SECRET` nuevo por corrida | Sin eso, la segunda corrida choca con el límite de 5 pedidos por hora por IP o de 3 pendientes por cliente. Si el stock se agota en local: `npm run db:reset` |

### I. Decisiones de la Fase 4 (encargos, 2026-10-06)

| # | Decisión | Por qué |
|---|---|---|
| 44 | **`brand` y `presentation` de `perfume_requests`: hasta 60 caracteres en la base.** `create_perfume_request` levanta `INVALID_BRAND` / `INVALID_PRESENTATION` (mensaje amigable) y la tabla tiene `check` (Studio) | Las reglas viven en la base. Eran `text` sin límite: quien llamara a la RPC sin el formulario podía guardar un texto de cualquier largo |
| 45 | **`/encargos?producto=<slug>`:** perfume y marca precargados **de solo lectura**, y la presentación se elige entre las variantes **sin stock** de ese producto (su id va como `p_variant_id`, su etiqueta como `presentation`). Sin variantes agotadas, la presentación se escribe a mano. Un slug inexistente o inactivo es un encargo libre. "Encargar otro perfume" vuelve a `/encargos` | Si perfume y marca se pudieran editar, el encargo podría decir otro perfume y apuntar a la variante del primero. El ranking del admin necesita saber qué presentación reponer |
| 46 | **Piezas compartidas entre checkout y encargos:** `mapDbError` (`src/lib/db-errors.ts`), `verifyHumanRequest` (Turnstile + HMAC de la IP, `src/lib/security/verify-request.ts`), `TurnstileField` (token + input oculto), `src/lib/forms/` (`formValues`, `TURNSTILE_FIELD`, campos de zod de nombre, WhatsApp y texto opcional), `FormSection` y `e2e/helpers.ts` | Cada una se extrajo en un commit de refactor con los tests de la Fase 3 como red, antes de usarla en encargos |
| 47 | **Sin `updateTag` en encargos.** La acción devuelve `{ perfumeName }` y la confirmación ("Encargo recibido… te escribimos por WhatsApp") reemplaza al formulario en la misma página, sin ruta propia | Un encargo no cambia stock ni productos. El cliente no necesita volver a ver el encargo: el próximo paso es el WhatsApp de FALBER |
| 48 | **`key` = cantidad de errores del servidor en `<select>` y grupos de radios de los formularios con Server Action**, y su valor por defecto es la elección actual (estado). Arregla un bug del checkout de la Fase 3: tras un error del servidor, "Envío a domicilio" volvía a "Retiro" en el DOM (con la dirección visible) y el reintento salía como retiro | Después de la acción React 19 resetea el `<form>`, y cada select/radio vuelve a `defaultSelected`/`defaultChecked`, que React marca **solo al montar** (a un `<input>` de texto sí le actualiza el `defaultValue`). La primera versión usaba el valor enviado como `key`; el `/review` mostró que si el cliente cambia la opción mientras se envía y vuelve el mismo valor, no se remonta. El contador cambia en cada respuesta |
| 49 | **`Input` de solo lectura con estilo propio** (`surface-raised`, `border`, `text-secondary`), aplicado desde la prop `readOnly` y no con la variante `read-only:`, y **`Select` con `error`** como `Input` | Un dato precargado se veía igual que un campo vacío y no respondía al tocarlo. `:read-only` también matchea un input deshabilitado. Pendiente copiarlos al artifact (TODOS.md → Design system) |
| 50 | **Con `variant_id`, `create_perfume_request` toma perfume, marca y presentación del catálogo** (join con `products`/`product_variants`) e ignora los del cliente; los copia con `trim`, igual que mide el check. `products` tiene los mismos topes que un encargo (nombre 2 a 120, marca hasta 60) | Los campos de solo lectura se pueden cambiar con un POST armado a mano: el encargo podía contradecir a su variante. Con los mismos topes, un producto precargado siempre pasa la validación del encargo |
| 51 | **`/encargos` se resetea cuando Next esconde la página** (`<Activity>` de Cache Components): la limpieza de un `useLayoutEffect` despacha un `RESET` al `useActionState`, solo después de un encargo enviado (un borrador se conserva). Patrón de `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md` | Next 16 no desmonta la ruta al salir: volver por un link mostraba la confirmación vieja y no dejaba hacer otro encargo. El checkout no lo necesita: navega con `router.replace` y un E2E de dos compras seguidas lo cubre |
| 52 | **`enforce_rate_limit` toma `pg_advisory_xact_lock(hashtext(acción:clave))`** antes de contar | Contar y después insertar sin lock deja pasar N requests simultáneas de la misma IP. El lock serializa solo las de la misma acción y clave |
| 53 | **`LIMITS` (`src/lib/forms/limits.ts`): un solo lugar para los largos** que usan los schemas (`.max`) y los inputs (`maxLength`), sin zod | Cada límite estaba escrito dos veces y podía desfasarse en silencio. Sin zod para no cargar los schemas en el bundle del navegador |
| 54 | **`Turnstile` resetea el widget solo cuando cambia `resetKey`** (guarda el último aplicado en un ref) | Un widget recién montado, o vuelto a mostrar por `<Activity>`, ya trae un token nuevo: resetearlo al montar pedía un challenge de más |

### J. Decisiones de la Fase 5 (admin de pedidos, 2026-10-06)

| # | Decisión | Por qué |
|---|---|---|
| 55 | **La "alerta de más de 48 h" avisa antes de la cancelación automática:** un pendiente de 24 h o más muestra "Se cancela sola en X h" (horas enteras, redondeando para abajo; 0 = "menos de 1 h"). Umbrales en `src/lib/admin/order-list.ts` | pg_cron cancela los pendientes de más de 48 h cada hora: una alerta a las 48 h se vería como mucho una hora. Avisar antes le da tiempo al admin de confirmar la venta. Mostrar menos tiempo del real empuja a actuar |
| 56 | **`guard_shipping_cost` en la base:** el costo de envío se rechaza en retiros (`SHIPPING_COST_PICKUP`) y en pedidos `shipped`, `completed` o `cancelled` (`SHIPPING_COST_LOCKED`). Mira el estado **viejo**: cargar el costo y despachar en el mismo update vale | Las reglas viven en la base. El permiso de columna (`update (status, shipping_cost)`) dejaba cargar costo en cualquier pedido |
| 57 | **Las copias en TS de reglas de la base son solo para la UI** (`nextOrderStatuses`, `canSetShippingCost`). `nextOrderStatuses` e `is_valid_order_transition` se prueban contra el mismo fixture, `supabase/tests/order-transitions.json`: `test:db` verifica la base y Vitest la copia | Una regla duplicada sin un test compartido se desfasa en silencio. Si la base cambia, fallan los dos tests; si la copia se desfasa igual, la base rechaza y el admin ve el mensaje |
| 58 | **`src/proxy.ts` corre solo en `/admin/:path*`:** `getClaims()` refresca la sesión y sin sesión redirige al login. El login nunca redirige desde el proxy | La tienda no tiene sesión: correrlo ahí es una llamada a Auth por visita sin proteger nada. Es un chequeo optimista: la seguridad sigue en `requireAdmin()` + RLS |
| 59 | **`getAdminStatus()` lee de la sesión si es `anonymous`, `forbidden` o `admin`.** `requireAdmin()` manda los dos casos no-admin al login, y el login muestra el formulario, "sin acceso" con "Salir", o va al panel. Sin parámetros en la URL | Si el proxy mandara a los logueados al panel y `requireAdmin` a los no-admin al login, quedarían rebotando. La sesión es la única fuente de verdad |
| 60 | **`signIn` y `signOut` son las únicas acciones del admin sin `requireAdmin()`** (crean y cierran la sesión). Credenciales incorrectas dan un solo mensaje que no dice qué campo falló. Sin Turnstile en el login por ahora (TODOS.md → Anti-abuso; **reemplazado por la decisión 75**) | No se puede pedir sesión de admin para iniciarla. Un mensaje por campo deja averiguar qué emails existen. Supabase Auth ya limita los intentos (`over_request_rate_limit` tiene su mensaje) |
| 61 | **`[auth.email] enable_signup = true` en `supabase/config.toml`.** El registro público se cierra con `[auth] enable_signup = false` (decisión 21) | En el CLI, `[auth.email] enable_signup = false` apaga el proveedor de email entero, también el login (`email_provider_disabled`). Verificado: con el fix, un signup público sigue dando `signup_disabled` |
| 62 | **Platinum con un contenedor `data-theme="light"`** en `src/app/admin/layout.tsx` (no layouts raíz separados), `robots: noindex`, y un route group `(panel)` con la navegación y "Salir" para todo menos el login | Los tokens son variables CSS: valen en cualquier elemento. Dos layouts raíz recargan la página al cruzar entre tienda y admin y duplican las fuentes |
| 63 | **Usuarios de prueba con la Auth Admin API** (`scripts/local-users.ts`, solo contra `127.0.0.1`/`localhost`): los E2E crean un usuario con contraseña al azar por test; `npm run db:admin` crea o actualiza un admin local y muestra la contraseña en la terminal. No van en `seed.sql` | Insertar en `auth.users` depende de columnas internas de GoTrue (tokens en `null` rompen el login) que cambian con el CLI. Sin contraseñas guardadas en el repo |
| 64 | **Después de cada cambio del admin, `refresh()`; `updateTag('catalog')` solo al cancelar.** Los updates llevan `.select('id')` para detectar 0 filas | El panel no se cachea: `refresh()` trae el pedido con su estado nuevo y las opciones que siguen. Sin `select`, un pedido que RLS no deja ver "se actualiza" sin error |
| 65 | **Costo de envío en pesos enteros como se escriben** (`4500`, `4.500`, `$ 4.500`), vacío = a coordinar, tope de $ 1.000.000. El tope vive en `src/lib/admin/shipping.ts`, no en `LIMITS` | Frena un cero de más (la base solo pide `>= 0`). `LIMITS` son largos de texto: mezclar montos le cambiaría el significado |
| 66 | **Estados del pedido en tres luminosidades** (`OrderStatusBadge`: relleno = pendiente, borde = en curso, apagado = cerrado) y **fechas con zona fija** `America/Argentina/Buenos_Aires` (`formatDateTime`) | DESIGN.md pide que los estados se distingan sin depender del color. El servidor (Netlify) corre en UTC: sin zona fija, un pedido de las 21 h aparece al día siguiente |
| 67 | **Compare-and-set al cambiar el estado:** el formulario manda el estado que el admin estaba viendo (`fromStatus`) y el update filtra por él (`.eq('status', fromStatus)`). Con 0 filas, "el pedido cambió, recargá". Re-guardar el mismo estado no llega a la base | Cancelar es válido desde casi cualquier estado: una pestaña vieja que mostraba "pendiente" podía cancelar un pedido ya pagado, devolver el stock y no se podía deshacer. La base no lo frenaba porque la transición era válida. Salió del `/review` (revisor adversarial) |
| 68 | **La lista trae todos los pedidos activos sin tope y los últimos 100 cerrados** (dos consultas sobre `orders_status_created_at_idx`), y avisa cuando corta el historial | Con "los últimos 100 pedidos", uno viejo todavía en preparación o enviado desaparecía del panel y nadie lo despachaba. Los activos son pocos; el historial es lo que crece |
| 69 | **"Salir" cierra solo la sesión actual** (`signOut({ scope: 'local' })`) | Sin scope, supabase-js usa `global` y revoca las sesiones del admin en todos sus dispositivos |
| 70 | **`firstFieldErrors` (`src/lib/forms/field-errors.ts`): un solo lugar para "el primer error de zod por campo"** en checkout, encargos y login. Los errores que ya estaban (reglas entre campos del checkout) tienen prioridad | Era la tercera copia del mismo loop. No usa `z.flattenError` para conservar la prioridad del checkout sin cambiar su comportamiento |

### K. Decisiones de la Fase 6, parte A (antes del lanzamiento, 2026-10-07)

| # | Decisión | Por qué |
|---|---|---|
| 71 | **Las Server Actions con formulario empiezan con `requireAdminAction()`; las páginas, con `requireAdmin()`.** Misma regla (sesión del usuario, sin admin al login), pero si el acceso no se puede verificar devuelve `{ ok: false, message }` al formulario. Solo `getAdminStatus()` va dentro del `try`: el `redirect` queda afuera | Lanzar dentro de una acción reemplaza la página por `error.tsx` y el admin pierde lo escrito (el costo de envío). Con el `redirect` fuera del `try` no hace falta `unstable_rethrow` (la guía de Next sugiere encapsular antes que relanzar) |
| 72 | **`getAdminStatus()` lanza solo si Auth no respondió** (red, 5xx: `AuthRetryableFetchError`). Un 4xx (sesión revocada, usuario borrado) o la falta de sesión es `anonymous`, salvo el **429**: Auth limitando pedidos con la sesión todavía válida cuenta como "no respondió" | TODOS.md decía "lanzar si no es `AuthSessionMissingError`", pero con una sesión revocada la cookie sigue ahí: el login también llama a `getAdminStatus()` y el admin quedaría en `error.tsx` sin poder volver a entrar. Un test con la clase real de auth-js lo cubre. El 429 salió del `/review`: mandaba al login y el admin perdía el formulario, justo lo que evita la decisión 71 |
| 73 | **Cookies de sesión `httpOnly` siempre y `secure` en producción** (`sessionCookieOptions` en `src/lib/supabase/cookies.ts`, compartido por `server.ts` y `src/proxy.ts`). Se borró `src/lib/supabase/client.ts` | `httpOnly`: un XSS en la tienda no se lleva la sesión del panel. `secure` solo en producción porque el celular entra al dev server por la IP de la red local, sin HTTPS, y el navegador descartaría la cookie. El cliente de navegador no se usaba y necesitaría cookies legibles. Un E2E verifica la cookie real |
| 74 | **Las policies llaman `(select public.is_admin())`, no `public.is_admin()`.** Un test lee `pg_policies` y falla si vuelve una llamada suelta | Con el `select`, Postgres lo evalúa una vez por consulta (initPlan); suelto, una vez por fila (guía de performance de RLS de Supabase). La convención queda escrita en `0001` y protegida por el test |
| 75 | **El CAPTCHA del login es el nativo de Supabase Auth** (`[auth.captcha]` con Turnstile): el token viaja en `signInWithPassword({ options: { captchaToken } })` y lo verifica Auth. Se reusa `TurnstileField`, no `verifyHumanRequest`. En local y CI, la clave de prueba pública de Cloudflare va escrita en `config.toml`. **Sin token, `signIn` no llama a Auth** (`TURNSTILE_MISSING`: el widget todavía no terminó o, si se repite, un bloqueador o el DNS), y el widget pide un token nuevo solo si mandó uno y llegó a Auth | El endpoint de Auth es público (la clave publishable está en el navegador): verificar solo en la Server Action dejaba probar contraseñas pegándole directo a Auth. Verificado: un login directo sin token da `captcha_failed`, y la Admin API (`npm run db:admin`, E2E) no lo pide. `env()` en `config.toml` obligaba al CI a exportar el secreto antes de `db:start:lite`. Sin token, cada intento gastaba el límite de Auth y el mensaje ("esperá unos segundos") no ayudaba (`/review`) |
| 76 | **Keepalive y backup diarios** (`.github/workflows/keepalive-backup.yml`): ping a la API REST, `supabase db dump` (roles, esquema y datos), cifrado con `gpg` AES256 y artefacto por 7 días. Dos jobs independientes (`keepalive` y `backup`), cada uno con su variable (`KEEPALIVE_ENABLED`, `BACKUP_ENABLED`); los secretos van en el `env` de cada step, nunca del job, y las actions de terceros fijadas por SHA. Conexión por el Session pooler | El dump tiene datos personales (Ley 25.326): cualquiera con acceso al repo baja los artefactos. Un solo job hacía que un secreto faltante del backup cortara también el ping (y Supabase pausaba el proyecto). En el `env` del job, `SUPABASE_DB_URL` llegaba a actions de terceros con tag mutable; además `supabase/setup-cli@v1` no existe (los tags son `v1.7.x`, `v2`, `v3`) y el workflow habría fallado. Salió del `/review` (seguridad, red team y adversarial). Las variables evitan un mail de fallo diario hasta que exista la nube. Los runners de GitHub no tienen IPv6 y la conexión directa de Supabase es solo IPv6. Verificado con `actionlint` (encontró un YAML inválido) y una ida y vuelta local de dump, cifrado y descifrado |
| 77 | **`create_order` rechaza datos de envío largos con un solo código, `DELIVERY_DATA_TOO_LONG`** (`detail` = el campo), y el check `delivery_lengths` de `orders` cubre Studio. Topes: los de `LIMITS` | Las reglas viven en la base. Un código por campo no suma nada: el checkout ya marca el campo; el de la base solo salta si otra vía llama a la RPC. Era la última oportunidad de editar `0001` antes del deploy |
| 78 | **De un error desconocido de la base se loguea solo `code` y `message`** (`loggableDbError`), en checkout, encargos y las acciones del admin | Un check que falla pone la fila en `details` ("Failing row contains (...)"), con nombre, WhatsApp o dirección: terminaría en los logs de Netlify. El admin tenía la misma fuga (TODOS.md solo nombraba la tienda) |
| 79 | **Después de un error del servidor, el foco va al primer campo inválido** (`useFocusFirstInvalid` en `src/lib/forms/`), en checkout y encargos. En un grupo de radios, a la primera opción habilitada. `scroll-padding-top` (112 px) deja el campo y su etiqueta debajo del header fijo | En el celular el botón queda abajo y los errores de arriba no se ven. Usa el `aria-invalid` que ya marcan los campos. Verificado en el navegador a 375 px; con 80 px de margen la etiqueta quedaba tapada |
| 80 | **`npm audit`: riesgo aceptado, sin cambios.** Las 5 altas son una cadena del linter hasta `braces@3.0.3`; `--omit=dev` da 0 | No hay arreglo publicado y `npm audit fix --force` baja `eslint-config-next` a la 14. Queda en TODOS.md con la señal para revisarlo |

### L. Envíos estimados en el checkout (antes de la Fase 6, parte B, 2026-10-08)

Pedido del dueño: al elegir "Envío a domicilio", mostrar "Envío estimado a sucursal $ 7.000" y "Envío estimado a domicilio $ 9.000", editables cuando haga falta. Rama `feat/shipping-estimates`, antes de la parte B porque toca la base (`0001` todavía se edita directo).

| # | Decisión | Por qué |
|---|---|---|
| 81 | **Los montos viven en la base, en `shipping_rates` (una sola fila: `id = true`)**, y se editan en `/admin/envios`. Lectura pública; solo el admin cambia los dos montos (RLS con `(select is_admin())` y permisos de columna); nadie agrega ni borra filas: triggers `BEFORE DELETE` y `BEFORE TRUNCATE` (`SHIPPING_RATES_REQUIRED`, también para Studio) y `truncate` revocado a los roles públicos. Pesos enteros con el tope de $ 1.000.000 de la decisión 65, atado al de TS por un test | Una variable de entorno solo cambia con un deploy, y el dueño los quiere cambiar cuando lo necesite. Sin la fila, `/admin/envios` no tiene qué editar y el admin no puede crearla (no tiene insert). `TRUNCATE` no pasa por RLS y Supabase lo otorga por defecto (`/review`) |
| 82 | **Son solo informativos:** el cliente no elige entre sucursal y domicilio, y el pedido sigue naciendo con el envío "a coordinar" (`shipping_cost = null`); el admin carga el costo real como antes | Decisión del dueño. Con los precios informativos no hay cómo saber cuál sumar: sumar uno obligaría a corregir muchos pedidos |
| 83 | **`getShippingRates()` cacheado con su propio tag (`shipping-rates`) y `cacheLife('minutes')`**, como el catálogo; guardar en el admin hace `updateTag`. Si la lectura falla, el checkout vuelve al texto de siempre y lo loguea (`getShippingRatesOrNull`) | El checkout ve el monto nuevo al instante. A diferencia del catálogo (sin él no hay compra), los estimados no pueden bloquear una venta |
| 84 | **El formulario reusa `parseShippingCost`** (acepta `9000`, `9.000` y `$ 9.000`, mismo tope), **pero vacío no vale. 0 sí: el checkout muestra "Envío a sucursal: gratis"** | Vacío es ambiguo (¿gratis o sin cargar?); 0 es una decisión explícita (una promo). Antes del `/review`, un 0 tipeado por error se publicaba como "$ 0"; el dueño eligió que signifique envío gratis |
| 85 | **El E2E corre solo en el proyecto desktop (skip a nivel de archivo con `isMobile`), calienta el caché antes de cambiar los montos sin suponer con cuál arranca, y restaura los del seed** | Una sola fila para toda la tienda: con el skip dentro del test, el `afterEach` de mobile igual corría y pisaba la fila. Sin el caché caliente, sacar el `updateTag` igual pasaba (verificado con esa mutación). La restauración directa no invalida el caché: suponer "$ 9.000" al arrancar fallaba en un reintento (`/review`) |
| 86 | **La navegación del panel marca la sección actual** (`AdminNavLink`: `aria-current="page"` y color de texto principal, también en subpáginas) | Con dos secciones no se veía dónde estaba el admin ni lo anunciaba el lector de pantalla. Las clases compartidas van en un módulo común: el layout es de servidor y no importa valores de un módulo cliente. Cada link va en un `<Suspense>` (fallback: el mismo link sin marcar): con Cache Components, `usePathname()` suspende al prerenderizar `/admin/pedidos/[id]` y la build fallaba, aunque `next dev` y los tests pasaban |

### M. Decisiones de la Fase 6, parte B (nube y dominio, 2026-10-08)

| # | Decisión | Por qué |
|---|---|---|
| 87 | **El token de Turnstile vale solo para su acción y su dominio.** El widget manda `action` (`checkout`, `encargo`, `login`) y `verifyTurnstile` exige la misma y un `hostname` de `SITE_HOSTNAMES` (coincidencia exacta; producción: `falber.com.ar,falber.netlify.app`). `SITE_HOSTNAMES` es obligatoria, se valida (vacía o mal escrita, con `https://` o barra, falla cerrado) y el build de producción de Netlify (`CONTEXT=production`) se frena si falta o si `TURNSTILE_SECRET_KEY` es una clave de prueba (`src/lib/security/env-checks.ts`, llamado desde `next.config.ts`). Excepción: si Cloudflare marca `metadata.result_with_testing_key`, no se exige nada | Antes solo se miraba `success`: un token resuelto en `/checkout` servía en `/encargos`, y uno resuelto en un Deploy Preview, en producción. Lo inverso no lo cubre: un token resuelto en `falber.com.ar` sirve en la Server Action de un preview, que usa la base real. A los previews los protege la visibilidad Private de Netlify (verificado: 401 sin login). El login acepta tokens de otros formularios porque Supabase Auth no mira la acción: riesgo aceptado, el token igual se gasta una sola vez. La excepción es la respuesta real del secreto de prueba (sin `action` y con `hostname: "example.com"`, verificado con una llamada a `siteverify`): sin ella, local, CI y E2E no pasarían, y no abre nada en producción porque la marca la pone el secreto, no el token. La acción del login la verifica Supabase Auth, que no la mira: queda para las métricas de Cloudflare. La validación al build salió del `/review`: un valor mal cargado rechazaba todos los pedidos sin error visible, porque CI y E2E usan las claves de prueba y nunca miran el dominio |
| 88 | **Headers contra el embebido en `next.config.ts`:** `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'` y `Referrer-Policy: strict-origin-when-cross-origin` en todas las rutas. `Strict-Transport-Security` y `X-Content-Type-Options: nosniff` los agrega Netlify (verificado en producción), así que no se repiten. La CSP completa queda pendiente | Sin ellos, `/checkout` se podía meter en un iframe de otro sitio y engañar el click en "Realizar compra" (clickjacking). Salió del `/review` de la parte B. Una CSP completa necesita la allowlist de Turnstile (`challenges.cloudflare.com`) y de las fotos de Storage, y conviene probarla en modo report-only antes |

### N. Decisiones después del lanzamiento (2026-10-10)

| # | Decisión | Por qué |
|---|---|---|
| 89 | **La confirmación del encargo ofrece "Enviar por WhatsApp"** con el mensaje armado (`buildRequestWhatsAppMessage`: nombre, perfume y lo opcional que se completó, sin el WhatsApp del cliente). La Server Action devuelve el link (`whatsappUrl`) y lee el número de la tienda antes de guardar. Reemplaza el "te escribimos por WhatsApp" de la decisión 47 | La base guarda el encargo pero no avisa a nadie, y no hay pantalla del admin para encargos (decisión 10): uno de prueba en producción no le llegó a la tienda. Con los pedidos no pasaba porque el cliente termina en WhatsApp. Es el canal por el que ya se vende, sin servicios ni claves nuevas; si el cliente no toca el botón, el encargo igual queda en `perfume_requests`. Leer el número antes de guardar evita un encargo guardado con el cliente viendo un error y reintentando |
| 90 | **Encargos en el panel: pestaña "Encargos" a la derecha de "Pedidos", con el número de pendientes** (`PendingRequestsCount`, en su propio `<Suspense>`; con 0 no se muestra). `/admin/encargos` lista abiertos sin tope y los últimos 100 cerrados, pendientes primero (el más viejo arriba), sin página de detalle: cada fila trae el encargo entero, "Escribirle por WhatsApp" (saludo armado al cliente) y el cambio de estado. Cualquier estado a cualquier otro, con compare-and-set sobre el estado que se ve. Sin migración: RLS y el permiso de columna (`update (status)`) ya existían. Achica la decisión 10: productos y stock siguen en Studio | El botón de la decisión 89 depende de que el cliente lo toque: sin registro en el panel, un encargo sin mensaje no se veía salvo entrando a Studio. El número en la navegación avisa sin abrir la pestaña. La base no limita las transiciones de un encargo (no tocan stock), así que se ofrece cualquier estado, para poder corregir un error; el compare-and-set evita que una pestaña vieja pise un cambio. Si el conteo falla devuelve 0: es un aviso y no puede tirar abajo el panel |

### O. Decisiones de la Fase 7 (admin de catálogo, plan del 2026-10-10)

Plan acordado antes de codear, pendiente de `/plan-eng-review`. Reemplaza "productos y stock siguen en Studio" (decisiones 10 y 90).

| # | Decisión | Por qué |
|---|---|---|
| 91 | **Dos estados: "Publicado" (`active`) y "No publicado" (`inactive`).** El producto nace `inactive` y se publica a mano; ocultarlo es volver a `inactive`. Sin migración para el estado | El enum tiene dos valores. Un tercero ("borrador" vs. "oculto") solo ordena la lista del admin y costaba una migración sobre un enum en producción y un caso más en cada consulta. Para el cliente lo único que cambia es si el producto está o no en la tienda |
| 92 | **Migración `0003` con las reglas nuevas del catálogo** (`0001` está congelada desde el deploy). Cada regla con su test en `schema.test.cjs` y su mensaje en castellano | Las reglas viven en la base: si quedan solo en la Server Action, Studio u otro código se las saltean. Es la primera migración posterior al deploy: se aplica en la nube con `supabase db push` después del merge |
| 93 | **Publicar exige foto y al menos una presentación disponible** (`PRODUCT_NOT_PUBLISHABLE`, trigger en `products` al pasar a `active`). **No exige stock.** La foto es un invariante: el mismo trigger rechaza `image_path = null` en cualquier producto que queda `active` | Cambia lo acordado ("precio y stock"): un perfume agotado publicado es un estado válido de la tienda, que lleva a "Encargar" (Fase 4). Las presentaciones se miran solo en la transición: sacar la última de un producto publicado no lo despublica, la tienda ya muestra el caso sin opciones. La foto no tiene un estado intermedio válido: sin el invariante, Studio podía dejar una ficha publicada sin imagen (`/plan-eng-review`) |
| 94 | **El slug se arma de marca + nombre al crear el producto y no cambia nunca** (`SLUG_LOCKED`, trigger en update). La función (`slugify`, sin tildes, `n°5` → `n-5`) es pura y se testea contra el `check` del slug. El formulario de alta muestra el slug antes de guardar. Repetido (`23505` en `products_slug_key`): "Ya existe un producto con esa marca y nombre" | Los links compartidos y `/encargos?producto=<slug>` siguen andando aunque se corrija el nombre. Fijo desde la creación es más simple que "fijo desde que se publica": no hace falta saber si alguna vez estuvo publicado. Mostrarlo antes de guardar es la defensa contra un typo |
| 95 | **Ocultar, nunca borrar:** `0003` revoca `delete` en `products` y `product_variants` a `authenticated`. Una presentación se retira con "No disponible" (`is_available = false`) | Pedidos e historial de stock los referencian. Hoy la policy `for all` deja borrar un producto sin historial y el `cascade` se lleva sus presentaciones: la regla queda en la base, no en la ausencia de un botón |
| 96 | **Una foto por producto, subida desde el navegador con una URL firmada:** una Server Action (`requireAdminAction()`, sesión del admin) elige la ruta (`<slug>-<random>.webp`) y pide `createSignedUploadUrl` (Storage aplica la policy de insert del admin); el navegador sube con `uploadToSignedUrl`. Después otra acción guarda `image_path` y borra la foto anterior (si falla el borrado, se loguea; si falla el guardado, se intenta borrar la nueva). **Esa acción no confía en la ruta que manda el navegador:** exige `<slug del producto>-<random>.(webp|jpg)` y que el objeto exista en el bucket; si no, mensaje y no cambia nada | Las cookies de sesión son `httpOnly` y no hay cliente de navegador (decisión 73): el navegador no puede subir con la sesión del admin. La URL firmada no expone la sesión y el archivo no pasa por la Server Action (límite de 1 MB) ni por Netlify (~6 MB). Nombre único por subida: con el mismo nombre, el navegador y `next/image` muestran la foto vieja. `createSignedUploadUrl` exige el permiso de `insert` sobre `objects` (docstring de `storage-js`): usa la policy del admin de `0001`. Sin validar la ruta, una subida cortada dejaba una foto rota en un producto publicado (`/plan-eng-review`) |
| 97 | **La foto se achica en el navegador antes de subir** (lado mayor 1600 px, WebP; si el navegador no codifica WebP, `blob.type` lo delata y se usa JPEG) y **el bucket limita tamaño y tipo** en `0003`: 5 MiB y `image/webp`, `image/jpeg` | Una foto de celular pesa 3 a 8 MB. El bucket de la nube no tiene límites propios (hereda 50 MiB y cualquier tipo): la validación del navegador se saltea, la del bucket no |
| 98 | **Presentaciones: decant de 3, 5 o 10 ml** (`DECANT_SIZES` en TS, sumar un tamaño no pide migración) **o frasco con los ml a mano** (entero, 1 a 1000). La etiqueta la genera la base. **Tipo y ml quedan fijos al crearla** (`0003` revoca `update (variant_type, size_ml)`): se editan precio y disponible. Repetida (`23505`): "Ese producto ya tiene esa presentación" | Si "Decant 5 ml" pasara a ser "Decant 10 ml", su historial de stock y sus pedidos quedarían hablando de otra cosa. Para corregir un error se crea la correcta y se marca la otra "No disponible" |
| 99 | **Precio en pesos enteros como se escriben** (mismo parser que el costo de envío, decisión 65) con su propio tope, más alto que el de envíos | Un frasco nicho puede pasar el $ 1.000.000 de los envíos. El tope frena un cero de más (la base solo pide `>= 0`) |
| 100 | **Stock solo con movimientos desde el admin** (`initial_stock`, `restock`, `adjustment` sumar/restar, `damaged`; la cantidad se escribe positiva y el signo lo pone el tipo), con nota opcional e historial por presentación (también `sale` y `order_cancelled`). Stock inicial opcional al crear la presentación: dos inserts; si falla el segundo, la presentación queda con 0 y se avisa. Restar más de lo que hay lo rechaza la base (`stock >= 0`): "No hay tanto stock para descontar" | Es la regla del proyecto y lo que ya permite la policy "admin: add manual stock movements". Dos inserts en vez de una RPC: el caso que falla queda a la vista y se corrige con un movimiento |
| 101 | **Rutas:** `/admin/productos` (lista sin tope: miniatura, marca y nombre, estado, presentaciones con stock, destacado; arriba, un alta corta con marca, nombre, género y el slug a la vista) y `/admin/productos/[id]` (datos, foto, publicar, presentaciones y stock en la misma página). El alta crea el producto sin publicar y redirige a su página. Sin ruta `/nuevo`. Pestaña "Productos" en la navegación. "Destacado" se marca en el formulario de datos | Son ~30 perfumes: sin paginación ni búsqueda. La foto y las presentaciones necesitan que el producto exista (la ruta de la foto usa el slug): un alta completa igual lo crearía antes de subir nada, y el formulario de datos quedaría duplicado entre alta y edición. Salió del `/plan-eng-review` |
| 102 | **Cada guardado que cambia lo que ve la tienda hace `updateTag('catalog')`** (decisión 34) y `refresh()`. `requireAdminAction()` primero, sesión del admin (nunca `service_role`), zod repite los límites de la base, updates con `.select('id')` (decisión 64) y errores con `mapDbError` / `loggableDbError` | Mismas reglas que el resto del panel |

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
| `/admin/login` | Login (Supabase Auth, email y contraseña). Una cuenta sin perfil de admin ve "sin acceso" |
| `/admin/pedidos` | Lista: todos los activos (pendientes primero, el más viejo arriba) y los últimos 100 cerrados; aviso de cancelación automática desde las 24 h, envíos sin costo |
| `/admin/pedidos/[id]` | Detalle, cambio de estado (solo transiciones válidas) y costo de envío |

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
| `perfume_requests` | Encargos | `variant_id` opcional (agotado) o perfume libre; snapshot del nombre; marca y presentación hasta 60 |
| `profiles` | Administradores | Vinculado a Supabase Auth |
| `rate_limit_events` | Intentos por IP (hasheada) | Se purga a diario |

### Estados del pedido

```
pending ─► confirmed ─► paid ──────► preparing ─┬─► ready_for_pickup ─► completed   (retiro)
               │                        ▲       └─► shipped ─────────► completed   (envío)
               └──── (efectivo) ────────┘
cancelled: desde cualquier estado salvo shipped / completed. Devuelve el stock. No se reabre.
pending de más de 48 h: se cancela solo (pg_cron, cada hora). El admin ve el aviso desde las 24 h.
costo de envío: solo con envío y antes de shipped / completed / cancelled (guard_shipping_cost).
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

Implementado en `src/lib/order-errors.ts` (el código es la fuente; este bloque es el resumen). Un test lee la migración y falla si `create_order` o `enforce_rate_limit` levantan un código sin mensaje. En los errores de stock, `detail` trae el `variant_id` y el checkout marca ese producto.

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

Implementado en `src/lib/whatsapp.ts`. Dos diferencias con el bloque de arriba: los precios van sin el espacio duro de `Intl` (`$10.000`), y si el admin ya cargó el costo de envío se agrega la línea `Envío: $X` antes del total (`shipping_cost` es `null` hasta entonces). El número de FALBER sale de `NEXT_PUBLIC_WHATSAPP_NUMBER` (`src/lib/store-env.ts` rechaza un formato que no sea 549 + área + número). El número del cliente lo normaliza `src/lib/phone.ts` a `+549` + 10 dígitos.

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
2. **`requireAdminAction()` en la primera línea de cada Server Action del admin y `requireAdmin()` en cada página** (`src/lib/admin/auth.ts`, decisión 71; las únicas excepciones son `signIn` y `signOut`, decisión 60). Cookies de sesión `httpOnly` (decisión 73) y CAPTCHA nativo de Supabase Auth en el login (decisión 75). El proxy (`src/proxy.ts`, solo en `/admin`) refresca la sesión y redirige; no es una frontera de seguridad (antecedente: CVE-2025-29927).
3. Las acciones del admin usan el cliente con la **sesión del usuario**, nunca `service_role`: así RLS sigue protegiendo.
4. Turnstile verificado en el servidor antes de llamar a la RPC (después de zod, decisión 35). Falla cerrado.
5. HMAC-SHA256 de la IP con `IP_HASH_SECRET` (32 caracteres o más) como `p_client_key`: nunca se guarda la IP en crudo. La IP sale de `x-nf-client-connection-ip`, no de `x-forwarded-for` (decisión 37).
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

### Fase 3 — Carrito, checkout, pedidos y WhatsApp (implementada en `feat/checkout`, 2026-10-05)

```text
Usá superpowers:test-driven-development. Implementá: carrito (localStorage, solo
variant_id + cantidad), normalización de WhatsApp argentino, checkout con zod +
Turnstile + request_id (UUID al cargar) + botón deshabilitado al enviar, Server
Action que llama create_order con service_role y hash de IP, mapa ORDER_ERRORS,
updateTag('catalog'), /pedido/[id] con get_order_summary y el botón de
WhatsApp. Test E2E de Playwright: compra completa.
```

**Antes de empezar:** confirmado en la doc de Next 16.3: la Server Action usa `updateTag('catalog')`, no `revalidateTag` (decisión 34). El carrito se agrega en `/producto/[slug]` (decisión 33).

Color de error: resuelto con el token `error` (Noir `#e5867d`, Platinum `#a8332b`), ya aplicado en `Input` (DESIGN.md → Regla del error). Falta copiarlo al artifact del design system.

Las decisiones que salieron están en la sección 3.H (34 a 43).

**Lecciones:**
- En Windows, `npm install <paquete>` reescribe el lockfile y borra las dependencias opcionales `@emnapi/*` que necesita el `npm ci` de Linux. Para cambiar dependencias: editar `package.json` y el lockfile a mano y validarlo con npm en Linux (`docker run node:24 npm install --package-lock-only`). Mirar siempre `git diff --stat package-lock.json`.
- Antes de tipar una respuesta externa, mirar una real: `get_order_summary` devuelve `shipping_cost: null` (no `0`), y un id que no es UUID hace que Postgres responda 400.
- Los tipos generados por `supabase gen types` declaran los argumentos de texto de las RPC como `string`, no `null`: se manda `""` y la función lo convierte con `nullif(trim(...))`.
- zod 4 no corre un `superRefine` del objeto si un campo ya falló. Si importa mostrar todos los errores juntos, escribir el test de ese comportamiento.
- "Sin scroll horizontal" no garantiza que todo se vea: el nav del header desbordaba sin agrandar la página. Hay que medir el elemento.
- Playwright: `getByLabel` busca texto parcial (usar `{ exact: true }`) y Next agrega su propio `role="alert"` (el anunciador de rutas): filtrar por texto.
- Una hipótesis de bug se confirma antes de arreglarla: la build de producción (`next build`) descartó que `crypto.randomUUID()` en el estado inicial del checkout rompiera el prerender.

### Fase 4 — Encargos (implementada en `feat/requests`, 2026-10-06)

```text
Usá superpowers:test-driven-development. Implementá /encargos ("¿No encontrás tu
perfume?"): nombre, WhatsApp, perfume, marca, presentación y aclaración (máx. 100),
con zod + Turnstile + botón deshabilitado al enviar, y una Server Action que llama
create_perfume_request con service_role y la IP hasheada. Reusá lo de la Fase 3
(generalizarlo en commits de refactor aparte). Leé ?producto=<slug> y precargá
perfume y marca desde el catálogo. Mapa de errores con test que lea la migración.
Test E2E: encargo desde un producto agotado, encargo libre y error del servidor
que conserva lo escrito, cada uno con su IP y su WhatsApp.
```

**Antes de empezar:** el botón "Solicitar disponibilidad" ya enlaza a `/encargos?producto=<slug>` (decisión 33). El form tiene que leer ese parámetro y precargar el perfume.

Las decisiones que salieron están en la sección 3.I (44 a 54; de la 50 a la 54 salieron del `/review` de la fase).

**Lecciones:**
- El reset del `<form>` de React 19 después de una Server Action devuelve selects y radios a lo que tenían **al montarse**. Un formulario que "conserva lo escrito" hay que probarlo también con selects y radios, no solo con inputs de texto (así apareció el bug del checkout, decisión 48).
- Ante un test que falla sin causa obvia, primero medir: un test temporal que registra el valor enviado, el valor después de la respuesta y `defaultSelected` descartó la primera hipótesis (select controlado) y mostró la causa real.
- `tsc --noEmit` solo no conoce una ruta nueva (`PageProps<"/encargos">`): los tipos de rutas los genera `next typegen`. Usar `npm run typecheck`.
- Después de editar `0001`, `npm run db:reset` antes de los E2E: la base local no toma el cambio sola.
- Con Cache Components, **una página que se deja no se desmonta** (Next la esconde con `<Activity>`): el estado de los formularios sobrevive. Probar los flujos "hacerlo dos veces en la misma pestaña" navegando **solo con links**: un `page.goto` recarga todo y esconde el problema. En Vitest, `<Activity mode="hidden">` de React 19.2 lo reproduce sin navegador.
- Un `useEffect`/`useLayoutEffect` con un array creado en cada render (`prefill?.variants ?? []`) en sus dependencias se re-ejecuta en cada render, y su limpieza también. Depender de un valor primitivo derivado (el id).
- Un test de contrato que pasa de entrada (ej. el límite por IP) se valida con una mutación: sacar la línea que protege y ver que falla.
- Una hipótesis de un revisor se prueba antes de arreglar: el red team marcó el checkout como afectado por `<Activity>` y el E2E mostró que no (navega con `replace`).

### Fase 5 — Admin de pedidos (implementada en `feat/admin-orders`, 2026-10-06)

```text
Usá superpowers:test-driven-development. Antes de codear, leé en 0001 is_admin(),
profiles, las policies de orders y stock_movements, is_valid_order_transition y el
trigger de cancelación. Implementá con tema Platinum: /admin/login (Supabase Auth,
email y contraseña; registro público desactivado), /admin/pedidos (pendientes
primero, alerta de más de 48 h, detalle, cambio de estado solo a transiciones
válidas, costo de envío). requireAdmin() en la primera línea de cada Server
Action, con la sesión del usuario (nunca service_role); updateTag('catalog') al
cancelar; errores con mapDbError y los desconocidos logueados. Pendientes de la
Fase 1: data-theme="light" en /admin y src/proxy.ts (leer antes la guía de
node_modules/next/dist/docs/). Admin de prueba desde un script, nunca credenciales
reales. E2E: /admin sin sesión redirige, un no-admin no ve pedidos, un admin
confirma un pedido y le carga el costo de envío. Plan de commits antes de codear.
```

**Pendientes de la Fase 1, resueltos:** Platinum con un contenedor `data-theme="light"` (decisión 62) y `src/proxy.ts` solo en `/admin` (decisión 58).

Las decisiones que salieron están en la sección 3.J (55 a 70; de la 67 a la 70 salieron del `/review` de la fase).

**Lecciones:**
- Loguear los errores desconocidos paga: el primer login falló con el mensaje genérico, y el log mostró `email_provider_disabled`, un error de configuración de la Fase 1 (decisión 61) que nadie había visto porque hasta acá nadie iniciaba sesión.
- Un `select` de supabase-js armado concatenando strings pierde los tipos: TypeScript lo ve como `string`, y la fila pasa a ser un tipo de error sin que `tsc` se queje. Va como un solo literal. Se detectó con un archivo temporal que asigna valores imposibles a los campos.
- Playwright compila los `.ts` a CommonJS: un módulo compartido entre un script de Node y los E2E no puede usar `import.meta`.
- `getByText` de Playwright busca por subcadena y sin distinguir mayúsculas: "A coordinar" encontraba el hint del campo ("Vacío: a coordinar."). Usar `{ exact: true }`.
- En `es-AR`, ICU ignora `day: "2-digit"` ("6/10"): el formato rellena a mano.
- La copia en TS de una regla de la base se prueba contra el mismo fixture que la base. Y el test del fixture se valida rompiéndolo a propósito (una mutación).
- Una prueba de UX en el navegador encontró lo que los tests no buscaban: al cancelar, el formulario pasaba a "Este pedido está cerrado." y se perdía la confirmación. Primero el test que lo reproduce, después el fix.
- Una regla de la base que acepta la transición no protege contra datos viejos en la pantalla: "cancelar" es válido desde casi todo, así que una pestaña vieja podía cancelar un pedido pagado. Un update que depende de lo que el usuario vio filtra también por eso (compare-and-set, decisión 67). Lo encontró el revisor adversarial, no los tests.
- Leer los defaults de las librerías que tocan la sesión: `signOut()` de supabase-js es `global` por defecto (decisión 69).
- El proyecto no usa Prettier: correr `npx prettier --write` reformatea con su ancho por defecto y deja el archivo distinto al resto. Verificar la config antes de usar un formateador.

### Fase 6 — Operación y lanzamiento

```text
GitHub Action diaria: ping a Supabase (evita la pausa del plan gratuito) +
pg_dump como artefacto. Deploy en Netlify. Después:
/design-review → /qa → /cso → /review.
```

Se hace en dos partes, cada una con su PR.

**Parte A — código antes del lanzamiento (implementada en `feat/launch-hardening`, 2026-10-07).** Prompt:

```text
Arrancamos la Fase 6, parte A (código antes del lanzamiento). Creá la rama
feat/launch-hardening desde main. Leé el documento maestro (Fase 6 y sección 11),
TODOS.md y CLAUDE.md. Usá superpowers:test-driven-development. Implementá, cada uno
en commits atómicos: (1) TODOS.md → "Endurecer la sesión del admin"; (2) TODOS.md →
"CAPTCHA en el login del admin"; (3) GitHub Action diaria: ping a Supabase y pg_dump
como artefacto, secretos solo con ${{ secrets.X }}; (4) revisá el resto de los
pendientes "antes de la Fase 6" y proponé cuáles entran antes de codear.
Antes de codear, el plan de commits. Al final: /review, PDF y PR.
```

Dos cambios sobre lo pedido, acordados antes de codear: el CAPTCHA es el nativo de Supabase Auth y no `verifyHumanRequest` (decisión 75), y el backup va cifrado (decisión 76). De los pendientes entraron los largos de envío, los logs sin datos personales, el foco al primer error y la revisión de `npm audit`; quedaron afuera el límite de encargos por WhatsApp (señal reactiva), atar Turnstile al dominio (necesita el dominio de producción) y medir largos como Postgres (P3). Las decisiones están en la sección 3.K (71 a 80).

**Antes de la parte B: envíos estimados** (`feat/shipping-estimates`, decisiones 81 a 86). Toca la base, así que va antes del primer deploy.

**Parte B — nube, deploy y dominio.** Proyecto de Supabase con `0001` y `0002` (pg_cron), Auth (sección 11), secretos y variables del workflow, deploy en Netlify. Después, `/design-review` → `/qa` → `/cso` → `/review`.

**Dominio: `falber.com.ar`.** En este orden, porque cada paso depende del anterior:
1. Deploy y pruebas en la URL de Netlify (`*.netlify.app`).
2. Conectar `falber.com.ar` en Netlify (Domain management). En NIC Argentina, las delegaciones del dominio apuntan a los nameservers que da Netlify DNS. Netlify emite el certificado HTTPS solo. Canónico: `falber.com.ar`; `www` redirige con 301 (verificado). Si algún día se pasa a `www`, cambiar `SITE_HOSTNAMES` en el mismo momento: la comparación es exacta y, si no, se rechazan todos los pedidos y encargos.
3. Con el dominio andando: Supabase → Authentication → URL Configuration → Site URL = `https://falber.com.ar`; en Cloudflare, el widget de Turnstile con `falber.com.ar` como hostname.
4. Token de Turnstile atado a la acción y al dominio (decisión 87, hecho): `SITE_HOSTNAMES` = `falber.com.ar,falber.netlify.app`.

El dominio no se difunde hasta tener el catálogo y las fotos reales cargados (TODOS.md → Catálogo).

**Backups (decisión 76).** El workflow `.github/workflows/keepalive-backup.yml` corre todos los días a las 03:17 y a mano (Actions → Keepalive y backup → Run workflow). Para activarlo, en GitHub → Settings → Secrets and variables → Actions:
- Secretos: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_URL` (Supabase → Connect → **Session pooler**, puerto 5432) y `BACKUP_PASSPHRASE` (generada, guardada también en un gestor de contraseñas: sin ella el backup no sirve).
- Variables: `KEEPALIVE_ENABLED` = `true` (con los dos primeros secretos) y `BACKUP_ENABLED` = `true` (con los otros dos).

Restaurar (en un proyecto vacío, con la passphrase):

```bash
gpg -d falber-AAAAMMDD-HHMM.tar.gz.gpg | tar -xz
psql "$SUPABASE_DB_URL" --single-transaction -v ON_ERROR_STOP=1 -f backup/roles.sql -f backup/schema.sql -c 'SET session_replication_role = replica' -f backup/data.sql
```

`session_replication_role = replica` apaga los triggers mientras se cargan los datos: sin eso, `stock_movements` volvería a sumar el stock y los triggers de pedidos rechazarían las filas históricas.

El dump **no trae** los jobs de pg_cron ni el historial de migraciones (verificado: la base local tiene 2 jobs y el dump, ninguno). Después de restaurar:
1. Habilitar pg_cron (Database → Extensions) y correr `supabase/migrations/0002_schedule_jobs.sql`. Verificar con `select jobname from cron.job` (dos jobs). Sin esto, los pedidos abandonados no se cancelan y el stock queda reservado.
2. Marcar las migraciones como aplicadas: `npx supabase migration repair --status applied 0001 0002`. Sin esto, un `supabase db push` intentaría aplicar `0001` de nuevo.

**Lecciones:**
- Leer el comportamiento real antes de seguir una receta: "lanzar si no es `AuthSessionMissingError`" (TODOS.md) dejaba a un admin con la sesión revocada sin poder volver a entrar. Lo mostró leer qué devuelve auth-js para cada caso, y quedó como test con las clases reales (decisión 72).
- Un CAPTCHA protege la puerta por la que pasa el atacante, no la del formulario. El de la Server Action se salteaba pegándole directo a Auth con la clave pública. Se verificó con una llamada sin token (`captcha_failed`) antes de darlo por cerrado.
- Los tests que cubren comportamiento existente pasan de entrada: se validaron rompiendo la regla a propósito (mutaciones en `0001` y en `LoginGate`). Uno de los tests nuevos, el de la sesión revocada, existe solo para frenar la implementación ingenua.
- Un workflow no se puede correr hasta que exista la nube, pero sí lintear (`actionlint` desde Docker) y ensayar sus pasos contra el Supabase local. `actionlint` encontró un `run:` con `apikey: …` sin comillas: YAML inválido que GitHub ni siquiera habría cargado.
- `actionlint` valida el YAML, no que la action exista: `supabase/setup-cli@v1` pasaba el lint y no existe. Fijar las actions por SHA obliga a resolver el tag con `gh api repos/<owner>/<repo>/tags` y lo deja a la vista.
- Un mock que devuelve siempre el mismo objeto no se comporta como una Server Action: cada respuesta real llega como un objeto nuevo. Un efecto que depende de esa identidad (el foco al primer error) solo se prueba con `mockImplementation(async () => ({ ... }))`.
- Un test que crea pedidos tiene que usar un WhatsApp propio por caso: sin la regla, los primeros casos crearon pedidos y los siguientes fallaron por `TOO_MANY_PENDING_ORDERS`, no por lo que probaban.

**Parte B — hecho (2026-10-08).** Supabase en São Paulo con `0001` y `0002` aplicadas con `supabase db push` y verificadas (RLS en todas las tablas, 2 jobs de pg_cron, bucket `product-images` con sus 3 policies); desde acá `0001` queda congelada y todo cambio de esquema va en una migración nueva. Auth con el registro público apagado, Email habilitado, CAPTCHA Turnstile con el secreto real y el admin con su fila en `profiles`. Widget de Turnstile invisible con los hostnames `falber.com.ar` y `falber.netlify.app`. Deploy de `main` en `falber.netlify.app` con 7 variables (sin `NEXT_PUBLIC_PRODUCT_IMAGES_BASE_URL`: en producción las fotos salen de Storage). Probado en producción: compra completa desde el celular (WhatsApp correcto, pedido pendiente en el admin), la cancelación devuelve el stock y la IP se hashea con la IP real (claves distintas desde dos redes). Dominio con Netlify DNS, delegado en NIC Argentina. Backup activo (2026-10-08): los 4 secretos y las 2 variables en GitHub, una corrida a mano con los dos jobs en verde y el artefacto descargado se descifró con la passphrase (lista `roles.sql`, `schema.sql` y `data.sql`). Dominio en producción (2026-10-08): certificado de Let's Encrypt para `falber.com.ar` y `*.falber.com.ar`, `www` y `http://` redirigen con 301 a `https://falber.com.ar`, Site URL de Supabase en `https://falber.com.ar` y login del admin probado en el dominio. Visibilidad del proyecto en Netlify: Private aplicado solo a los Deploy Previews (producción pública). Token de Turnstile atado a la acción y al dominio (decisión 87).

**Auditorías de la parte B (2026-10-09):** `SITE_HOSTNAMES` cargada en Netlify (All scopes) y el Deploy Preview del PR #10 responde 401 sin login. `/design-review`: 6 hallazgos, 4 arreglados (B → A-); el hero placeholder ya estaba en TODOS. `/qa`: salud 99/100, compra y encargo completos contra la rama, 2 hallazgos bajos a TODOS (`robots.txt`/`sitemap.xml`, texto del catálogo vacío). `/cso` (estático, 10 min, parcial): sin hallazgos en precios, `get_order_summary`, grants de las RPC y workflows; quedaron sin cubrir secretos del historial, dependencias y headers (scanners solo en Linux/macOS). `/review`: 7 revisores más red team; arreglados la validación de `SITE_HOSTNAMES` con freno en el build, los headers (decisión 88), las mayúsculas del hostname, la URL de Supabase con query y la documentación de los previews.

**Parte B — cierre (2026-10-10):** PR #10 mergeado (`6069326`) y deploy de producción publicado: pasó el freno del build (decisión 87) y sirve los headers de la decisión 88 (`X-Frame-Options: DENY`, `frame-ancestors 'none'`, `Referrer-Policy`; HSTS y `nosniff` los agrega Netlify). Compra real `FAL-0003` en `falber.com.ar`: pasó Turnstile con el secreto real y el token atado a la acción y al dominio; cancelada desde el admin, el stock volvió (`sale -1`, `order_cancelled +1`). Falta solo el catálogo real (fotos y hero incluidos) antes de difundir el dominio.

**Lecciones de la parte B:**
- `NEXT_PUBLIC_SUPABASE_URL` es la URL base, sin path: con `/rest/v1` el build falla con "Invalid path specified in request URL", que no dice qué variable revisar. Ahora `supabaseUrl()` la valida y nombra la variable (`src/lib/supabase/env.test.ts`).
- El primer build con la base vacía dejó `/carrito` y `/checkout` prerenderizados sin productos hasta que se regeneraron. Cargar el catálogo antes del primer deploy, o redeployar después de cargarlo.
- El widget de Turnstile valida el hostname: el de Netlify (`*.netlify.app`) tiene que estar en la lista además del dominio propio, o el login falla antes de conectar el dominio.
- Después de cambiar algo en el dashboard de Supabase, recargar y verificar: el switch del registro público apareció prendido después de apagarlo.
- Con CAPTCHA activo en Auth, un signup sin token devuelve `captcha_failed` antes de mirar si el registro está abierto: esa llamada no prueba que esté cerrado. El registro cerrado se verifica en el dashboard (recargando).
- El equipo de Netlify tenía la visibilidad por defecto en privada: el sitio respondía 401 ("Login Redirect" a `app.netlify.com/edge-access`) a todos menos a quien estaba logueado en Netlify, y por eso las pruebas desde el celular pasaron. Probar siempre desde una sesión anónima (o con `fetch` desde fuera). Quedó Private + "Previews only": los previews usan las mismas variables que producción, o sea la base real, y abiertos dejarían crear pedidos con código sin revisar.
- Netlify emite el certificado unos minutos después de que el DNS apunta al dominio. El navegador que entró antes reutiliza la conexión con el certificado anterior y sigue mostrando "No seguro" aunque el sitio ya esté bien (en InPrivate se ve el candado). Esperar a que Netlify muestre el certificado emitido (Domain management → HTTPS) y, si pasó, cerrar el navegador del todo (Edge sigue en segundo plano por el "Aumento de inicio").

### Fase 7 — Admin de catálogo (plan en `feat/admin-catalog`, 2026-10-10)

Cargar productos, fotos, presentaciones y stock desde el panel, sin Studio. Es lo último que falta para difundir el dominio (Fase 6, parte B). Decisiones en la sección 3.O (91 a 102). Tres PRs, el riesgo primero:

**PR 1 — Storage local y migración `0003`.**
1. **Storage local (hecho, 2026-10-11).** El CLI 2.120.0 lo arregla: se probó primero en un proyecto descartable (otro `project_id` y otros puertos, sin tocar el stack real) y después en el repo. Lockfile regenerado con `node:24` en Docker (solo cambian los paquetes del CLI). Con el 2.120.0, las tablas de Storage existen antes de las migraciones: **la `0001` crea en local el bucket y sus 3 policies**, así que no hace falta repetirlas en el seed. Verificado: bucket público con 5 MiB y `image/webp`/`image/jpeg`, 8 fotos del seed subidas, URL pública `200`, URL firmada + `PUT` `200` y un PNG rechazado con `415 invalid_mime_type`.
   - **Storage en el CI** (`/plan-eng-review`): `db:start:lite` ya no excluye `storage-api`; el CI usa el mismo script.
   - **Las fotos salen siempre del bucket** (`/plan-eng-review`): `objects_path = "../public/product-images"` sube las fotos del seed al arrancar. Se sacó `NEXT_PUBLIC_PRODUCT_IMAGES_BASE_URL` (código, `.env.example` y CI). Next 16 no optimiza imágenes de IPs locales (SSRF): `images.dangerouslyAllowLocalIP` se activa solo si `NEXT_PUBLIC_SUPABASE_URL` es local (`isLocalSupabaseUrl`), y `assertProductionEnv` frena el build de producción con una URL local.
2. **`0003_catalog_admin.sql` (hecho, 2026-10-11).** Default `inactive` (91); `PRODUCT_NOT_PUBLISHABLE` con `detail` `image` o `variant` (93, D7); `SLUG_LOCKED` (94); `revoke delete` (95); `revoke update (variant_type, size_ml)` (98); `revoke truncate` en todas las tablas y en las futuras (`alter default privileges`; cierra el TODO); límites del bucket si existe (97). El seed publica al final, con foto y presentaciones. `schema.test.cjs` aplica `0001` + `0003` como en producción y suma la sección `[14]`, más el contrato del seed sobre una base nueva: 198 tests, ninguna aserción anterior cambió (D8). Cada regla se validó con una mutación (8 de 8 atrapadas). Aplicada al Supabase local con `migration up` y verificada con Storage real. Los mensajes en castellano van con el panel (PR 2 y 3).
3. **`supabase db push` en la nube (hecho, 2026-10-11).** Verificado con SQL de solo lectura: migraciones `0001`, `0002` y `0003` aplicadas; los 2 productos publicados tienen foto; bucket con 5 MiB y `image/webp`/`image/jpeg`; `authenticated` sin `TRUNCATE` ni `DELETE`.

**PR 2 — Productos.** Pestaña "Productos", lista con el alta corta (con `slugify` y el slug a la vista), página del producto con edición de datos y destacado, foto (URL firmada, achicado en el navegador, borrado de la anterior).

**PR 3 — Presentaciones, stock y publicar.** Agregar presentación (decant 3/5/10 o frasco con ml, precio, stock inicial opcional), editar precio y disponible, movimientos de stock con nota e historial, publicar y ocultar (la regla de la 93 necesita presentaciones).

**Notas de implementación** (`/plan-eng-review`): `mapDbError` mapea solo nuestros códigos (el `message` del `raise`): un `23505` (slug o presentación repetidos) o un `23514` (stock que quedaría negativo) se mapean antes por `code` y nombre del constraint. El parseo de pesos de `parseShippingCost` se extrae con el tope como parámetro (costo de envío, estimados y precio). `slugify` reusa `normalizeText` de `src/lib/catalog/catalog.ts`.

**Interfaz** (`/plan-design-review`, 2026-10-11; tema Platinum, tokens de `DESIGN.md`, sin cards):

```
/admin/productos                              /admin/productos/[id]   (una columna, max-w-3xl)
------------------------------------          ------------------------------------------------
PRODUCTOS (h1)                                VOLVER A PRODUCTOS
Destacados: 5. La home muestra: A, B, C       DIOR · SAUVAGE EDT  [NO PUBLICADO]
[NUEVO PRODUCTO] -> despliega el alta         Para publicar falta: foto · una presentación
NO PUBLICADOS                                 [PUBLICAR]        (o "Publicado." + VER EN LA TIENDA)
  [img] Marca · Nombre [NO PUBLICADO]         ── FOTO ─────────────────────────────────────
        Falta foto · Decant 5 ml · 3 u.       [vista Noir 4:5]  estado / ELEGIR FOTO
PUBLICADOS                                    ── PRESENTACIONES Y STOCK ───────────────────
  [img] Marca · Nombre [PUBLICADO]            Decant 5 ml   $ 12.000   8 u.   EDITAR · MOVER STOCK
        Frasco 100 ml · agotado · Destacado     > Historial (últimos 5)
                                              AGREGAR PRESENTACIÓN (queda abierto)
                                              ── DATOS ────────────────────────────────────
                                              marca, nombre, género, descripción, destacado
```

- **Ficha (D3, D16):** header con `h1` (marca · nombre), `StatusBadge`, la lista "Para publicar falta: foto · una presentación disponible" (texto, se vacía al completar) y Publicar u Ocultar. Debajo, `FOTO`, `PRESENTACIONES Y STOCK` y `DATOS`, cada una `<section aria-labelledby>` con su `h2` y `border-t`, como `pedidos/[id]`. Una columna en todos los tamaños; en `md+` la foto (240 px) va al costado de su estado dentro de su sección.
- **Lista (D4, D5, D18):** filas con divisor como `AdminRequestList`; la fila entera es un link de al menos 44 px. Grupos `NO PUBLICADOS` y `PUBLICADOS`, cada uno por marca y nombre. Miniatura de 48 px (sin foto: recuadro `bg-surface-overlay` con "Sin foto"; `alt=""`). Badge "No publicado" con tono `action` y "Publicado" con tono `active`. Debajo, en `text-muted`: faltantes ("Falta foto · Falta presentación"), presentaciones con stock ("Decant 5 ml · 3 u.", "Frasco 100 ml · agotado") y "Destacado", todo en texto. Arriba: "Destacados: N. La home muestra: …", calculado con `featuredProducts`. El alta se despliega con `NUEVO PRODUCTO` (abierta de entrada solo con la lista vacía); el slug va como `Input` de solo lectura con "El link queda fijo: /producto/<slug>"; el slug repetido se marca en Nombre.
- **Foto (D6, D13, D15):** vista previa con `ProductImage` dentro de `data-theme="dark"`, idéntica a la tienda. Estados: sin foto (recuadro 4:5 y `ELEGIR FOTO`), vista previa local con "Preparando foto" y "Subiendo" (`role="status"`, input deshabilitado), "Foto guardada", y error en `error` diciendo qué falló, con `REINTENTAR` (mismo archivo) y la foto anterior todavía visible. `<input type="file" accept="image/*">` sin `capture`, con un `<label>` real de 44 px. Decodificar con `createImageBitmap(file, { imageOrientation: "from-image" })`; test E2E con una foto de fixture con EXIF de orientación 6; foto ilegible: "No se pudo leer la foto. Probá con otra o sacala de nuevo."
- **Presentaciones (D8, D10):** filas con divisor: etiqueta en `h3`, precio y stock grande ("8 u." o "Agotado"). `EDITAR` (precio y Disponible) y `MOVER STOCK` despliegan su formulario debajo, de a uno por vez. Historial en `<details>` con los últimos 5. Las no disponibles van al final en `text-muted`. "Agregar presentación": radios Decant / Frasco; decant con `Select` 3/5/10 ml y los existentes deshabilitados ("5 ml (ya está)"); frasco con los ml a mano; precio y stock inicial; hint fijo "El tipo y los ml no se cambian después." Después de guardar queda abierto, preselecciona el próximo tamaño libre y el foco vuelve a Precio. Fallo parcial (decisión 100) con `role="alert"`: "Se creó Decant 5 ml pero no se cargó el stock inicial. Cargalo con Mover stock."
- **Movimientos (D11):** Stock inicial, Reposición, Ajuste: sumar o restar, Dañado o derramado, Venta y Devuelto por cancelación (estos dos con link al pedido). Signo (+3 / −1) con números tabulares, fecha con `formatDateTime` y nota. "Mover stock" muestra "Queda en N u." en vivo y avisa antes de enviar: "No hay tanto stock para descontar".
- **Publicar y ocultar (D9):** Publicar es primario; al salir bien: "Publicado." y `VER EN LA TIENDA` (`/producto/<slug>`, pestaña nueva). Ocultar es secundario, con confirmación en dos pasos como `OrderStatusForm`: "Ocultar saca el perfume de la tienda ahora. Quien lo tenga en el carrito no va a poder comprarlo."
- **Datos (D12):** marca, nombre (hint "El link no cambia: /producto/<slug>"), género (`Select` con "Sin género"), descripción y destacado (hint "La home muestra hasta 3 destacados con stock."). Componentes nuevos en `src/components/ui/`: `Textarea` y `Checkbox`, con el contrato de `Input` (label arriba en mayúsculas, hint y error abajo, `aria-invalid`, foco en `accent`, 44 px táctiles). Se suman a `DESIGN.md` → Componentes base.
- **Estados (D7):** esqueletos con `Suspense` (`bg-surface-overlay`), `notFound()` para un id inexistente, botones en gerundio y deshabilitados ("Guardando", "Subiendo", "Publicando", "Creando") y éxito con `role="status"` junto al botón. Lista vacía: "Todavía no hay productos. Cargá el primero con NUEVO PRODUCTO." Sin presentaciones: "Sin presentaciones. Agregá la primera abajo."
- **Navegación (D14):** los links pasan a `flex-wrap` (`gap-x-6 gap-y-2`) con `Salir` fijo a la derecha; orden Pedidos, Encargos, Productos, Envíos. E2E en el proyecto mobile: `/admin` sin scroll horizontal.
- **Accesibilidad (D17):** secciones con `aria-labelledby`, desplegables con `<details>`/`<summary>` o `aria-expanded`, foco al `h1` después del alta, `focusFirstInvalid` en cada formulario, `aria-describedby` de Publicar a la lista de faltantes, 44 px mínimo en todo control.

**Tests.** Esquema: cada regla de `0003`, también desde el rol de Studio. Vitest: `slugify` contra el `check` del slug, parser de precio, signo por tipo de movimiento, nombre de la foto, cada acción (`requireAdminAction` primero, 0 filas, errores de la base, `updateTag`) y los formularios. E2E: un admin crea un producto, le sube la foto, le agrega una presentación con stock, lo publica y aparece en la tienda con su foto; ocultarlo lo saca (con el caché caliente antes, como `e2e/shipping.spec.ts`); publicar sin foto muestra el mensaje. **Contrato de regresión** (`/plan-eng-review`): el seed deja el mismo catálogo (los 8 productos activos con su foto, `producto-oculto` inactivo; los publica al final con un `update`), y `test:db`, `npm test` y `test:e2e` pasan sin cambiar ninguna aserción existente: solo cambian los inserts de los fixtures que necesitan productos activos.

**Al cerrar:** el dueño carga el catálogo real, se revisa el Dior Sauvage activo en producción, se reemplaza el hero (`public/brand/hero-placeholder.webp`) y se tilda el último ítem de la sección 11.

### Flujo completo

```
Fase 1 base + DS ─► Fase 2 tienda (taste-skill) ─► Fase 3 checkout (TDD) ─► Fase 4 encargos
       ─► Fase 5 admin pedidos ─► Fase 6 operación + /design-review /qa /cso /review ─► lanzamiento
       ─► Fase 7 admin de catálogo ─► difusión del dominio
```

---

## 9. Plan de tests

| Capa | Herramienta | Qué cubre |
|---|---|---|
| Base de datos | `schema.test.cjs` (PGlite) | Todas las reglas de la sección 7, el flujo de `create_order` y los tres caminos de Storage (decisión 22) |
| Lógica y componentes | Vitest | Fase 1 y 2: tokens vs `falber-tokens.json`, contrato de `Button`/`Input`/`Select`, `required()` de env, reglas del catálogo, mapeo de filas, URL de fotos y `formatARS`. Fase 3: `phone.ts` (formatos reales e inválidos), `cart.ts` y el store de `localStorage` (límites, datos rotos, otra pestaña, sin `localStorage`), `resolveCart`, `order-errors.ts` (un mensaje por cada código de la migración), schema del checkout, Turnstile y hash de IP (`fetch` inyectado), la Server Action (RPC, `headers` y `next/cache` mockeados), `whatsapp.ts`, `get_order_summary` (parser y consulta) y los componentes `AddToCart`, `CartView`, `CartLink`, `CheckoutForm` y `OrderDetails`. Fase 4: `db-errors.ts`, `requests/errors.ts` (un mensaje por cada código de `create_perfume_request`), schema y precarga de encargos (slug activo, inexistente, inactivo, repetido), `verifyHumanRequest`, `form-data.ts`, la acción `createPerfumeRequest` y los componentes `TurnstileField`, `PerfumeRequestForm` y `Select` con error. Fase 5: `nextOrderStatuses` (contra el fixture de `test:db`), orden y aviso de la lista, `canSetShippingCost` y `parseShippingCost`, `requireAdmin`/`getAdminStatus`, la regla del proxy, el login (schema y acciones `signIn`/`signOut`), las acciones `updateOrderStatus` y `setShippingCost` (`requireAdmin` primero, `refresh`, `updateTag` solo al cancelar), `formatDateTime`, el guard de `scripts/local-users.ts` y los componentes `LoginForm`, `AdminOrderList`, `AdminOrderDetail`, `OrderStatusForm` (decisión 48) y `ShippingCostForm`. Del `/review`: compare-and-set del estado (`fromStatus`, 0 filas = cambió), lista con todos los activos y el aviso del corte, `signOut` local y `firstFieldErrors`. Fase 6 (A): `sessionCookieOptions`, `getAdminStatus` con fallos de Auth (red, 5xx, sesión revocada, con las clases de auth-js), `requireAdminAction`, las acciones del detalle con el acceso sin verificar y las ramas negativas de `setShippingCost`, `captchaToken` y `captcha_failed` en el login, `LoginForm` con Turnstile, `loggableDbError` (sin `details` en los logs de las tres acciones), `focusFirstInvalid` y el foco en `CheckoutForm` y `PerfumeRequestForm`. En el esquema: un no-admin no actualiza pedidos, `SHIPPING_COST_LOCKED` en `completed`, costo y despacho en el mismo update, `(select is_admin())` en todas las policies y `DELIVERY_DATA_TOO_LONG` con el check de la tabla. Envíos estimados (3.L): `toShippingRates` y `shippingEstimateLines`, `getShippingRatesOrNull` (si falla, null y log), `parseShippingEstimates`, la acción `updateShippingEstimates` (acceso, validación, 0 filas, error de la base, `updateTag`), `ShippingEstimatesForm` y el texto de `CheckoutForm` con y sin estimados; en el esquema, `shipping_rates` (lectura pública, solo el admin la cambia, topes, sin filas nuevas ni borrado) |
| Flujos | Playwright | Smoke (tema Noir, `es-AR`, sin desborde, el header entra en pantalla), catálogo (home → destacado → detalle, filtros por URL, búsqueda sin tildes, estado vacío, agotado, inexistente/inactivo) y compra (`e2e/checkout.spec.ts`: producto → carrito → checkout → pedido con el mensaje exacto de `wa.me`, doble click = una sola Server Action, envío sin dirección rechazado por el servidor, variante inexistente frena la compra) y encargos (`e2e/requests.spec.ts`: desde un producto agotado con el perfume precargado, encargo libre, error del servidor que conserva lo escrito, slug inexistente o inactivo) y envíos estimados (`e2e/shipping.spec.ts`: el admin los cambia y el checkout los muestra; solo desktop) y admin (`e2e/admin.spec.ts`: `/admin` sin sesión va al login, una cuenta no admin ve "sin acceso" y no ve pedidos, un admin con sesión que abre el login va a los pedidos, un admin confirma un pedido de envío y le carga el costo, y su cookie de sesión es `httpOnly`; el login pasa por Turnstile y el CAPTCHA de Auth; usuarios y pedidos nuevos por test con `e2e/admin-helpers.ts`) |

Las tres capas corren en el CI en cada PR (decisión 24): `npm run test:db`, `npm test` y `npm run test:e2e`.

Casos de borde que hay que cubrir sí o sí: doble click en "Realizar compra", carrito con un producto que ya no existe o está inactivo, sin stock al confirmar, efectivo + envío. Los cuatro están cubiertos desde la Fase 3: doble click (E2E + idempotencia en el esquema), producto inexistente (E2E + `CartView`), sin stock (esquema + Server Action + `CheckoutForm` marca el producto) y efectivo + envío (schema del checkout, la UI lo deshabilita y la base lo rechaza).

---

## 10. Fuera del MVP

| Funcionalidad | Señal para agregarla |
|---|---|
| Stock calculado desde Decant Manager | Sobreventa o más de ~30 perfumes (TODOS.md) |
| Logo vectorial | Cuando lo tenga diseño (TODOS.md) |
| Mercado Pago | Muchos pedidos se caen en la transferencia |
| Cuentas, favoritos, reviews, cupones | Clientes recurrentes que lo pidan |
| WhatsApp Business API | Volumen que no podés atender a mano |
| Varios admins | Sumás a alguien al negocio |

---

## 11. Checklist antes de publicar

- [x] Todos los tests pasan: esquema, Vitest y Playwright.
- [x] Migraciones probadas una vez contra `supabase start`.
- [x] La `service_role key` no aparece en el cliente ni con `NEXT_PUBLIC_`.
- [x] Cada acción del admin empieza con `requireAdmin()`.
- [x] Turnstile activo en checkout y encargos, con claves reales (no las de prueba de `.env.example`), widget en modo invisible.
- [x] Variables de Netlify cargadas (lista en `.env.example`), entre ellas `NEXT_PUBLIC_WHATSAPP_NUMBER` (5492355481449) e `IP_HASH_SECRET` (generado, 32 caracteres o más). Sin la del WhatsApp, `/pedido/[id]` falla al cargar. `SITE_HOSTNAMES` = `falber.com.ar,falber.netlify.app` (decisión 87): sin ella, el checkout y los encargos fallan cerrado.
- [x] En Netlify llega `x-nf-client-connection-ip` (un pedido de prueba deja una fila en `rate_limit_events` con una clave distinta de la de `"unknown"`).
- [x] Supabase → Authentication → Sign In / Providers: "Allow new users to sign up" **apagado** y el proveedor **Email habilitado** (si se apaga Email, el admin no puede entrar; decisión 61). Admin creado a mano: Authentication → Add user + su fila en `profiles` (nota al final de `0001`).
- [x] Supabase → Authentication → Attack Protection: CAPTCHA con Turnstile y el **secreto real** (decisión 75). Sin esto el login funciona pero queda sin CAPTCHA; con el secreto de prueba, cualquier token pasa. En Cloudflare, el dominio de producción en el widget. Verificar con una llamada directa a `/auth/v1/token?grant_type=password` sin token: tiene que responder `captcha_failed`.
- [ ] **Nunca `supabase config push` contra producción:** subiría `supabase/config.toml`, que tiene el secreto de prueba del CAPTCHA (cualquier token pasaría) y la configuración local de Auth. La nube se configura solo desde el dashboard.
- [x] Login del admin en producción: entra a `/admin/pedidos`; otra cuenta sin perfil ve "sin acceso". En DevTools → Application → Cookies, las `sb-…` son `HttpOnly` y `Secure`. Verificado 2026-10-10: la cookie de sesión es `HttpOnly`, `Secure` y `SameSite=Lax`; la cuenta de prueba sin perfil se borró. El error de CSP por `eval` que muestra DevTools viene del iframe de Turnstile (nuestra CSP es solo `frame-ancestors`).
- [x] Pedido de prueba completo en el celular: WhatsApp abre con el mensaje correcto.
- [x] Doble click en "Realizar compra" crea un solo pedido. Verificado 2026-10-10 en producción (pedido cancelado después).
- [x] Cancelar un pedido devuelve el stock y la tienda lo muestra.
- [x] pg_cron activo (`select * from cron.job`).
- [x] Bucket `product-images` y sus 3 policies creados (`select * from storage.buckets`; `select policyname from pg_policies where schemaname = 'storage'`). Si las tablas de Storage no existieran al migrar, `0001` falla con `STORAGE_TABLES_MISSING` (solo en local, con el rol `falber_local_dev` de `supabase/roles.sql`, se omite con un NOTICE).
- [x] GitHub Action de keepalive + backup corriendo: secretos, `KEEPALIVE_ENABLED` y `BACKUP_ENABLED` cargados (Fase 6 → Backups), una corrida a mano en verde, y el artefacto descargado se descifra con la passphrase.
- [x] Deploy en Netlify (no Vercel Hobby: prohíbe uso comercial).
- [x] `https://falber.com.ar` responde con HTTPS válido y la variante sin elegir (con o sin `www`) redirige a la canónica. Site URL de Supabase y hostname del widget de Turnstile con `falber.com.ar` (Fase 6 → Dominio).
- [ ] Catálogo y fotos reales cargados antes de difundir el dominio (nada del seed de prueba en producción).
- [x] Prueba en iPhone y Android; aviso de datos personales en el checkout. Verificado 2026-10-10: compra completa en los dos, con retiro y con envío; los pedidos de prueba se cancelaron.

---

## Anexo — Correr los tests del esquema

```bash
npm run test:db
```

**Huecos en la numeración:** un pedido rechazado consume un número de la secuencia. Que exista `FAL-0003` y después `FAL-0005` es normal.

---

## NOT in scope (revisión de ingeniería)

- **Admin de productos y stock:** se opera en Studio; las protecciones de la DB valen ahí (decisión 10). Los encargos tienen su pestaña en el panel (decisión 90).
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
| Catálogo | Stock viejo en caché | Sí (Server Action: llama a `updateTag('catalog')`) | `updateTag` (decisión 34) | — |
| Checkout | Cloudflare caído o lento | Sí (Vitest) | Falla cerrado, timeout de 5 s | "No pudimos verificar tu navegador…" |
| Checkout | Turnstile sin token todavía (los primeros segundos) | Sí (E2E espera el token) | El servidor rechaza y el widget se resetea | Mismo mensaje; reintentar funciona |
| Carrito | `localStorage` roto, editado o bloqueado | Sí (Vitest) | `parseCart` descarta lo inválido; respaldo en memoria | Carrito vacío o sin la línea rota |
| Carrito | Precio inyectado en `localStorage` | Sí (Vitest) | El carrito no guarda precios; los pone el catálogo y `create_order` | — |
| Admin | Acción sin sesión | Sí (Vitest: la acción no escribe; E2E: `/admin` → login) | `requireAdmin()` + RLS | Redirige a login |
| Admin | Cuenta logueada sin perfil de admin | Sí (E2E + esquema) | `getAdminStatus()` + RLS | "Sin acceso" con "Salir" |
| Admin | El pedido cambió mientras se miraba (otra pestaña, pg_cron) | Sí (Vitest) | Compare-and-set del estado (decisión 67); la base rechaza (`INVALID_STATUS_TRANSITION`, `SHIPPING_COST_LOCKED`) | "Recargá la página…" |
| Admin | Proveedor de email apagado en Auth | Sí (E2E: el login del admin) | Decisión 61 | Mensaje genérico + log `email_provider_disabled` |
| Supabase Free | Pausa tras 7 días sin uso | Manual | Keepalive diario | **Silencioso sin el keepalive** |
| `/pedido/[id]` | ID adivinado | Sí (esquema) | UUID + resumen sin datos sensibles | — |
| `/pedido/[id]` | ID que no es UUID (ej. `FAL-0002`) | Sí (Vitest) | Se valida antes de consultar | "No encontramos esta página" |

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
