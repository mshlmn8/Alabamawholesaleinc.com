// @vitest-environment node
// supabase/migrations/20261012130000_catalog_fixups.sql, run for real in
// PGlite over the catalog as the live database has it (the values the seed
// wrote before), must leave every row exactly as src/data/products.js has it,
// and change nothing when it runs again. npm run test:db runs the same update
// statements in the full schema (supabase/tests/22_catalog_fixups.sql); this
// file also checks that test runs the file's statements word for word.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CATALOG } from '../src/data/products.js';
import { seedSql } from './seed-sql.mjs';

const read = (path) => readFileSync(resolve(import.meta.dirname, '..', path), 'utf8');
const MIGRATION = read('supabase/migrations/20261012130000_catalog_fixups.sql');
const DB_TEST = read('supabase/tests/22_catalog_fixups.sql');

// What each row held before this migration (the previous seed, and the live
// database until the file is applied), for the columns it changes.
// #350's is the name 20261011130000_catalog_names.sql gave it.
const BEFORE = {
  13: { description: 'Havana leaf wraps from the wraps and leaf line in our Tobacco department. Eight flavors: Milk cookies, Sweet aromatic, Strawberry, 8 Miles, Russian cream, Purple, Yellow and Honey bourbon.' },
  65: { name: 'RAZ Vue Full kit', description: 'RAZ Vue Full kit from the disposable vape line in our Novelties department.' },
  83: { sku: 'AW-DUTCH-MASTER' },
  90: { sku: 'AW-BAGS' },
  121: { sku: 'AW-PLASTIC' },
  143: { sku: 'AW-RED-BULL-12OZ' },
  183: { description: 'Extra gum from the gum and mints line in our Candies department. Five flavors: Watermelon, Spearmint, Peppermint, Polar ice and Winterfresh.' },
  193: { description: 'Pure eyes from the OTC and health line in our Merchandise department.' },
  213: { description: 'Lil leaf wraps from the wraps and leaf line in our Tobacco department. Stocked in one variety: Original.' },
  260: { description: 'Backwoods true wraps from the wraps and leaf line in our Tobacco department. Three flavors: Original, Vanilla and Aromatic.' },
  350: { name: "Uncle Al's cookies" },
};
const COLUMNS = { sku: 'sku', name: 'name', description: 'description', sell_unit: 'sellUnit' };

const SCHEMA = `
  create table public.products (
    id integer primary key, name text not null, brand text not null, cat text not null, sub text not null, sku text not null,
    variants jsonb not null default '[]'::jsonb, variant_axis text, img text, tag text,
    active boolean not null default true, description text, sell_unit text not null default '', price numeric(10, 2)
  );
  create unique index products_sku_upper_key on public.products (upper(btrim(sku)));
`;

// The SQL without its comments, statements on one line each.
const statements = (sql) => sql.replace(/--.*$/gm, '').split(';').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
const updates = (sql) => (sql.replace(/--.*$/gm, '').match(/\bupdate public\.products [^;]*/g) || []).map((s) => s.replace(/\s+/g, ' ').trim());

let db;
const rows = async () => (await db.query(`select id, ${Object.keys(COLUMNS).join(', ')} from public.products order by id`)).rows;
const expected = () => CATALOG.map((p) => ({ id: p.id, ...Object.fromEntries(Object.entries(COLUMNS).map(([column, key]) => [column, p[key] ?? ''])) }))
  .sort((a, b) => a.id - b.id);

beforeEach(async () => {
  db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(seedSql(CATALOG));
});
afterEach(async () => {
  await db.close();
});

describe('20261012130000_catalog_fixups.sql', () => {
  it('is data only: updates of public.products and nothing else', () => {
    const all = statements(MIGRATION);
    expect(all.length).toBeGreaterThan(0);
    expect(all.filter((s) => !/^update public\.products /.test(s))).toEqual([]);
    // Every update names its row and the value it replaces.
    for (const s of all) expect(s, s).toMatch(/ where id (= \d+|in \([\d, ]+\)) and (sku|name|description|sell_unit) = '/);
  });

  it('changes exactly the rows listed here, and those only in the columns listed here', () => {
    const ids = new Set();
    for (const s of updates(MIGRATION)) {
      const where = / where id (?:= (\d+)|in \(([\d, ]+)\))/.exec(s);
      for (const id of (where[1] ?? where[2]).split(',')) ids.add(Number(id));
      const [, column] = /^update public\.products set (\w+) =/.exec(s);
      expect(Object.keys(COLUMNS)).toContain(column);
    }
    expect([...ids].sort((a, b) => a - b)).toEqual(Object.keys(BEFORE).map(Number));
  });

  it('brings the live database\'s values to products.js, once', async () => {
    const seeded = await rows();
    expect(seeded).toEqual(expected());
    for (const [id, before] of Object.entries(BEFORE)) {
      for (const [column, value] of Object.entries(before)) {
        await db.query(`update public.products set ${column} = $1 where id = $2`, [value, Number(id)]);
      }
    }
    expect(await rows()).not.toEqual(seeded);
    await db.exec(MIGRATION);
    expect(await rows()).toEqual(expected());
    await db.exec(MIGRATION);
    expect(await rows()).toEqual(expected());
  });

  it('changes nothing on a database seeded from products.js', async () => {
    await db.exec(MIGRATION);
    expect(await rows()).toEqual(expected());
  });

  it('is what supabase/tests/22_catalog_fixups.sql runs, statement for statement', () => {
    const start = DB_TEST.indexOf('create or replace function pg_temp.p22_apply()');
    const body = DB_TEST.slice(start, DB_TEST.indexOf('end $fn$;', start));
    expect(updates(body)).toEqual(updates(MIGRATION));
  });
});
