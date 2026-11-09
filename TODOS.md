# TODOS

## Admin

### Ranking de encargos en el admin

**What:** Mostrar en `/admin/encargos` el ranking de perfumes más pedidos (`perfume_requests_ranking`), arriba de la lista que ya existe (decisión 90).

**Why:** Es lo que quedó afuera del admin de catálogo (Fase 7, PR #15 a #17). Sirve para decidir qué frascos comprar según lo que piden los clientes; hoy se mira en Supabase Studio.

**Context:** La vista ya existe en la base. Lectura con la sesión del usuario (nunca `service_role`) y `requireAdmin()` en la página, tema Platinum. Señal: cuando haya suficientes encargos como para que contarlos a mano lleve tiempo, o el dueño pregunte qué es lo más pedido.

**Effort:** S
**Priority:** P3
**Depends on:** —

## Inventario

### Stock de decants calculado desde Decant Manager

**What:** Que la web calcule cuántos decants de cada tamaño puede vender a partir de los ml que Decant Manager sabe que quedan en cada frasco.

**Why:** El decant de 5 ml, el de 10 ml y el frasco completo de un perfume salen del mismo frasco físico. Con stock en unidades separadas se puede sobrevender. Ejemplo: un frasco de 100 ml cargado como "10 decants de 5 ml" y "5 de 10 ml"; si se venden 6 de 10 ml, quedan 40 ml, pero la web sigue ofreciendo 50 ml en decants de 5.

**Context:** Decisión A del documento maestro: en el MVP el stock se carga a mano y con cuidado. Decant Manager (app Python/CustomTkinter/SQLite, con FIFO y montos Decimal guardados como TEXT) ya modela frascos y ml. El camino natural: exportar o sincronizar desde Decant Manager movimientos `adjustment` en `stock_movements`, nunca editar `stock` directo. No duplicar la lógica de ml en la web. Señal: más de ~30 perfumes o una primera sobreventa.

**Effort:** L
**Priority:** P3
**Depends on:** Catálogo cargado y en uso.

## Desarrollo local

### Vulnerabilidades de `npm audit`

**What:** Las 5 vulnerabilidades altas de `npm audit` son una sola cadena del linter: `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob@3.3.1` → `micromatch` → `braces@3.0.3` (agotamiento de la pila con patrones glob muy anidados). Actualizar cuando exista un arreglo.

**Why:** Revisado en la Fase 6 (2026-10-07): riesgo aceptado, sin cambios. `npm audit --omit=dev` da 0: nada llega al bundle ni al servidor. El ataque necesita controlar los patrones que recibe el linter, y salen de nuestra config (máquina local y CI). No hay arreglo: `braces@3.0.3` es la última versión y está en el rango vulnerable, `eslint-config-next@16.4.0` sigue fijando `fast-glob@3.3.1`, y un `overrides` no tiene a qué versión sana apuntar. `npm audit fix --force` propone bajar a `eslint-config-next@14`, incompatible con Next 16.

**Context:** Para revisar: `npm audit` y `npm ls braces`. Cualquier cambio en el lockfile se valida en Linux (memoria del proyecto: npm en Windows borra `@emnapi/*`). Señal: una versión nueva de `braces` fuera del rango, un `@next/eslint-plugin-next` sin `fast-glob`, o una vulnerabilidad nueva que aparezca con `--omit=dev`.

**Effort:** S
**Priority:** P3
**Depends on:** —

### Puerto ocupado en el runner de CI

**What:** Si el CI vuelve a fallar con `address already in use` en el puerto 54322, subir el rango de puertos efímeros del runner en `.github/workflows/ci.yml`, antes de `supabase start` (en los dos jobs): `sudo sysctl -w net.ipv4.ip_local_port_range="60000 65000"`.

**Why:** El CI de `main` después del merge de la Fase 4 falló una vez en E2E porque `supabase start` no pudo tomar el 54322: el kernel del runner ya lo había dado como puerto efímero a otra conexión. El reintento pasó con el mismo árbol (comparado con `git rev-parse <commit>^{tree}`), así que no fue el código. Con el rango efímero arriba de 60000, los puertos de Supabase (54321-54327) quedan afuera.

**Context:** No se cambió el CI por una sola falla (un cambio en el workflow sin un rojo reproducible no se puede verificar). Señal: una segunda falla con el mismo error.

**Effort:** S
**Priority:** P3
**Depends on:** —

## Legal

### Botón de arrepentimiento

**What:** Un acceso visible desde la home (el footer alcanza) para pedir la revocación de una compra, con el número de pedido. Lo más simple: un link a WhatsApp con el mensaje armado, como "Enviar por WhatsApp" de los encargos (decisión 89), o un formulario con su propia acción de Turnstile.

**Why:** La Resolución 424/2020 lo exige a las tiendas online, aparte de publicar la política (decisiones 126 a 128). Hoy el arrepentimiento solo se explica en `/cambios-y-devoluciones`.

**Context:** Confirmar con un abogado o contador el texto y si la revocación tiene que dejar constancia (un número o un mail de confirmación). Si es un formulario, reusar lo de `src/lib/forms/` y `TurnstileField`. Señal: antes de pautar o de crecer en ventas; hoy es un incumplimiento chico pero real.

**Effort:** S
**Priority:** P2
**Depends on:** —

## Anti-abuso

### Límite de encargos por número de WhatsApp

**What:** Un tope de encargos por `whatsapp` (ej. 3 por día) además del de 5 por hora por IP, dentro de `create_perfume_request` (otra llamada a `enforce_rate_limit` con la acción `perfume_request_whatsapp` y una clave derivada del número).

**Why:** El encargo se asocia al cliente que ya existe con ese número. Alguien que rote IPs y resuelva Turnstile puede hacer que FALBER le escriba una y otra vez a una persona que no pidió nada, con la marca como intermediaria. `/encargos` es más barato de abusar que el checkout: no reserva stock ni necesita carrito. Visto en el `/review` de la Fase 4.

**Context:** `rate_limit_events.action` tiene un `check (action in ('order', 'perfume_request'))`: hay que agregar la acción nueva. La clave no puede ser el número en crudo (es dato personal): HMAC con el mismo `IP_HASH_SECRET` desde el servidor, o `md5` en la base si alcanza. Test en `schema.test.cjs` y un mensaje en `REQUEST_ERRORS` si el código es nuevo.

**Riesgo mientras tanto (revisado el 2026-10-16, decisión de dejarlo para cuando escale):** bajo. Abusarlo exige rotar IPs (tope de 5 por hora por IP) y resolver Turnstile en cada envío, sin ganar nada. Un número que ya existe no pisa al cliente (`on conflict (whatsapp) do nothing`) y ningún WhatsApp sale solo: el dueño escribe a mano y puede frenar. Si pasa, se cierran esos encargos en `/admin/encargos`; no hay nada que limpiar en la base.

**Señal (cualquiera de las tres):** alguien responde que no pidió nada o llegan varios encargos seguidos del mismo número; antes de difundir fuerte (publicidad paga, un influencer); o el volumen de encargos crece al punto de que el dueño no los revisa uno por uno.

**Effort:** S (una sesión de 1 a 2 horas: `0007`, test, mensaje, docs y `db push`)
**Priority:** P2 (cuando aparezca la señal)
**Depends on:** —

### Medir los largos igual que Postgres

**What:** Que zod cuente caracteres como `length()` de Postgres (puntos de código, `[...value].length`) en vez de unidades UTF-16.

**Why:** Un nombre de un solo emoji pasa `min(2)` en zod y la base lo rechaza con `INVALID_NAME`: el cliente ve el mensaje general en vez del error en el campo. No corrompe datos.

**Context:** `src/lib/forms/fields.ts` (`fullNameField`, `optionalText`) y el `perfumeName` de `requests/schema.ts`. Un helper de largo compartido y tests con emojis. Señal: si aparece en los logs un `INVALID_NAME` que zod dejó pasar.

**Effort:** S
**Priority:** P3
**Depends on:** —

## Catálogo

### Hero con una foto propia de FALBER

**What:** Reemplazar `public/brand/hero.webp` (la foto oficial del Le Male Elixir, PR #19) por una foto propia: los decants de FALBER o varios frascos juntos, horizontal y de 2000 px de ancho o más.

**Why:** El hero es la cara de la marca: con la foto de un fabricante, la home parece de Jean Paul Gaultier. A 1000 px, además, se ve algo blanda en pantallas retina.

**Context:** El hero usa `object-contain`, así que sirve una foto con fondo transparente o carbón; con fondo opaco, revisar el recorte 4:3 de mobile. Cambiar también el `alt` en `src/app/(store)/page.tsx`. Señal: cuando haya una sesión de fotos de los productos de FALBER.

**Effort:** S
**Priority:** P3

### Limpiar fotos huérfanas del bucket

**What:** Un barrido que liste el bucket `product-images` y borre los objetos que ningún `products.image_path` referencia y que tengan más de un día (una acción del admin o un job programado).

**Why:** Una subida que llega al bucket pero no se guarda en el producto deja la foto huérfana: el `PUT` sale bien y se pierde la respuesta, el admin cierra la pestaña entre subir y guardar, o se corta la red antes de `savePhoto`. Cambiar de foto ya borra la anterior (decisión 96) y dos pestañas no se pisan (compare-and-set, decisión 107), pero estos casos no tienen quién los limpie.

**Context:** El admin ya puede listar y borrar en el bucket (`0004`). Borrar solo lo no referenciado y viejo, para no tocar una subida en curso. Hallazgo del Red Team en el `/ship` del PR 2 de la Fase 7. Desde el PR 3, Reintentar ya no sube de nuevo (decisión 121), así que la fuente principal de huérfanas está cortada; quedan las subidas abandonadas. Va en su propio PR, con su E2E: un error en el filtro deja productos publicados sin foto. Señal: el bucket tiene notablemente más objetos que productos con foto.

**Priority:** P3

### Varias fotos por producto

**What:** Más de una foto por producto (frasco, caja, otro ángulo): tabla `product_images` (`product_id`, `path`, `position`), una migración que pase `products.image_path` a la primera foto, subida y orden desde `/admin/productos/[id]` y galería en la ficha.

**Why:** La Fase 7 deja una sola foto (decisión 96) porque la base tiene un solo `image_path` y alcanza para vender. Anotado para que no se resuelva con un `image_path_2` a mano.

**Context:** La subida ya existe (URL firmada, achicado en el navegador, nombre único, validación de la ruta: decisiones 96 y 97); se reusa por foto. La regla de publicar (decisión 93) pasaría a "al menos una foto". Señal: el dueño pide mostrar más de una foto por producto.

**Effort:** M
**Priority:** P3
**Depends on:** Fase 7 mergeada.

### Datos estructurados `Product` en la ficha

**What:** JSON-LD `Product` en `/producto/[slug]`, con un `offer` por presentación (precio en ARS y disponibilidad), armado desde las mismas reglas que el feed de Merchant Center (`src/lib/seo/merchant-feed.ts`).

**Why:** El feed (decisiones 122 a 125) manda un precio por presentación, pero la ficha muestra todas juntas. Merchant Center puede marcar "precio no coincide" y suspender ítems. Además ayuda a los resultados enriquecidos de Google.

**Context:** Reusar `merchantItems()` para que ficha y feed no se contradigan. Señal: un aviso de precio o de disponibilidad en el Diagnóstico de Merchant Center, o el siguiente trabajo de SEO.

**Effort:** S
**Priority:** P2
**Depends on:** —

## Design system

### Sincronizar el artifact con los cambios hechos en el código

**What:** Copiar al design system "FALBER" en Claude Artifacts (https://claude.ai/artifact/8MRV6N7UQkE1uDYGWUBB9j) cinco cambios que hoy solo existen en el repo:
1. El token `error`: Noir `#e5867d`, Platinum `#a8332b`, con su regla de uso (`design/falber-tokens.json` → `color.tokens`).
2. El estilo `wordmark` con `clamp()`: 28 px en mobile y 40 px en desktop, tracking 0.4em (`src/app/globals.css`).
3. `Input` de solo lectura: fondo `surface-raised`, borde `border`, texto `text-secondary` (Fase 4).
4. `Select` con mensaje de error, igual que `Input` (Fase 4).
5. El estado del pedido del admin en tres luminosidades (`OrderStatusBadge`: relleno `accent` = pendiente, borde `border-strong` = en curso, borde `border` y texto `text-muted` = cerrado), en Platinum (Fase 5, decisión 66).

**Why:** El artifact es la fuente de verdad y la sincronización es manual, en un solo sentido (artifact → repo, DESIGN.md). Si se re-sincroniza sin estos cambios, el token `error` desaparece del JSON y `tokens.test.ts` falla; el `clamp()` del wordmark y los estados de los controles se perderían en silencio.

**Context:** Los cambios están documentados en DESIGN.md (tabla de color, "Regla del error", la nota de mobile en Tipografía y la tabla de Componentes base). Al terminar, verificar con `npm test` que `tokens.test.ts` siga en verde.

**Effort:** S
**Priority:** P2 (antes de la próxima sincronización del design system)
**Depends on:** None

## Marca

### Logo y monograma de FALBER en vectorial (SVG)

**What:** Versión vectorial del lockup y del monograma, incluida una variante para fondo claro.

**Why:** El design system solo trae JPG grandes (1,3 a 2,2 MB) con textura metálica sobre negro. No sirven para un favicon nítido, fondos claros ni impresión, y por eso el header usa la tipografía `wordmark` en lugar del logo.

**Context:** Es trabajo de diseño (Facundo o un diseñador), no de código. Cuando exista, se sube al grupo `Logos` del design system en Artifacts y se actualizan `DESIGN.md`, el favicon y el header.

**Effort:** M
**Priority:** P3
**Depends on:** None

## Completed

Hechos en la Fase 7 y el lanzamiento (2026-10-16).

### Admin de productos y stock

Lista, alta, foto, datos, presentaciones, movimientos de stock con historial y publicar u ocultar en `/admin/productos` (PR #15 a #17, decisiones 91 a 121). Queda el ranking de encargos, arriba.

### Reemplazar las fotos placeholder por fotos reales

El catálogo real está cargado desde el admin, con foto en cada producto publicado, y el hero muestra el Le Male Elixir (PR #19). La foto propia del hero sigue arriba.

### robots.txt y sitemap.xml

`src/app/robots.ts` y `src/app/sitemap.ts`, con las reglas puras y sus tests en `src/lib/seo/`.

### Política de cambios y devoluciones

`/cambios-y-devoluciones` (decisiones 126 a 128), enlazada en el footer y cargada en Merchant Center. Queda el botón de arrepentimiento, arriba.

### Feed de Google Merchant Center

`/merchant-feed.xml` (PR #22, decisiones 122 a 125), cargado en Merchant Center desde "Añadir productos desde un archivo".

Hechos en la Fase 6, parte A (`feat/launch-hardening`, 2026-10-07). El detalle está en el documento maestro, sección 3.K.

### Endurecer la sesión del admin

Cookies `httpOnly` y `secure` (decisión 73), fallos de red de Auth en `getAdminStatus` sin dejar afuera una sesión revocada (decisión 72), `requireAdminAction` en las acciones con formulario (decisión 71), `(select is_admin())` en las policies (decisión 74) y los tests propuestos.

### CAPTCHA en el login del admin

CAPTCHA nativo de Supabase Auth con `TurnstileField` (decisión 75). En la nube falta activarlo con el secreto real (checklist de la sección 11).

### Largos máximos de los datos de envío en la base

`DELIVERY_DATA_TOO_LONG` en `create_order` y el check `delivery_lengths` (decisión 77).

### Llevar el foco al primer campo con error

`useFocusFirstInvalid` en checkout y encargos (decisión 79).

### No loguear el error completo de la base

`loggableDbError` en checkout, encargos y las acciones del admin (decisión 78).

### Reintento de un pedido justo en el límite por IP

**What:** En `create_order`, volver a buscar el `request_id` después de tomar el lock de `enforce_rate_limit`, antes de contar.

**Why:** Con el advisory lock (decisión 52), dos envíos simultáneos con el mismo `request_id` se serializan: si el primero era el 5º de la hora, el segundo recibe `RATE_LIMITED` en vez del pedido existente. Caso límite (el botón ya se deshabilita al enviar). Visto en el re-chequeo del `/review` de la Fase 4.

**Effort:** S
**Priority:** P3
**Depends on:** —
