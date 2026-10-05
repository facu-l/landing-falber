# TODOS

## Admin

### Admin de productos, stock y encargos

**What:** Interfaz en `/admin` para crear y editar productos y variantes (con subida de fotos), cargar movimientos de stock y gestionar encargos con el ranking.

**Why:** En el MVP esto se opera desde Supabase Studio (decisión 10 de la revisión). Sirve para arrancar, pero cargar productos con fotos ahí es incómodo y lento.

**Context:** Las tablas, funciones, permisos y protecciones ya existen y valen también en Studio (la columna `stock` no se edita a mano, el historial no se borra). Falta solo la UI con tema Platinum, `requireAdmin()` en cada acción, sesión del usuario (nunca `service_role`) y `revalidateTag('catalog')` al guardar. Señal para hacerlo: cuando cargar o editar productos te lleve más de 10 minutos por semana.

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

**Context:** Mientras tanto, la sección de Storage de `0001` es condicional (`to_regclass('storage.objects')`): en la nube crea bucket y policies, en local emite un NOTICE y sigue. El bucket está comentado en `supabase/config.toml`. Para arreglarlo: actualizar el CLI (`npm i -D supabase@latest`), descomentar el bucket, `npx supabase stop --no-backup && npx supabase start`, y verificar `select * from storage.buckets`. Señal: antes de la Fase 2 si se quieren servir fotos desde el Storage local (alternativa: fotos de prueba en `public/`).

**Effort:** S
**Priority:** P2
**Depends on:** Una versión del CLI que lo corrija.

## Marca

### Logo y monograma de FALBER en vectorial (SVG)

**What:** Versión vectorial del lockup y del monograma, incluida una variante para fondo claro.

**Why:** El design system solo trae JPG grandes (1,3 a 2,2 MB) con textura metálica sobre negro. No sirven para un favicon nítido, fondos claros ni impresión, y por eso el header usa la tipografía `wordmark` en lugar del logo.

**Context:** Es trabajo de diseño (Facundo o un diseñador), no de código. Cuando exista, se sube al grupo `Logos` del design system en Artifacts y se actualizan `DESIGN.md`, el favicon y el header.

**Effort:** M
**Priority:** P3
**Depends on:** None

## Completed
