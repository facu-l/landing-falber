-- Catálogo de PRUEBA para desarrollo local y CI. Lo aplica `supabase db reset`
-- (y el primer `supabase start`) después de las migraciones. Nunca va a producción.
--
-- Precios y stock son inventados. Las fotos son placeholders en public/product-images/:
-- `supabase start` las sube al bucket local (objects_path en config.toml).
--
-- Reglas que respeta:
--   * El stock entra SOLO por stock_movements (initial_stock); nunca se edita `stock`.
--   * Los productos nacen sin publicar (0003) y se publican al final, con foto y
--     presentaciones: el mismo orden que exige el admin (decisión 93).
--   * Casos de borde a propósito: una variante sin stock (Santal 33, 10 ml),
--     un producto completamente agotado (The Most Wanted) y uno inactivo (no se ve).

insert into public.products (name, brand, slug, description, image_path, gender, is_featured) values
  ('Sauvage EDT', 'Dior', 'dior-sauvage-edt',
   'Bergamota de Calabria y pimienta sobre una base de ambroxan. Fresca, mineral y muy versátil.',
   'dior-sauvage-edt.webp', 'male', true),
  ('Aventus', 'Creed', 'creed-aventus',
   'Ananá, abedul ahumado y almizcle. Un clásico frutal y amaderado.',
   'creed-aventus.webp', 'male', true),
  ('Baccarat Rouge 540', 'Maison Francis Kurkdjian', 'mfk-baccarat-rouge-540',
   'Azafrán, jazmín y ambargris. Luminosa, dulce y con una estela que se nota.',
   'mfk-baccarat-rouge-540.webp', 'unisex', true),
  ('Santal 33', 'Le Labo', 'le-labo-santal-33',
   'Sándalo australiano, cardamomo y cuero. Seca y cremosa a la vez.',
   'le-labo-santal-33.webp', 'unisex', false),
  ('Coco Mademoiselle EDP', 'Chanel', 'chanel-coco-mademoiselle-edp',
   'Naranja, rosa y pachulí. Elegante, oriental y fresca.',
   'chanel-coco-mademoiselle-edp.webp', 'female', false),
  ('Oud Wood', 'Tom Ford', 'tom-ford-oud-wood',
   'Oud, palo de rosa y vainilla. Ahumada y suave.',
   'tom-ford-oud-wood.webp', 'unisex', false),
  ('Libre EDP', 'Yves Saint Laurent', 'ysl-libre-edp',
   'Lavanda francesa y flor de azahar sobre vainilla de Madagascar.',
   'ysl-libre-edp.webp', 'female', false),
  ('The Most Wanted', 'Azzaro', 'azzaro-the-most-wanted',
   'Cardamomo, toffee y maderas. Intensa y nocturna.',
   'azzaro-the-most-wanted.webp', 'male', false),
  ('Producto oculto', 'FALBER', 'producto-oculto',
   'Inactivo: no debe aparecer en la tienda.',
   null, 'unisex', false);

-- Variantes: (slug, tipo, ml, precio)
insert into public.product_variants (product_id, variant_type, size_ml, price)
select p.id, v.variant_type::public.variant_type, v.size_ml, v.price
from (values
  ('dior-sauvage-edt',             'decant',       5,   14500),
  ('dior-sauvage-edt',             'decant',      10,   26000),
  ('dior-sauvage-edt',             'full_bottle', 100, 245000),
  ('creed-aventus',                'decant',       5,   32000),
  ('creed-aventus',                'decant',      10,   59000),
  ('mfk-baccarat-rouge-540',       'decant',       5,   36500),
  ('mfk-baccarat-rouge-540',       'decant',      10,   68000),
  ('le-labo-santal-33',            'decant',       5,   27500),
  ('le-labo-santal-33',            'decant',      10,   51000),
  ('chanel-coco-mademoiselle-edp', 'decant',       5,   17800),
  ('chanel-coco-mademoiselle-edp', 'full_bottle', 100, 289000),
  ('tom-ford-oud-wood',            'decant',       5,   29900),
  ('ysl-libre-edp',                'full_bottle',  90, 232000),
  ('azzaro-the-most-wanted',       'full_bottle', 100, 168000),
  ('producto-oculto',              'decant',       5,    1000)
) as v(slug, variant_type, size_ml, price)
join public.products p on p.slug = v.slug;

-- Stock inicial por el ledger. Las variantes sin fila quedan en 0 (agotadas).
insert into public.stock_movements (variant_id, movement_type, quantity, note)
select pv.id, 'initial_stock', s.quantity, 'Seed de desarrollo'
from (values
  ('dior-sauvage-edt',             'decant',       5,  24),
  ('dior-sauvage-edt',             'decant',      10,  12),
  ('dior-sauvage-edt',             'full_bottle', 100,  1),
  ('creed-aventus',                'decant',       5,   8),
  ('creed-aventus',                'decant',      10,   3),
  ('mfk-baccarat-rouge-540',       'decant',       5,  10),
  ('mfk-baccarat-rouge-540',       'decant',      10,   4),
  ('le-labo-santal-33',            'decant',       5,   6),
  ('chanel-coco-mademoiselle-edp', 'decant',       5,  15),
  ('chanel-coco-mademoiselle-edp', 'full_bottle', 100,  2),
  ('tom-ford-oud-wood',            'decant',       5,   7),
  ('ysl-libre-edp',                'full_bottle',  90,  1),
  ('producto-oculto',              'decant',       5,   5)
) as s(slug, variant_type, size_ml, quantity)
join public.products p on p.slug = s.slug
join public.product_variants pv
  on pv.product_id = p.id
 and pv.variant_type = s.variant_type::public.variant_type
 and pv.size_ml = s.size_ml;

-- Publicar, ya con foto y presentaciones (0003 lo exige). "Producto oculto" queda sin
-- publicar: no tiene foto y no debe aparecer en la tienda.
update public.products set status = 'active' where slug <> 'producto-oculto';
