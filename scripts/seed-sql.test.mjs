// @vitest-environment node
// The seed's id and SKU guard (NEW-022), run for real in PGlite against a
// products table shaped like the live one after 20261010120000 (an id
// sequence and the upper(btrim(sku)) unique index). npm run test:db applies
// the seed to a fresh database once; this file applies it again over
// products an admin created.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { COLUMNS, seedGuardSql, seedSql } from './seed-sql.mjs';

const SEED = readFileSync(resolve(import.meta.dirname, '../supabase/seed/products.sql'), 'utf8');

const SCHEMA = `
  create sequence public.products_id_seq;
  create table public.products (
    id integer primary key default nextval('public.products_id_seq'),
    name text not null, brand text not null, cat text not null, sub text not null, sku text not null,
    variants jsonb not null default '[]'::jsonb, variant_axis text, img text, tag text,
    active boolean not null default true, description text, sell_unit text, price numeric(10, 2)
  );
  create unique index products_sku_upper_key on public.products (upper(btrim(sku)));
`;

const row = (id, sku, extra = {}) => ({ id, sku, name: `Seed ${id}`, brand: 'Brand', cat: 'CANDIES', sub: 'Line', variants: [], description: `Seed row ${id}.`, sellUnit: '', ...extra });

let db;
let notices;
const run = (sql) => db.exec(sql, { onNotice: (notice) => notices.push(notice.message) });
const failure = (sql) => run(sql).then(() => null, (error) => error);
const products = async () => (await db.query('select id, sku, name from public.products order by id')).rows;
// What Admin -> Products does: no id, so the sequence gives the next one.
const adminInsert = async (sku, name = 'Admin product') => (await db.query(
  "insert into public.products (name, brand, cat, sub, sku) values ($1, 'Admin', 'CANDIES', 'Line', $2) returning id", [name, sku],
)).rows[0].id;

beforeEach(async () => {
  db = new PGlite();
  notices = [];
  await db.exec(SCHEMA);
});
afterEach(async () => {
  await db.close();
});

describe('the committed seed (supabase/seed/products.sql)', () => {
  it('applies to an empty table, and again over itself, without a notice or an error', async () => {
    await run(SEED);
    const first = await products();
    expect(first.length).toBe(Number(/Seed catalog: (\d+) SKUs/.exec(SEED)[1]));
    await run(SEED);
    expect(await products()).toEqual(first);
    expect(notices).toEqual([]);
    // The sequence footer moved past the seeded ids, so the next admin product gets a new one.
    expect(await adminInsert('AW-SEED-TEST-NEXT')).toBe(Math.max(...first.map((p) => p.id)) + 1);
  });

  it('runs the guard before the insert, and keeps on conflict (id), never a bare on conflict do nothing', () => {
    const guard = SEED.indexOf('-- Ids and SKUs (NEW-022)');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(SEED.indexOf('insert into public.products ('));
    expect(SEED).toMatch(/raise notice 'Seed rows skipped/);
    expect(SEED).toMatch(/raise exception 'Seed not applied/);
    expect(SEED).toMatch(/^on conflict \(id\) do nothing;$/m);
    expect(SEED).not.toMatch(/on conflict do nothing/i);
  });

  it('names a seed id an admin-created product already took, and keeps that product', async () => {
    await run(SEED);
    const taken = await adminInsert('AW-SEED-TEST-ADMIN', 'Made in Admin');
    notices = [];
    // A developer adds the next id to products.js without checking the live max(id).
    await run(seedSql([row(taken, 'AW-SEED-TEST-NEW')]));
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatch(new RegExp(`^Seed rows skipped: .*${taken} \\(seed SKU AW-SEED-TEST-NEW, database SKU AW-SEED-TEST-ADMIN\\)`));
    expect(notices[0]).toMatch(/give a new products\.js row an id above select max\(id\) from public\.products/);
    expect((await products()).find((p) => p.id === taken)).toEqual({ id: taken, sku: 'AW-SEED-TEST-ADMIN', name: 'Made in Admin' });
  });
});

describe('seedSql guard (NEW-022)', () => {
  it('stops before inserting anything when a new seed id has a SKU another product uses, in any case or spacing', async () => {
    await run(seedSql([row(1, 'AW-ONE')]));
    const adminId = await adminInsert('AW-CLASH');
    const err = await failure(seedSql([row(1, 'AW-ONE'), row(50, ' aw-clash '), row(51, 'AW-FINE')]));
    expect(err?.message).toBe(`Seed not applied: these SKUs are already used by another product: AW-CLASH (seed id 50, database id ${adminId})`);
    expect(err?.hint).toMatch(/another SKU, or the id the database already has for it/);
    // Not even the row without a clash went in.
    expect((await products()).map((p) => p.id)).toEqual([1, adminId]);
  });

  it('only notes a skipped row whose SKU is also used elsewhere, since the insert skips it by id', async () => {
    await run(seedSql([row(1, 'AW-ONE'), row(2, 'AW-TWO')]));
    // An admin renames #2's SKU and gives its old SKU to a new product.
    await db.exec("update public.products set sku = 'AW-TWO-B' where id = 2");
    const adminId = await adminInsert('AW-TWO');
    notices = [];
    await run(seedSql([row(1, 'AW-ONE'), row(2, 'AW-TWO')]));
    expect(notices).toEqual([expect.stringMatching(/: 2 \(seed SKU AW-TWO, database SKU AW-TWO-B\)\. /)]);
    expect(await products()).toEqual([
      { id: 1, sku: 'AW-ONE', name: 'Seed 1' },
      { id: 2, sku: 'AW-TWO-B', name: 'Seed 2' },
      { id: adminId, sku: 'AW-TWO', name: 'Admin product' },
    ]);
  });

  it('says nothing about rows whose SKU differs only in case or spacing', async () => {
    await run(seedSql([row(1, 'AW-ONE')]));
    await db.exec("update public.products set sku = ' aw-one' where id = 1");
    notices = [];
    await run(seedSql([row(1, 'AW-ONE'), row(2, 'AW-TWO')]));
    expect(notices).toEqual([]);
    expect((await products()).map((p) => p.id)).toEqual([1, 2]);
  });

  it('lists every skipped id in one notice, in id order', async () => {
    await run(seedSql([row(3, 'AW-3'), row(4, 'AW-4')]));
    await db.exec("update public.products set sku = sku || '-X'");
    notices = [];
    await run(seedSql([row(4, 'AW-4'), row(3, 'AW-3'), row(5, 'AW-5')]));
    expect(notices).toHaveLength(1);
    expect(notices[0]).toContain('3 (seed SKU AW-3, database SKU AW-3-X), 4 (seed SKU AW-4, database SKU AW-4-X)');
    expect((await products()).map((p) => p.id)).toEqual([3, 4, 5]);
  });

  it('quotes SKUs safely and seeds the documented columns', () => {
    expect(seedGuardSql([row(7, "AW-O'BRIEN")])).toContain("(7, 'AW-O''BRIEN')");
    expect(COLUMNS).toEqual(['id', 'name', 'brand', 'cat', 'sub', 'sku', 'variants', 'variant_axis', 'img', 'tag', 'active', 'description', 'sell_unit']);
  });
});
