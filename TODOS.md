# TODOS

## Admin

### Admin de productos, stock y encargos

**What:** Interfaz en `/admin` para crear y editar productos y variantes (con subida de fotos), cargar movimientos de stock y gestionar encargos con el ranking.

**Why:** En el MVP esto se opera desde Supabase Studio (decisión 10 de la revisión). Sirve para arrancar, pero cargar productos con fotos ahí es incómodo y lento.

**Context:** Las tablas, funciones, permisos y protecciones ya existen y valen también en Studio (la columna `stock` no se edita a mano, el historial no se borra). Falta solo la UI con tema Platinum, `requireAdmin()` en cada acción, sesión del usuario (nunca `service_role`) y `updateTag('catalog')` al guardar (decisión 34). Señal para hacerlo: cuando cargar o editar productos te lleve más de 10 minutos por semana.

**Effort:** M
**Priority:** P2
**Depends on:** Fase 5 (admin de pedidos), que deja armados el login, el layout y `requireAdmin()`.

## Inventario

### Stock de decants calculado desde Decant Manager

**What:** Que la web calcule cuántos decants de cada tamaño puede vender a partir de los ml que Decant Manager sabe que quedan en cada frasco.

**Why:** El decant de 5 ml, el de 10 ml y el frasco completo de un perfume salen del mismo frasco físico. Con stock en unidades separadas se puede sobrevender. Ejemplo: un frasco de 100 ml cargado como "10 decants de 5 ml" y "5 de 10 ml"; si se venden 6 de 10 ml, quedan 40 ml, pero la web sigue ofreciendo 50 ml en decants de 5.

**Context:** Decisión A del documento maestro: en el MVP el stock se carga a mano y con cuidado. Decant Manager (app Python/CustomTkinter/SQLite, con FIFO y montos Decimal guardados como TEXT) ya modela frascos y ml. El camino natural: exportar o sincronizar desde Decant Manager movimientos `adjustment` en `stock_movements`, nunca editar `stock` directo. No duplicar la lógica de ml en la web. Señal: más de ~30 perfumes o una primera sobreventa.

**Effort:** L
**Priority:** P3
**Depends on:** Catálogo cargado y en uso.

## Desarrollo local

### Storage local

**What:** Que `supabase start` levante Storage con sus tablas (`storage.buckets`, `storage.objects`) y el bucket `product-images`.

**Why:** Con Supabase CLI 2.119.0 + storage-api 1.79.28, Storage registra sus 74 migraciones en `storage.migrations` pero no crea las tablas. Declarar el bucket en `config.toml` hace fallar `supabase start` con `DatabaseSchemaMismatch`. Se reproduce sin nuestras migraciones y desde volúmenes limpios: es un bug de la herramienta, no del esquema.

**Context:** Mientras tanto, la sección de Storage de `0001` es condicional (`to_regclass('storage.objects')`): en la nube crea bucket y policies, en local emite un NOTICE y sigue. El bucket está comentado en `supabase/config.toml`. Para arreglarlo: actualizar el CLI (`npm i -D supabase@latest`), descomentar el bucket, `npx supabase stop --no-backup && npx supabase start`, y verificar `select * from storage.buckets`. **Ojo:** aunque el bucket aparezca, las 3 policies de escritura de `0001` NO se crean en local (la migración corre antes que Storage y queda registrada como aplicada). Hay que crearlas después del start, por ejemplo con un `supabase/seed.sql` que haga `drop policy if exists ...; create policy ...`; si no, las subidas del admin en local fallan por RLS sin error claro. Señal: antes de la Fase 2 si se quieren servir fotos desde el Storage local (alternativa: fotos de prueba en `public/`).

**Effort:** S
**Priority:** P2
**Depends on:** Una versión del CLI que lo corrija.

### Vulnerabilidades de `npm audit`

