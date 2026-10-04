// Prueba la migración contra Postgres real (PGlite) imitando Supabase.
// Correr: npm i -D @electric-sql/pglite && node supabase/tests/schema.test.cjs
const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');

const MIGRATION = require('path').join(__dirname, '..', 'migrations', '0001_initial_schema.sql');

const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema public to anon, authenticated, service_role;
-- Permisos por defecto de Supabase en el schema public:
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

let passed = 0, failed = 0;
const ok = (name) => { passed++; console.log('  PASS', name); };
const bad = (name, info) => { failed++; console.log('  FAIL', name, '->', info); };

async function expectError(db, name, sql, fragment) {
  try { await db.exec(sql); bad(name, 'no tiró error'); }
  catch (e) { e.message.includes(fragment) ? ok(name) : bad(name, e.message); }
  finally { await db.exec('reset role; reset request.jwt.claim.sub;'); }
}
async function one(db, sql) { return (await db.query(sql)).rows[0]; }
function eq(name, actual, expected) {
  (typeof expected === 'number' ? Number(actual) === expected : String(actual) === String(expected)) ? ok(name) : bad(name, `esperado ${expected}, obtuve ${actual}`);
}

const ADMIN = '11111111-1111-1111-1111-111111111111';
const RANDOM_USER = '22222222-2222-2222-2222-222222222222';

function orderCall(opts = {}) {
  const o = {
    name: 'Juan Pérez', wa: '+5492215551234', pay: 'transfer', delivery: 'pickup',
    address: null, city: null, items: '[]', ...opts,
  };
  const q = (v) => (v === null ? 'null' : `'${v}'`);
  return `select public.create_order(${q(o.name)}, ${q(o.wa)}, null, ${q(o.pay)}, ${q(o.delivery)},
    ${q(o.address)}, ${q(o.city)}, null, null, 'sin aclaración', '${o.items}'::jsonb) as r`;
}

