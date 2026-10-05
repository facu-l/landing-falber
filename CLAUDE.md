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
- Cada Server Action del admin empieza con `requireAdmin()` y usa la sesión del usuario (nunca `service_role`).
- `SUPABASE_SERVICE_ROLE_KEY` nunca con prefijo `NEXT_PUBLIC_`.
- UI: tokens semánticos de `DESIGN.md`, nunca hex directos. Sin emojis ni signos de exclamación en los textos de marca.
- Hasta el primer deploy, `0001_initial_schema.sql` se edita directamente. Después, solo migraciones nuevas.

## Testing

- Base de datos: `node supabase/tests/schema.test.cjs` (requiere `npm i -D @electric-sql/pglite`).
- Lógica: Vitest. Flujos: Playwright (compra completa y protección de `/admin`).
- Todo cambio en la migración lleva su test en `schema.test.cjs`.

## Git

Commits atómicos en inglés: `type(scope): description` (feat, fix, refactor, docs, test, chore, style). Una rama por fase.

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
