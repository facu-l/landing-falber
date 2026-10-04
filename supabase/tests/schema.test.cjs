// Prueba la migración 0001 contra Postgres real (PGlite) imitando los roles y
// permisos por defecto de Supabase. No reemplaza probarla una vez contra
// `supabase start` (decisión 15e), pero cubre toda la lógica de negocio.
//
// Correr: npm i -D @electric-sql/pglite && node supabase/tests/schema.test.cjs
const { PGlite } = require('@electric-sql/pglite');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

const MIGRATION = path.join(__dirname, '..', 'migrations', '0001_initial_schema.sql');

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

const ADMIN = '11111111-1111-1111-1111-111111111111';
const RANDOM_USER = '22222222-2222-2222-2222-222222222222';
const asAdmin = `set role authenticated; set request.jwt.claim.sub = '${ADMIN}';`;
const asUser = `set role authenticated; set request.jwt.claim.sub = '${RANDOM_USER}';`;

async function reset(db) { await db.exec('reset role; reset request.jwt.claim.sub;'); }

// Espera un error cuyo message (o detail) contenga el fragmento.
async function expectError(db, name, sql, fragment, detailFragment) {
  try { await db.exec(sql); bad(name, 'no tiró error'); }
  catch (e) {
    const msgOk = e.message.includes(fragment);
    const detailOk = !detailFragment || String(e.detail || '').includes(detailFragment);
    msgOk && detailOk ? ok(name) : bad(name, `${e.message} | detail: ${e.detail}`);
  }
  finally { await reset(db); }
}
async function one(db, sql) { return (await db.query(sql)).rows[0]; }
function eq(name, actual, expected) {
  const same = typeof expected === 'number' ? Number(actual) === expected : String(actual) === String(expected);
  same ? ok(name) : bad(name, `esperado ${expected}, obtuve ${actual}`);
}

const key = () => 'client-' + randomUUID(); // hash de IP simulado (>= 16 caracteres)
const q = (v) => (v === null ? 'null' : `'${v}'`);

function orderCall(opts = {}) {
  const o = {
    req: randomUUID(), client: key(), name: 'Juan Pérez', wa: '+5492215551234', email: null,
    pay: 'transfer', delivery: 'pickup', address: null, city: null, note: 'sin aclaración', items: '[]',
    ...opts,
  };
  return `select public.create_order(${q(o.req)}, ${q(o.client)}, ${q(o.name)}, ${q(o.wa)}, ${q(o.email)},
    ${q(o.pay)}, ${q(o.delivery)}, ${q(o.address)}, ${q(o.city)}, null, null, ${q(o.note)}, '${o.items}'::jsonb) as r`;
}
const item = (variant, quantity) => `{"variant_id":"${variant}","quantity":${quantity}}`;