(async () => {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);

  console.log('\n[1] Migración');
  try { await db.exec(fs.readFileSync(MIGRATION, 'utf8')); ok('la migración se aplica sin errores'); }
  catch (e) { bad('aplicar migración', e.message); process.exit(1); }

  // Seed (como superusuario = Supabase SQL editor)
  await db.exec(`
    insert into auth.users values ('${ADMIN}'), ('${RANDOM_USER}');
    insert into profiles (id, display_name) values ('${ADMIN}', 'Facundo');
    insert into products (id, name, brand, slug, gender) values
      ('aaaaaaaa-0000-0000-0000-000000000001', 'Sauvage EDT', 'Dior', 'dior-sauvage-edt', 'male'),
      ('aaaaaaaa-0000-0000-0000-000000000002', 'The Most Wanted', 'Azzaro', 'azzaro-the-most-wanted', 'male'),
      ('aaaaaaaa-0000-0000-0000-000000000003', 'Producto oculto', 'X', 'producto-oculto', 'unisex');
    update products set status = 'inactive' where slug = 'producto-oculto';
    insert into product_variants (id, product_id, variant_type, size_ml, price) values
      ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'decant', 5, 8000),
      ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'decant', 10, 14000),
      ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003', 'decant', 5, 1000);
    insert into stock_movements (variant_id, movement_type, quantity, note) values
      ('bbbbbbbb-0000-0000-0000-000000000001', 'initial_stock', 10, 'Carga inicial'),
      ('bbbbbbbb-0000-0000-0000-000000000002', 'initial_stock', 5, 'Carga inicial'),
      ('bbbbbbbb-0000-0000-0000-000000000003', 'initial_stock', 5, 'Carga inicial');
  `);
  const V1 = 'bbbbbbbb-0000-0000-0000-000000000001', V2 = 'bbbbbbbb-0000-0000-0000-000000000002';

  console.log('\n[2] Ledger de stock');
  eq('initial_stock carga la caché de stock', (await one(db, `select stock from product_variants where id='${V1}'`)).stock, 10);
  await expectError(db, 'ledger: signo incorrecto (sale positiva) se rechaza',
    `insert into stock_movements (variant_id, movement_type, quantity) values ('${V1}', 'sale', 3)`, 'quantity_sign_matches_type');
  await expectError(db, 'ledger: ajuste que deja stock negativo se rechaza',
    `insert into stock_movements (variant_id, movement_type, quantity) values ('${V1}', 'adjustment', -50)`, 'stock_check');

  console.log('\n[3] create_order — camino feliz');
  const items = `[{"variant_id":"${V1}","quantity":1},{"variant_id":"${V2}","quantity":1},{"variant_id":"${V1}","quantity":1}]`;
  const r1 = (await one(db, orderCall({ items }))).r;
  eq('devuelve número FAL-0001', r1.order_number, 'FAL-0001');
  const o1 = await one(db, `select * from orders where id='${r1.order_id}'`);
  eq('subtotal calculado con precios de la DB (2x8000 + 14000)', o1.subtotal, 30000);
  eq('total generado = subtotal + envío', o1.total, 30000);
  eq('variante repetida en el carrito se agrupa en 1 ítem', (await one(db, `select count(*) c from order_items where order_id='${r1.order_id}'`)).c, 2);
  const it = await one(db, `select * from order_items where order_id='${r1.order_id}' and variant_id='${V1}'`);
  eq('snapshot de nombre', it.product_name, 'Sauvage EDT');
  eq('snapshot de etiqueta', it.variant_label, 'Decant 5 ml');
  eq('line_total generado', it.line_total, 16000);
  eq('stock descontado (10 - 2)', (await one(db, `select stock from product_variants where id='${V1}'`)).stock, 8);
  eq('movimiento sale registrado con referencia al pedido',
    (await one(db, `select count(*) c from stock_movements where reference_id='${r1.order_id}' and movement_type='sale'`)).c, 2);

  console.log('\n[4] create_order — rechazos (y que no quede nada a medio crear)');
  const ordersBefore = (await one(db, 'select count(*) c from orders')).c;
  await expectError(db, 'stock insuficiente', orderCall({ wa: '+5492215550001', items: `[{"variant_id":"${V2}","quantity":9}]` }), 'INSUFFICIENT_STOCK');
  eq('rollback: no quedó pedido huérfano', (await one(db, 'select count(*) c from orders')).c, ordersBefore);
  eq('rollback: el stock no cambió', (await one(db, `select stock from product_variants where id='${V2}'`)).stock, 4);
  await expectError(db, 'carrito vacío', orderCall({ items: '[]' }), 'EMPTY_CART');
  await expectError(db, 'cantidad 0', orderCall({ items: `[{"variant_id":"${V1}","quantity":0}]` }), 'INVALID_QUANTITY');
  await expectError(db, 'cantidad > 10', orderCall({ items: `[{"variant_id":"${V1}","quantity":11}]` }), 'INVALID_QUANTITY');
  await expectError(db, 'producto inactivo no se puede comprar',
    orderCall({ items: `[{"variant_id":"bbbbbbbb-0000-0000-0000-000000000003","quantity":1}]` }), 'VARIANT_UNAVAILABLE');
  await expectError(db, 'variante inexistente',
    orderCall({ items: `[{"variant_id":"bbbbbbbb-0000-0000-0000-00000000dead","quantity":1}]` }), 'VARIANT_UNAVAILABLE');
  await expectError(db, 'efectivo + envío se rechaza',
    orderCall({ pay: 'cash', delivery: 'delivery', address: 'Calle 7 123', city: 'La Plata', items: `[{"variant_id":"${V1}","quantity":1}]` }), 'cash_only_for_pickup');
  await expectError(db, 'envío sin dirección se rechaza',
    orderCall({ delivery: 'delivery', items: `[{"variant_id":"${V1}","quantity":1}]` }), 'delivery_requires_address');
  await expectError(db, 'WhatsApp con formato inválido se rechaza',
    orderCall({ wa: '221-555-1234', items: `[{"variant_id":"${V1}","quantity":1}]` }), 'customers_whatsapp_check');
  const envio = (await one(db, orderCall({ wa: '+5492215550002', delivery: 'delivery', address: 'Calle 7 123', city: 'La Plata', items: `[{"variant_id":"${V1}","quantity":1}]` }))).r;
  ok('transferencia + envío con dirección se acepta (' + envio.order_number + ')');

  console.log('\n[5] Anti-abuso');
  await db.exec(orderCall({ wa: '+5492215559999', items: `[{"variant_id":"${V1}","quantity":1}]` }));
  await db.exec(orderCall({ wa: '+5492215559999', items: `[{"variant_id":"${V1}","quantity":1}]` }));
  await db.exec(orderCall({ wa: '+5492215559999', items: `[{"variant_id":"${V1}","quantity":1}]` }));
  await expectError(db, '4º pedido pendiente del mismo WhatsApp se rechaza',
    orderCall({ wa: '+5492215559999', items: `[{"variant_id":"${V1}","quantity":1}]` }), 'TOO_MANY_PENDING_ORDERS');
  eq('el mismo WhatsApp reutiliza el customer (upsert)', (await one(db, `select count(*) c from customers where whatsapp='+5492215559999'`)).c, 1);

  console.log('\n[6] Cancelación devuelve stock');
  const stockAntes = (await one(db, `select stock from product_variants where id='${V1}'`)).stock;
  await db.exec(`update orders set status='cancelled' where id='${r1.order_id}'`);
  eq('cancelar devuelve las 2 unidades', (await one(db, `select stock from product_variants where id='${V1}'`)).stock, stockAntes + 2);
  await expectError(db, 'un pedido cancelado no se reabre',
    `update orders set status='pending' where id='${r1.order_id}'`, 'ORDER_ALREADY_CANCELLED');
  await db.exec(`update orders set status='cancelled' where id='${r1.order_id}'`);
  eq('re-guardar "cancelled" no devuelve stock dos veces', (await one(db, `select stock from product_variants where id='${V1}'`)).stock, stockAntes + 2);
  await expectError(db, 'retiro no puede pasar a "shipped"',
    `update orders set status='shipped' where id = (select o.id from orders o join customers c on c.id=o.customer_id where c.whatsapp='+5492215559999' limit 1)`, 'pickup_is_not_shipped');

  console.log('\n[7] Seguridad: navegador (anon)');
  await db.exec(`set role anon`);
  eq('anon ve solo productos activos', (await one(db, 'select count(*) c from products')).c, 2);
  eq('anon NO ve pedidos', (await one(db, 'select count(*) c from orders')).c, 0);
  eq('anon NO ve clientes', (await one(db, 'select count(*) c from customers')).c, 0);
  await db.exec('reset role');
  await expectError(db, 'anon NO puede llamar create_order directo',
    `set role anon; ${orderCall({ items: `[{"variant_id":"${V1}","quantity":1}]` })}`, 'permission denied');
  await expectError(db, 'anon NO puede insertar pedidos directo',
    `set role anon; insert into orders (customer_id, payment_method, delivery_method, subtotal) values ('${(await one(db, "select id from customers limit 1")).id}', 'transfer', 'pickup', 1)`, 'row-level security');

  console.log('\n[8] Seguridad: usuario logueado que NO es admin');
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${RANDOM_USER}'`);
  eq('usuario común NO ve pedidos', (await one(db, 'select count(*) c from orders')).c, 0);
  await db.exec('reset role; reset request.jwt.claim.sub;');
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${RANDOM_USER}'`);
  eq('usuario común: el UPDATE de precio afecta 0 filas (RLS)', (await db.query(`update product_variants set price = 1 where id='${V1}' returning id`)).rows.length, 0);
  await db.exec('reset role; reset request.jwt.claim.sub;');
  eq('...y el precio sigue intacto', (await one(db, `select price from product_variants where id='${V1}'`)).price, 8000);

  console.log('\n[9] Seguridad: admin');
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${ADMIN}'`);
  ok('admin ve ' + (await one(db, 'select count(*) c from orders')).c + ' pedidos');
  await db.exec(`update product_variants set price = 9000 where id='${V1}'`);
  ok('admin puede cambiar precios');
  await db.exec(`insert into stock_movements (variant_id, movement_type, quantity, note) values ('${V1}', 'restock', 5, 'Nueva producción')`);
  ok('admin puede cargar stock vía movimiento');
  await db.exec('reset role; reset request.jwt.claim.sub;');
  await expectError(db, 'admin NO puede editar stock directo (columna protegida)',
    `set role authenticated; set request.jwt.claim.sub = '${ADMIN}'; update product_variants set stock = 999 where id='${V1}'`, 'permission denied');
  await expectError(db, 'admin NO puede borrar movimientos del ledger',
    `set role authenticated; set request.jwt.claim.sub = '${ADMIN}'; delete from stock_movements`, 'permission denied');
  eq('el pedido histórico conserva el precio viejo (snapshot)',
    (await one(db, `select unit_price from order_items where order_id='${r1.order_id}' and variant_id='${V1}'`)).unit_price, 8000);

  console.log('\n[10] Resumen público, encargos y numeración');
  const sum = (await one(db, `select public.get_order_summary('${envio.order_id}') s`)).s;
  eq('el resumen no expone teléfono ni dirección', JSON.stringify(sum).includes('5492215550002') || JSON.stringify(sum).includes('Calle 7'), false);
  eq('el resumen trae los ítems', sum.items.length, 1);
  await db.exec(`select public.create_perfume_request('Ana López', '+5492215557777', 'Oud Wood', 'Tom Ford', '100 ml', null)`);
  await db.exec(`select public.create_perfume_request('Leo Díaz', '+5492215558888', ' oud wood ', 'Tom Ford', '50 ml', null)`);
  eq('el ranking agrupa "Oud Wood" y " oud wood "', (await one(db, `select total_requests from perfume_requests_ranking where perfume_key='oud wood'`)).total_requests, 2);
  await db.exec(`select setval('order_number_seq', 12344)`);
  eq('numeración no se trunca después de 9999', (await one(db, 'select public.next_order_number() n')).n, 'FAL-12345');

  console.log(`\nRESULTADO: ${passed} pasaron, ${failed} fallaron`);
  process.exit(failed ? 1 : 0);
})();
