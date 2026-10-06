# DESIGN.md — FALBER

Sistema visual de la tienda. **Fuente de verdad:** el design system "FALBER" en Claude Artifacts
(https://claude.ai/artifact/8MRV6N7UQkE1uDYGWUBB9j). Este archivo y `design/falber-tokens.json`
son la copia que usa el código. Si el design system cambia en el artifact, se re-sincroniza a mano
(se copia `project/tokens.json` y se actualiza este archivo) y se commitea como `style(design): sync tokens`.

## Identidad

- Marca de fragancias **unisex**. Idea central: **luz platino sobre negro carbón**.
- **Dark-first:** el tema `Noir` es el hábitat natural de la marca. `Platinum` (claro) es para documentos y, en esta app, para `/admin`.
- Tres colores de marca: `carbon-black` (#0B0C0E), `graphite` (#202226) y `platinum` (#BFC2C5). Son constantes: no cambian entre temas. Todo lo demás es neutro alrededor de ellos.

## Voz

- Frases cortas, afirmativas y sobrias; el espacio en blanco transmite el lujo.
- Títulos en MAYÚSCULAS, cuerpo en minúsculas normales.
- **Sin emojis y sin signos de exclamación**, incluido el mensaje de WhatsApp.
- El nombre siempre como `FALBER`, en mayúsculas (nunca "Falber").
- Cuenta oficial: **@falber.parfum**. Línea de marca: **"Fragrance experience"**.

## Temas en la app

| Zona | Tema | Cómo |
|---|---|---|
| Tienda pública (`/`, `/catalogo`, `/producto`, `/carrito`, `/checkout`, `/pedido`) | Noir | `<html data-theme="dark">` en el layout público |
| Panel `/admin` | Platinum | `data-theme="light"` en el layout de admin |

## Color (tokens semánticos)

Usar SIEMPRE el token semántico, nunca el hex directo.

| Token | Noir | Platinum | Uso |
|---|---|---|---|
| `surface` | #0b0c0e | #f4f5f6 | Fondo de página |
| `surface-raised` | #202226 | #ffffff | Cards, paneles, nav |
| `surface-overlay` | #2a2d32 | #eceef0 | Menús, popovers |
| `border` | #34373c | #d5d8db | Divisores finos, bordes de controles |
| `border-strong` | #4a4e53 | #b9bdc1 | Bordes de énfasis, inputs |
| `text` | #f3f4f5 | #0b0c0e | Texto principal (≥12:1) |
| `text-secondary` | #c7cacd | #3a3d42 | Subtítulos (≥7:1) |
| `text-muted` | #93969b | #63676b | Captions, metadata (≥4.5:1) |
| `accent` | #bfc2c5 | #45494e | Links, selección, énfasis interactivo |
| `on-accent` | #0b0c0e | #f4f5f6 | Texto sobre un fondo `accent` |
| `accent-strong` | #e6e8ea | #202226 | Hover/active de `accent` |
| `error` | #e5867d | #a8332b | Texto de error y borde del campo inválido (≥5:1 en las tres superficies) |

**Regla del error:** rojo desaturado, nunca decorativo. Siempre va con texto explícito (qué pasó y cómo arreglarlo) y `aria-invalid`: el color refuerza, no informa solo. En Noir tiene casi la misma luminosidad que `text-muted`, así que sin el texto un error y un hint se confundirían.

**Regla del platino:** `platinum` es solo para marcas, filetes y énfasis **sobre fondos oscuros**. Sobre fondo claro tiene poco contraste: ahí se usa `accent`.

## Tipografía

| Familia | Fuente | Uso |
|---|---|---|
| `display` | **Cinzel** (serif grabada) | Voz ceremonial: nombre en el hero, títulos de campaña. Siempre en mayúsculas |
| `sans` | **Montserrat** | Todo lo funcional: wordmark moderno, títulos, cuerpo, labels |

Ambas se cargan con `next/font/google`. Son reemplazos libres de las fuentes de producción; si
aparecen las licenciadas, se cambian en un solo lugar.

| Estilo | Familia | Tamaño / línea | Peso | Tracking | Uso |
|---|---|---|---|---|---|
| `display-xl` | display | 72/76 | 500 | 0.04em | FALBER en el hero (platino sobre carbón) |
| `display-lg` | display | 48/54 | 500 | 0.06em | Portadas de sección |
| `wordmark-serif` | display | 36/40 | 600 | 0.14em | Lockup serif |
| `wordmark` | sans | 40/44 | 300 | 0.4em (nunca < 0.3em) | Wordmark del header |
| `h1` | sans | 32/38 | 300 | 0.02em | Títulos de página |
| `h2` | sans | 24/30 | 400 | 0 | Subsecciones |
| `h3` | sans | 18/24 | 500 | 0.01em | Títulos de card |
| `body` | sans | 16/26 | 400 | 0 | Texto general |
| `body-sm` | sans | 14/22 | 400 | 0 | Texto secundario |
| `label` | sans | 12/16 | 600 | 0.18em | Labels y eyebrows, MAYÚSCULAS |
| `caption` | sans | 11/15 | 400 | 0.04em | Letra chica |

En mobile, `display-xl` baja a ~44px y `wordmark` a ~28px, manteniendo el tracking: ni el hero ni el header pueden romper el ancho.

**En el código:** cada estilo es una utilidad `text-<estilo>` (tamaño, línea, tracking y peso), definida en
`src/app/globals.css`. La familia y las mayúsculas se agregan aparte: `font-display uppercase text-display-xl`,
`uppercase text-label`. Los colores semánticos son `bg-surface`, `text-text`, `text-text-muted`, `border-border`, etc.

## Espaciado y forma

- Escala: `space-1` 4 · `space-2` 8 · `space-3` 12 · `space-4` 16 (unidad base) · `space-5` 24 · `space-6` 32 · `space-8` 48 · `space-10` 64 · `space-12` 96 px.
- Las secciones grandes respiran con `space-10` a `space-12`: el espacio generoso es parte de la marca.
- **En el código se usa la escala de Tailwind** (también de 4px). Ojo: los nombres no coinciden a partir de `space-5`.

  | DESIGN.md | `space-1` | `space-2` | `space-3` | `space-4` | `space-5` | `space-6` | `space-8` | `space-10` | `space-12` |
  |---|---|---|---|---|---|---|---|---|---|
  | Tailwind | `1` | `2` | `3` | `4` | `6` | `8` | `12` | `16` | `24` |
- **Esquinas rectas:** `radius-none` en botones, inputs y cards (como las marcas grabadas y el frasco rectangular). `radius-sm` 2px para chips, `radius-md` 4px para fotos, `radius-pill` solo en pills y avatares.
- La elevación se lee por la luminosidad de la superficie. `shadow-raised` y `shadow-overlay` se usan con moderación.

## Componentes base

Se **reimplementan en `src/components/ui/`** con los tokens. El bundle del artifact no se usa: pide React 18 y no funciona en Server Components (decisión 1 de la revisión).

| Componente | Comportamiento |
|---|---|
| `Button` | Acción principal: label en MAYÚSCULAS con tracking amplio, caja de esquinas rectas. Variantes: primario (fondo `accent`, texto `on-accent`) y secundario (borde `border-strong`) |
| `Input` | Label en MAYÚSCULAS arriba, campo, hint opcional abajo. Borde `border-strong`, foco visible. Con error: borde y mensaje en `error` (también con foco) |
| `Card` | Panel en `surface-raised` con borde fino `border` y esquinas rectas |

## Logos

- Están en el grupo `Logos` del artifact: `falber-lockup.jpg`, `falber-monogram.jpg`, `falber-identity-sheet.jpg`. Son JPG grandes (1,3 a 2,2 MB), platino con textura metálica sobre negro.
- Van **solo sobre `carbon-black` o `graphite`**. Nunca sobre fondo claro, nunca recoloreados ni redibujados.
- **No hay versión vectorial** (pendiente en TODOS.md). Por eso:
  - el header usa el nombre en tipografía `wordmark`, no la imagen;
  - el favicon sale del monograma, recortado y exportado chico;
  - si se usa el lockup en el hero, va recortado y servido con `next/image` (WebP/AVIF), nunca el JPG original.

## Fotos de producto

- Fondo oscuro o neutro, coherente con Noir. Con `next/image` siempre (tamaños `sizes` correctos, `priority` solo en la imagen del hero).
- `object-fit: cover` en grillas; `radius-md` (4px).

## Accesibilidad

- Texto ≥ 4.5:1 en ambos temas (los tokens ya cumplen sobre `surface` y `surface-raised`).
- Foco visible en todo control (anillo en `accent`).
- Los colores que deben distinguirse varían en luminosidad, no solo en tono (estados de pedido en el admin).