(async () => {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);

  console.log('\n[1] Migración');
  try { await db.exec(fs.readFileSync(MIGRATION, 'utf8')); ok('la migración se aplica sin errores'); }
  catch (e) { bad('aplicar migración', e.message); process.exit(1); }

  // Seed (como el rol postgres = Supabase SQL Editor)
  const P1 = 'aaaaaaaa-0000-0000-0000-000000000001', P2 = 'aaaaaaaa-0000-0000-0000-000000000002', P3 = 'aaaaaaaa-0000-0000-0000-000000000003';
  const V1 = 'bbbbbbbb-0000-0000-0000-000000000001', V2 = 'bbbbbbbb-0000-0000-0000-000000000002';
  const V3 = 'bbbbbbbb-0000-0000-0000-000000000003', V4 = 'bbbbbbbb-0000-0000-0000-000000000004';
  await db.exec(`
    insert into auth.users values ('${ADMIN}'), ('${RANDOM_USER}');
    insert into profiles (id, display_name) values ('${ADMIN}', 'Facundo');
    insert into products (id, name, brand, slug, gender) values
      ('${P1}', 'Sauvage EDT', 'Dior', 'dior-sauvage-edt', 'male'),
      ('${P2}', 'The Most Wanted', 'Azzaro', 'azzaro-the-most-wanted', 'male'),
      ('${P3}', 'Producto oculto', 'X', 'producto-oculto', 'unisex');
    update products set status = 'inactive' where id = '${P3}';
    insert into product_variants (id, product_id, variant_type, size_ml, price) values
      ('${V1}', '${P1}', 'decant', 5, 8000),
      ('${V2}', '${P2}', 'decant', 10, 14000),
      ('${V3}', '${P3}', 'decant', 5, 1000),
      ('${V4}', '${P1}', 'full_bottle', 100, 150000);
    insert into stock_movements (variant_id, movement_type, quantity, note) values
      ('${V1}', 'initial_stock', 30, 'Carga inicial'),
      ('${V2}', 'initial_stock', 5, 'Carga inicial'),
      ('${V3}', 'initial_stock', 5, 'Carga inicial'),
      ('${V4}', 'initial_stock', 1, 'Carga inicial');
  `);
  const stockOf = async (v) => Number((await one(db, `select stock from product_variants where id='${v}'`)).stock);

  console.log('\n[2] Tipos, etiqueta y ledger de stock');
  await expectError(db, 'enum: un género inválido se rechaza',
    `insert into products (name, brand, slug, gender) values ('A', 'B', 'a-b', 'otro')`, 'invalid input value for enum');
  eq('label generado para decant', (await one(db, `select label from product_variants where id='${V1}'`)).label, 'Decant 5 ml');
  eq('label generado para frasco', (await one(db, `select label from product_variants where id='${V4}'`)).label, 'Frasco 100 ml');
  eq('initial_stock carga la caché de stock', await stockOf(V1), 30);
  await expectError(db, 'ledger: signo incorrecto (sale positiva) se rechaza',
    `insert into stock_movements (variant_id, movement_type, quantity) values ('${V1}', 'sale', 3)`, 'quantity_sign_matches_type');
  await expectError(db, 'ledger: ajuste que deja stock negativo se rechaza',
    `insert into stock_movements (variant_id, movement_type, quantity) values ('${V1}', 'adjustment', -500)`, 'stock_check');
  await expectError(db, 'Studio (postgres): editar stock directo se rechaza',
    `update product_variants set stock = 999 where id='${V1}'`, 'STOCK_IS_LEDGER_MANAGED');
  await expectError(db, 'Studio (postgres): crear variante con stock > 0 se rechaza',
    `insert into product_variants (product_id, variant_type, size_ml, price, stock) values ('${P2}', 'decant', 3, 5000, 9)`, 'STOCK_IS_LEDGER_MANAGED');
  await expectError(db, 'Studio (postgres): borrar el historial se rechaza',
    `delete from stock_movements where variant_id='${V2}'`, 'STOCK_LEDGER_IS_APPEND_ONLY');
  eq('editar el precio (sin tocar stock) sigue funcionando',
    (await db.query(`update product_variants set price = 8000 where id='${V1}' returning id`)).rows.length, 1);

  console.log('\n[3] create_order — camino feliz');
  const req1 = randomUUID();
  const r1 = (await one(db, orderCall({ req: req1, items: `[${item(V1, 1)},${item(V2, 1)},${item(V1, 1)}]` }))).r;
  eq('devuelve número FAL-0001', r1.order_number, 'FAL-0001');
  eq('marca que no es duplicado', r1.duplicate, false);
  const o1 = await one(db, `select * from orders where id='${r1.order_id}'`);
  eq('subtotal con precios de la DB (2x8000 + 14000)', o1.subtotal, 30000);
  eq('total generado = subtotal + envío', o1.total, 30000);
  eq('snapshot del nombre del cliente en el pedido', o1.customer_name, 'Juan Pérez');
  eq('variante repetida en el carrito se agrupa en 1 ítem', (await one(db, `select count(*) c from order_items where order_id='${r1.order_id}'`)).c, 2);
  const it = await one(db, `select * from order_items where order_id='${r1.order_id}' and variant_id='${V1}'`);
  eq('snapshot de nombre del producto', it.product_name, 'Sauvage EDT');
  eq('snapshot de etiqueta (desde la columna label)', it.variant_label, 'Decant 5 ml');
  eq('line_total generado', it.line_total, 16000);
  eq('stock descontado (30 - 2)', await stockOf(V1), 28);
  eq('movimientos sale con referencia al pedido',
    (await one(db, `select count(*) c from stock_movements where reference_id='${r1.order_id}' and movement_type='sale'`)).c, 2);

  console.log('\n[4] Idempotencia (doble click / reintento de red)');
  const r1bis = (await one(db, orderCall({ req: req1, items: `[${item(V1, 5)}]` }))).r;
  eq('mismo request_id devuelve el mismo pedido', r1bis.order_number, 'FAL-0001');
  eq('...marcado como duplicado', r1bis.duplicate, true);
  eq('...sin reservar stock otra vez', await stockOf(V1), 28);
  eq('...y sin crear otro pedido', (await one(db, `select count(*) c from orders where request_id='${req1}'`)).c, 1);

  console.log('\n[5] create_order — validaciones con códigos estables (y sin nada a medio crear)');
  const ordersBefore = Number((await one(db, 'select count(*) c from orders')).c);
  await expectError(db, 'stock insuficiente → INSUFFICIENT_STOCK con el variant_id en detail',
    orderCall({ wa: '+5492215550001', items: `[${item(V2, 9)}]` }), 'INSUFFICIENT_STOCK', V2);
  eq('rollback: no quedó pedido huérfano', (await one(db, 'select count(*) c from orders')).c, ordersBefore);
  eq('rollback: el stock no cambió', await stockOf(V2), 4);
  await expectError(db, 'sin request_id → MISSING_REQUEST_ID',
    orderCall({ req: null, items: `[${item(V1, 1)}]` }), 'MISSING_REQUEST_ID');
  await expectError(db, 'carrito vacío → EMPTY_CART', orderCall({ items: '[]' }), 'EMPTY_CART');
  await expectError(db, 'cantidad 0 → INVALID_QUANTITY', orderCall({ items: `[${item(V1, 0)}]` }), 'INVALID_QUANTITY');
  await expectError(db, 'cantidad 11 → INVALID_QUANTITY', orderCall({ items: `[${item(V1, 11)}]` }), 'INVALID_QUANTITY');
  await expectError(db, 'cantidad como texto → INVALID_ITEM', orderCall({ items: `[{"variant_id":"${V1}","quantity":"2"}]` }), 'INVALID_ITEM');
  await expectError(db, 'cantidad decimal → INVALID_ITEM', orderCall({ items: `[{"variant_id":"${V1}","quantity":2.5}]` }), 'INVALID_ITEM');
  await expectError(db, 'variant_id que no es UUID → INVALID_ITEM', orderCall({ items: `[{"variant_id":"abc","quantity":1}]` }), 'INVALID_ITEM');
  await expectError(db, 'producto inactivo → VARIANT_UNAVAILABLE', orderCall({ items: `[${item(V3, 1)}]` }), 'VARIANT_UNAVAILABLE');
  await expectError(db, 'variante inexistente → VARIANT_UNAVAILABLE',
    orderCall({ items: `[${item('bbbbbbbb-0000-0000-0000-00000000dead', 1)}]` }), 'VARIANT_UNAVAILABLE');
  await expectError(db, 'efectivo + envío → CASH_REQUIRES_PICKUP',
    orderCall({ pay: 'cash', delivery: 'delivery', address: 'Calle 7 123', city: 'La Plata', items: `[${item(V1, 1)}]` }), 'CASH_REQUIRES_PICKUP');
  await expectError(db, 'envío sin dirección → ADDRESS_REQUIRED',
    orderCall({ delivery: 'delivery', items: `[${item(V1, 1)}]` }), 'ADDRESS_REQUIRED');
  await expectError(db, 'WhatsApp mal formado → INVALID_WHATSAPP', orderCall({ wa: '221-555-1234', items: `[${item(V1, 1)}]` }), 'INVALID_WHATSAPP');
  await expectError(db, 'nombre de 1 letra → INVALID_NAME', orderCall({ name: 'J', items: `[${item(V1, 1)}]` }), 'INVALID_NAME');
  await expectError(db, 'email inválido → INVALID_EMAIL', orderCall({ email: 'no-es-email', items: `[${item(V1, 1)}]` }), 'INVALID_EMAIL');
  await expectError(db, 'aclaración de 101 caracteres → NOTE_TOO_LONG', orderCall({ note: 'x'.repeat(101), items: `[${item(V1, 1)}]` }), 'NOTE_TOO_LONG');
  await expectError(db, 'método de pago inexistente → INVALID_PAYMENT_METHOD', orderCall({ pay: 'crypto', items: `[${item(V1, 1)}]` }), 'INVALID_PAYMENT_METHOD');
  const envio = (await one(db, orderCall({ wa: '+5492215550002', delivery: 'delivery', address: 'Calle 7 123', city: 'La Plata', items: `[${item(V1, 1)}]` }))).r;
  ok('transferencia + envío con dirección se acepta (' + envio.order_number + ')');

  console.log('\n[6] Anti-abuso y datos del cliente');
  const wa = '+5492215559999';
  await db.exec(orderCall({ wa, name: 'Ana Real', items: `[${item(V1, 1)}]` }));
  await db.exec(orderCall({ wa, name: 'Ana Real', items: `[${item(V1, 1)}]` }));
  await db.exec(orderCall({ wa, name: 'Impostor', items: `[${item(V1, 1)}]` }));
  await expectError(db, '4º pedido pendiente del mismo WhatsApp → TOO_MANY_PENDING_ORDERS',
    orderCall({ wa, items: `[${item(V1, 1)}]` }), 'TOO_MANY_PENDING_ORDERS');
  eq('el mismo WhatsApp reutiliza un único cliente', (await one(db, `select count(*) c from customers where whatsapp='${wa}'`)).c, 1);
  eq('un pedido con otro nombre NO pisa los datos del cliente', (await one(db, `select full_name from customers where whatsapp='${wa}'`)).full_name, 'Ana Real');
  eq('...pero el pedido guarda el nombre con el que se hizo',
    (await one(db, `select count(*) c from orders where customer_name='Impostor'`)).c, 1);
  const sameClient = key();
  for (let i = 0; i < 5; i++) await db.exec(orderCall({ client: sameClient, wa: `+54922155800${i}`, items: `[${item(V1, 1)}]` }));
  await expectError(db, '6º pedido en una hora desde la misma IP → RATE_LIMITED',
    orderCall({ client: sameClient, wa: '+5492215558099', items: `[${item(V1, 1)}]` }), 'RATE_LIMITED');
  await expectError(db, 'sin hash de IP → INVALID_CLIENT_KEY', orderCall({ client: 'corto', items: `[${item(V1, 1)}]` }), 'INVALID_CLIENT_KEY');

  console.log('\n[7] Estados, cancelación e inmutabilidad');
  const stockAntes = await stockOf(V1);
  await db.exec(`update orders set status='cancelled' where id='${r1.order_id}'`);
  eq('cancelar devuelve las 2 unidades', await stockOf(V1), stockAntes + 2);
  await expectError(db, 'un pedido cancelado no se reabre', `update orders set status='pending' where id='${r1.order_id}'`, 'INVALID_STATUS_TRANSITION', 'cancelled -> pending');
  await db.exec(`update orders set status='cancelled' where id='${r1.order_id}'`);
  eq('re-guardar "cancelled" no devuelve stock dos veces', await stockOf(V1), stockAntes + 2);

  // Flujo efectivo + retiro: confirmed → preparing (sin pasar por paid) → ready → completed
  const cash = (await one(db, orderCall({ wa: '+5492215550003', pay: 'cash', items: `[${item(V1, 1)}]` }))).r;
  for (const s of ['confirmed', 'preparing', 'ready_for_pickup', 'completed']) {
    await db.exec(`update orders set status='${s}' where id='${cash.order_id}'`);
  }
  ok('efectivo + retiro: pending → confirmed → preparing → ready_for_pickup → completed');
  await expectError(db, 'un pedido completado no se cancela', `update orders set status='cancelled' where id='${cash.order_id}'`, 'INVALID_STATUS_TRANSITION');
  const transfer = (await one(db, orderCall({ wa: '+5492215550004', items: `[${item(V1, 1)}]` }))).r;
  await db.exec(`update orders set status='confirmed' where id='${transfer.order_id}'`);
  await expectError(db, 'transferencia no salta de confirmed a preparing (falta paid)',
    `update orders set status='preparing' where id='${transfer.order_id}'`, 'INVALID_STATUS_TRANSITION');
  await db.exec(`update orders set status='paid' where id='${transfer.order_id}'; update orders set status='preparing' where id='${transfer.order_id}'`);
  await expectError(db, 'un retiro no puede pasar a "shipped"',
    `update orders set status='shipped' where id='${transfer.order_id}'`, 'INVALID_STATUS_TRANSITION');
  await expectError(db, 'saltear estados (pending → completed) se rechaza',
    `update orders set status='completed' where id='${envio.order_id}'`, 'INVALID_STATUS_TRANSITION');
  await expectError(db, 'Studio (postgres): borrar un pedido se rechaza', `delete from orders where id='${envio.order_id}'`, 'ORDERS_ARE_NOT_DELETED');
  await expectError(db, 'Studio (postgres): editar un ítem se rechaza',
    `update order_items set quantity = 99 where order_id='${envio.order_id}'`, 'ORDER_ITEMS_ARE_IMMUTABLE');

  console.log('\n[8] Cancelación automática de pedidos abandonados');
  const stale = (await one(db, orderCall({ wa: '+5492215550005', items: `[${item(V2, 1)}]` }))).r;
  const fresh = (await one(db, orderCall({ wa: '+5492215550006', items: `[${item(V2, 1)}]` }))).r;
  await db.exec(`update orders set created_at = now() - interval '49 hours' where id='${stale.order_id}'`);
  const stockV2 = await stockOf(V2);
  await db.exec(`select public.cancel_stale_orders(interval '48 hours')`);
  eq('pedido de 49 h queda cancelado', (await one(db, `select status from orders where id='${stale.order_id}'`)).status, 'cancelled');
  eq('pedido reciente sigue pendiente', (await one(db, `select status from orders where id='${fresh.order_id}'`)).status, 'pending');
  eq('...y el stock del abandonado vuelve', await stockOf(V2), stockV2 + 1);
  await db.exec(`update rate_limit_events set created_at = now() - interval '2 days' where id = (select min(id) from rate_limit_events)`);
  eq('purge_rate_limit_events borra eventos viejos', (await one(db, 'select public.purge_rate_limit_events() n')).n, 1);

  console.log('\n[9] Seguridad: navegador (anon)');
  await db.exec('set role anon');
  eq('anon ve solo productos activos', (await one(db, 'select count(*) c from products')).c, 2);
  eq('anon NO ve pedidos', (await one(db, 'select count(*) c from orders')).c, 0);
  eq('anon NO ve clientes', (await one(db, 'select count(*) c from customers')).c, 0);
  await reset(db);
  await expectError(db, 'anon NO puede llamar create_order', `set role anon; ${orderCall({ items: `[${item(V1, 1)}]` })}`, 'permission denied');
  await expectError(db, 'anon NO puede llamar next_order_number (quemar la secuencia)', 'set role anon; select public.next_order_number()', 'permission denied');
  await expectError(db, 'anon NO puede llamar cancel_stale_orders', 'set role anon; select public.cancel_stale_orders()', 'permission denied');
  await expectError(db, 'anon NO puede insertar pedidos directo',
    `set role anon; insert into orders (request_id, customer_id, customer_name, payment_method, delivery_method, subtotal) values (gen_random_uuid(), gen_random_uuid(), 'x', 'transfer', 'pickup', 1)`, 'permission denied');
  await expectError(db, 'anon NO lee el ranking de encargos', 'set role anon; select * from perfume_requests_ranking', 'permission denied');

  console.log('\n[10] Seguridad: usuario logueado que NO es admin');
  await db.exec(asUser);
  eq('usuario común NO ve pedidos', (await one(db, 'select count(*) c from orders')).c, 0);
  eq('usuario común: el UPDATE de precio afecta 0 filas (RLS)', (await db.query(`update product_variants set price = 1 where id='${V1}' returning id`)).rows.length, 0);
  await reset(db);
  eq('...y el precio sigue intacto', (await one(db, `select price from product_variants where id='${V1}'`)).price, 8000);

  console.log('\n[11] Seguridad: admin');
  await db.exec(asAdmin);
  ok('admin ve ' + (await one(db, 'select count(*) c from orders')).c + ' pedidos');
  await db.exec(`update product_variants set price = 9000 where id='${V1}'`);
  ok('admin puede cambiar precios');
  await db.exec(`insert into stock_movements (variant_id, movement_type, quantity, note) values ('${V1}', 'restock', 5, 'Nueva producción')`);
  ok('admin puede reponer stock vía movimiento');
  eq('auditoría: el movimiento queda firmado por el admin',
    (await one(db, `select created_by from stock_movements where note='Nueva producción'`)).created_by, ADMIN);
  await db.exec(`update orders set status='confirmed' where id='${envio.order_id}'; update orders set shipping_cost = 3500 where id='${envio.order_id}'`);
  eq('admin cambia estado y costo de envío; el total se recalcula', (await one(db, `select total from orders where id='${envio.order_id}'`)).total, 8000 + 3500);
  await reset(db);
  await expectError(db, 'admin NO puede cargar un movimiento "sale" a mano',
    `${asAdmin} insert into stock_movements (variant_id, movement_type, quantity) values ('${V1}', 'sale', -1)`, 'row-level security');
  await expectError(db, 'admin NO puede cargar un "order_cancelled" a mano (devolución doble)',
    `${asAdmin} insert into stock_movements (variant_id, movement_type, quantity) values ('${V1}', 'order_cancelled', 1)`, 'row-level security');
  await expectError(db, 'admin NO puede editar stock directo', `${asAdmin} update product_variants set stock = 999 where id='${V1}'`, 'permission denied');
  await expectError(db, 'admin NO puede editar el subtotal de un pedido', `${asAdmin} update orders set subtotal = 1 where id='${envio.order_id}'`, 'permission denied');
  await expectError(db, 'admin NO puede borrar pedidos', `${asAdmin} delete from orders where id='${envio.order_id}'`, 'permission denied');
  eq('el pedido histórico conserva el precio viejo (snapshot)',
    (await one(db, `select unit_price from order_items where order_id='${r1.order_id}' and variant_id='${V1}'`)).unit_price, 8000);

  console.log('\n[12] Resumen público, encargos y numeración');
  const sum = (await one(db, `select public.get_order_summary('${envio.order_id}') s`)).s;
  const raw = JSON.stringify(sum);
  eq('el resumen no expone teléfono ni dirección', raw.includes('5492215550002') || raw.includes('Calle 7'), false);
  eq('el resumen trae los ítems', sum.items.length, 1);
  eq('el resumen usa el nombre del snapshot', sum.customer_first_name, 'Juan');
  await db.exec(`select public.create_perfume_request('${key()}', 'Ana López', '+5492215557777', 'Oud Wood', 'Tom Ford', '100 ml', null)`);
  await db.exec(`select public.create_perfume_request('${key()}', 'Leo Díaz', '+5492215558888', ' oud wood ', 'Tom Ford', '50 ml', null)`);
  eq('el ranking agrupa "Oud Wood" y " oud wood "', (await one(db, `select total_requests from perfume_requests_ranking where perfume_key='oud wood'`)).total_requests, 2);
  await expectError(db, 'encargo de una variante inexistente → VARIANT_NOT_FOUND',
    `select public.create_perfume_request('${key()}', 'Ana López', '+5492215557777', 'Algo', null, null, null, 'bbbbbbbb-0000-0000-0000-00000000dead')`, 'VARIANT_NOT_FOUND');
  await db.exec(`select setval('order_number_seq', 12344)`);
  eq('numeración no se trunca después de 9999', (await one(db, 'select public.next_order_number() n')).n, 'FAL-12345');

  console.log(`\nRESULTADO: ${passed} pasaron, ${failed} fallaron`);
  process.exit(failed ? 1 : 0);
})();