**What:** Revisar las 5 vulnerabilidades altas que reporta `npm audit` (entre ellas `braces`, denegación de servicio con patrones anidados) y actualizar lo que se pueda sin cambios incompatibles.

**Why:** Estaban antes de la Fase 3. La única solución que ofrece npm es `npm audit fix --force`, que salta a versiones con cambios incompatibles. Son dependencias de herramientas (build, tests), no código que corre con datos del cliente, pero hay que confirmarlo.

**Context:** Correr `npm audit` y ver, por cada una, si es de `dependencies` o de `devDependencies` y si llega al bundle o al servidor. Cualquier cambio en el lockfile se valida en Linux (memoria del proyecto: npm en Windows borra `@emnapi/*`). Señal: antes de la Fase 6 (lanzamiento).

**Effort:** S
**Priority:** P2
**Depends on:** —

## Checkout

### Largos máximos de los datos de envío en la base

**What:** `check` en `orders` (o validación en `create_order`) para el largo de `delivery_address` (120), `delivery_city` (60), `delivery_postal_code` (10) y `delivery_reference` (120), los mismos topes que hoy aplica solo zod.

**Why:** Las reglas de negocio viven en la base (CLAUDE.md). Hoy esos largos existen solo en el schema del checkout (decisión 40). Alcanza porque `create_order` solo se llama desde esa Server Action, pero si otra vía la llama (admin, script), la base aceptaría textos de cualquier largo.

**Context:** Como ya hubo deploy o no según cuándo se haga: hasta el primer deploy se edita `0001_initial_schema.sql`; después, migración nueva. Lleva su test en `schema.test.cjs` y un código de error nuevo (ej. `ADDRESS_TOO_LONG`) en `ORDER_ERRORS`: el test de `order-errors.test.ts` falla si falta el mensaje. Señal: antes del primer deploy, que es cuando todavía se edita `0001`.

**Effort:** S
**Priority:** P2
**Depends on:** —

## Catálogo

### Reemplazar las fotos placeholder por fotos reales

**What:** Subir las fotos reales de cada producto al bucket `product-images` y la del hero (hoy `public/brand/hero-placeholder.webp`).

**Why:** Las imágenes de `public/product-images/` y el hero son placeholders generados (un frasco genérico sobre carbón) para desarrollo y CI. En producción `NEXT_PUBLIC_PRODUCT_IMAGES_BASE_URL` va vacía y las fotos salen de Storage.

**Context:** Formato vertical 4:5, fondo oscuro o neutro (DESIGN.md → Fotos de producto). El nombre del archivo en el bucket es lo que va en `products.image_path`. El hero no es un producto: va en `public/brand/` (o en el bucket, si se prefiere editarlo sin deploy).

**Effort:** S
**Priority:** P1 (antes del lanzamiento)
**Depends on:** Fotos de la Fase 0.

## Design system

### Sincronizar el artifact con los cambios hechos en el código

**What:** Copiar al design system "FALBER" en Claude Artifacts (https://claude.ai/artifact/8MRV6N7UQkE1uDYGWUBB9j) dos cambios que hoy solo existen en el repo:
1. El token `error`: Noir `#e5867d`, Platinum `#a8332b`, con su regla de uso (`design/falber-tokens.json` → `color.tokens`).
2. El estilo `wordmark` con `clamp()`: 28 px en mobile y 40 px en desktop, tracking 0.4em (`src/app/globals.css`).

**Why:** El artifact es la fuente de verdad y la sincronización es manual, en un solo sentido (artifact → repo, DESIGN.md). Si se re-sincroniza sin estos cambios, el token `error` desaparece del JSON y `tokens.test.ts` falla; el `clamp()` del wordmark se perdería en silencio.

**Context:** Los dos cambios están documentados en DESIGN.md (tabla de color, "Regla del error" y la nota de mobile en Tipografía). Al terminar, verificar con `npm test` que `tokens.test.ts` siga en verde.

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
