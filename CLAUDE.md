# FALBER — tienda online

Tienda de decants y perfumes de la marca FALBER. Ventas que se cierran por WhatsApp (sin pasarela de pago).
Stack: Next.js (App Router) + TypeScript + Tailwind v4 + Supabase. Hosting: Netlify.

## Leer antes de trabajar

- `docs/FALBER_documento_maestro.md` — arquitectura, decisiones cerradas y plan por fases. Fuente de verdad.
- `DESIGN.md` — sistema visual (tokens, temas Noir/Platinum, tipografía, componentes, voz de marca).
- `TODOS.md` — lo diferido, con la señal de cuándo hacerlo.

## Reglas que no se rompen

- Las reglas de negocio viven en la DB (`supabase/migrations/`). El frontend las repite solo para mostrar errores amigables.
- El stock cambia SOLO insertando en `stock_movements`. Nunca editar `product_variants.stock`.
- Los pedidos se crean SOLO con la RPC `create_order`, desde un Server Action, con `service_role`.
- Cada Server Action del admin empieza con `requireAdminAction()` (cada página, con `requireAdmin()`) y usa la sesión del usuario (nunca `service_role`).
- `SUPABASE_SERVICE_ROLE_KEY` nunca con prefijo `NEXT_PUBLIC_`.
- UI: tokens semánticos de `DESIGN.md`, nunca hex directos. Sin emojis ni signos de exclamación en los textos de marca.
- Hasta el primer deploy, `0001_initial_schema.sql` se edita directamente. Después, solo migraciones nuevas.

## Testing

- Base de datos: `npm run test:db` (PGlite, sin Docker).
- Lógica: `npm test` (Vitest, `src/**/*.test.{ts,tsx}`). Flujos: `npm run test:e2e` (Playwright, `e2e/`: compra completa y protección de `/admin`).
- Todo cambio en la migración lleva su test en `schema.test.cjs`.

## Desarrollo local

- `cp .env.example .env.local` y completar con `npx supabase status`.
- `npm run db:start:lite` levanta Supabase (Docker: db, auth y API, igual que el CI). `npm run db:start` levanta el stack completo, pero falla el health check por Storage. `npm run db:reset` re-aplica las migraciones y `supabase/seed.sql` (catálogo de prueba). `npm run db:types` regenera `src/types/database.ts` después de cambiar el esquema.
- Storage local no funciona con el CLI actual (ver `TODOS.md` → "Storage local"). Las fotos de prueba están en `public/product-images/` (`NEXT_PUBLIC_PRODUCT_IMAGES_BASE_URL=/product-images`).
- Catálogo: `getCatalog()` en `src/lib/catalog/queries.ts` (una consulta, tag `'catalog'`). Las reglas puras están en `src/lib/catalog/catalog.ts`.
- Compra: carrito en `src/lib/cart/` (reglas puras + store de `localStorage`), checkout en `src/lib/checkout/schema.ts` y la Server Action `src/app/(store)/checkout/actions.ts`, pedido en `src/lib/orders/`. Los E2E de compra escriben en la base: si se agota el stock del seed, `npm run db:reset`.
- Encargos: reglas en `src/lib/requests/` (schema, errores, precarga desde `?producto=<slug>`) y la Server Action `src/app/(store)/encargos/actions.ts`. Lo compartido con el checkout vive en `src/lib/forms/`, `src/lib/db-errors.ts`, `src/lib/security/verify-request.ts` y `TurnstileField`: reusarlo en cualquier formulario público nuevo, con su propia acción en `TurnstileAction` (`src/lib/forms/form-data.ts`, decisión 87).
- Admin: `npm run db:admin` crea o actualiza un admin local (`admin@falber.test`) y muestra la contraseña en la terminal (`scripts/local-users.ts`, solo contra Supabase local). El panel vive en `src/app/admin/` (login aparte; el resto en el route group `(panel)`), las reglas en `src/lib/admin/` (`requireAdmin`/`requireAdminAction`/`getAdminStatus`, rutas, copias en TS de reglas de la base probadas contra `supabase/tests/order-transitions.json`). `src/proxy.ts` corre solo en `/admin`. Los E2E del admin crean usuarios y pedidos por test (`e2e/admin-helpers.ts`). El login pide Turnstile: es el CAPTCHA nativo de Auth (`[auth.captcha]` en `supabase/config.toml`, clave de prueba) y la Admin API no lo necesita. Las cookies de sesión son `httpOnly` (`src/lib/supabase/cookies.ts`).
- Envíos estimados: tabla `shipping_rates` (una fila), lectura cacheada en `src/lib/shipping/` (tag `'shipping-rates'`), edición en `/admin/envios`. Son informativos: el pedido nace con el envío a coordinar.
- Backup y keepalive: `.github/workflows/keepalive-backup.yml`, dos jobs que se activan con las variables del repo `KEEPALIVE_ENABLED` y `BACKUP_ENABLED` (documento maestro → Fase 6 → Backups).
- `supabase/config.toml`: no apagar `[auth.email] enable_signup` (apaga el login con email, decisión 61). El registro público se cierra con `[auth] enable_signup = false`.
- Dependencias: en Windows, `npm install` borra `@emnapi/*` del lockfile. Editar `package.json` y el lockfile a mano y validar con `docker run node:24 npm install --package-lock-only` (documento maestro → Fase 3, lecciones).
- Reiniciá el dev server si creás una carpeta nueva en `src/app` (en Windows Tailwind no detecta sus clases) o después de cambiar de rama (puede quedar con un `next.config.ts` viejo, ej. "enable the feature flag `cacheComponents`").

## Git

Commits atómicos en inglés: `type(scope): description` (feat, fix, refactor, docs, test, chore, style). Una rama por fase.

Al cerrar cada fase (una vez por PR, no en cada cambio), regenerar el PDF del documento maestro con el skill `make-pdf` (`--cover --toc --author "Facundo"`) y commitearlo como `docs(architecture): regenerate master document PDF for vX.Y`. Es binario (~1,5 MB): cada versión queda entera en el historial.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec

@AGENTS.md
