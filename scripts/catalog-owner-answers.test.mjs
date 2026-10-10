// @vitest-environment node
// The owner's catalog answers as data migrations, run for real in PGlite over
// the catalog as the live database has it:
//   supabase/migrations/20261014100000_delist_kratom_mushroom.sql (AW-001)
//     deactivates exactly the delisted rows (src/data/delisted.js);
//   supabase/migrations/20261014101000_catalog_owner_answers.sql (PR #11's
//     answers) moves #219 to Gifts, rewrites #295 and makes Uncle Al's #350
//     cookies and #351 creme.
// Together they must leave every row exactly as src/data/products.js has it,
// and change nothing when they run again. npm run test:db runs the same
// statements in the full schema (supabase/tests/24_catalog_delisting.sql and
// 25_catalog_owner_answers.sql); this file also checks those tests run the
// files' statements word for word.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CATALOG } from '../src/data/products.js';
import { DELISTED_IDS, DELISTED_LINES, isDelisted } from '../src/data/delisted.js';
import { seedSql } from './seed-sql.mjs';

const read = (path) => readFileSync(resolve(import.meta.dirname, '..', path), 'utf8');
const DELIST = read('supabase/migrations/20261014100000_delist_kratom_mushroom.sql');
const ANSWERS = read('supabase/migrations/20261014101000_catalog_owner_answers.sql');
const DELIST_TEST = read('supabase/tests/24_catalog_delisting.sql');
const ANSWERS_TEST = read('supabase/tests/25_catalog_owner_answers.sql');

// What the live database holds before these files (the previous seed, and
// 20261012130000's name for #350), for the columns they change.
const BEFORE = {
  219: { sub: 'Wellness Pills', description: 'Happy valentines jar from the wellness pill line in our Novelties department. Three varieties: 4 inch, 6 inch and Colored.' },
  295: { description: 'Snack wraps from the chips and crackers line in our Food Stuff department. Two sizes: 40ct and 12ct.' },
  350: { name: "Uncle Al's", img: 'uncle_al_s_cookies.jpg', description: "Uncle Al's cookies, from the cookie line in our Food Stuff department." },
  351: { name: "Uncle Al's cookies", img: 'uncle_al_s_cookies.jpg', variants: ['Lemon ice'], description: "Uncle Al's cookies in single-serve packs. Stocked in one variety: Lemon ice." },
  ...Object.fromEntries(DELISTED_IDS.map((id) => [id, { active: true }])),
};
// Column -> products.js key.
const COLUMNS = { name: 'name', sub: 'sub', description: 'description', img: 'img', variants: 'variants', active: 'active' };

const SCHEMA = `
  create table public.products (
    id integer primary key, name text not null, brand text not null, cat text not null, sub text not null, sku text not null,
    variants jsonb not null default '[]'::jsonb, variant_axis text, unavailable_variants jsonb not null default '[]'::jsonb, img text, tag text,
    active boolean not null default true, description text, sell_unit text not null default '', price numeric(10, 2)
  );
  create unique index products_sku_upper_key on public.products (upper(btrim(sku)));
`;

// The SQL without its comments, statements on one line each.
const statements = (sql) => sql.replace(/--.*$/gm, '').split(';').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
const updates = (sql) => (sql.replace(/--.*$/gm, '').match(/\bupdate public\.products [^;]*/g) || []).map((s) => s.replace(/\s+/g, ' ').trim());
const idsOf = (statement) => {
  const where = / where id (?:= (\d+)|in \(([\d, ]+)\))/.exec(statement);
  return (where[1] ?? where[2]).split(',').map(Number);
};

let db;
const rows = async () => (await db.query(`select id, ${Object.keys(COLUMNS).join(', ')} from public.products order by id`)).rows;
const expected = () => CATALOG.map((p) => ({
  id: p.id,
  name: p.name,
  sub: p.sub,
  description: p.description,
  img: p.img ?? null,
  variants: p.variants || [],
  active: p.active !== false,
})).sort((a, b) => a.id - b.id);

async function liveValues() {
  for (const [id, before] of Object.entries(BEFORE)) {
    for (const [column, value] of Object.entries(before)) {
      await db.query(`update public.products set ${column} = $1 where id = $2`, [column === 'variants' ? JSON.stringify(value) : value, Number(id)]);
    }
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.waitReady;
});
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec('drop schema if exists public cascade; create schema public;');
  await db.exec(SCHEMA);
  await db.exec(seedSql(CATALOG));
});

describe('the delisted rows in products.js (AW-001)', () => {
  it('are exactly the rows of the delisted lines, kept and inactive', () => {
    const delisted = CATALOG.filter((p) => DELISTED_LINES.includes(p.sub)).map((p) => p.id).sort((a, b) => a - b);
    expect(delisted).toEqual([...DELISTED_IDS].sort((a, b) => a - b));
    expect(CATALOG.filter((p) => p.active === false).map((p) => p.id).sort((a, b) => a - b)).toEqual(delisted);
    expect(CATALOG.filter(isDelisted).every((p) => p.active === false)).toBe(true);
  });

  it('leave no kratom, kava or mushroom product anywhere else in the catalog', () => {
    const words = /kratom|\bkava\b|mushroom|shroom|psilocybin|amanita/i;
    const listed = CATALOG.filter((p) => !isDelisted(p));
    expect(listed.filter((p) => words.test(`${p.name} ${p.brand} ${p.sub} ${p.description} ${(p.variants || []).join(' ')}`)).map((p) => p.id)).toEqual([]);
  });
});

describe('20261014100000_delist_kratom_mushroom.sql', () => {
  it('is data only: one update of public.products.active for exactly the delisted ids', () => {
    const all = statements(DELIST);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatch(/^update public\.products set active = false where id in \([\d, ]+\) and active$/);
    expect(idsOf(all[0])).toEqual(DELISTED_IDS);
  });

  it('is what supabase/tests/24_catalog_delisting.sql runs', () => {
    const start = DELIST_TEST.indexOf('create or replace function pg_temp.p24_apply()');
    const body = DELIST_TEST.slice(start, DELIST_TEST.indexOf('end $fn$;', start));
    expect(updates(body)).toEqual(updates(DELIST));
  });
});

describe('20261014101000_catalog_owner_answers.sql', () => {
  it('is data only: updates of public.products, each naming its row and the value it replaces', () => {
    const all = statements(ANSWERS);
    expect(all.length).toBeGreaterThan(0);
    expect(all.filter((s) => !/^update public\.products /.test(s))).toEqual([]);
    for (const s of all) expect(s, s).toMatch(/ where id (= \d+|in \([\d, ]+\)) and (name|sub|description|img|variants|unavailable_variants) = '/);
  });

  it('changes rows #219, #295, #350 and #351 only, never an id, SKU, brand, department or price', () => {
    const ids = new Set(updates(ANSWERS).flatMap(idsOf));
    expect([...ids].sort((a, b) => a - b)).toEqual([219, 295, 350, 351]);
    for (const s of updates(ANSWERS)) {
      const [, column] = /^update public\.products set (\w+) =/.exec(s);
      expect(['name', 'sub', 'description', 'img', 'variants', 'unavailable_variants']).toContain(column);
    }
  });

  it('renames #351 before #350 takes its old name', () => {
    const order = updates(ANSWERS).filter((s) => / set name = /.test(s)).map((s) => idsOf(s)[0]);
    expect(order).toEqual([351, 350]);
  });

  it('is what supabase/tests/25_catalog_owner_answers.sql runs, statement for statement', () => {
    const start = ANSWERS_TEST.indexOf('create or replace function pg_temp.p25_apply()');
    const body = ANSWERS_TEST.slice(start, ANSWERS_TEST.indexOf('end $fn$;', start));
    expect(updates(body)).toEqual(updates(ANSWERS));
  });
});

describe('the two files over the live database', () => {
  it('bring its values to products.js, once', async () => {
    const seeded = await rows();
    expect(seeded).toEqual(expected());
    await liveValues();
    expect(await rows()).not.toEqual(seeded);
    await db.exec(DELIST);
    await db.exec(ANSWERS);
    expect(await rows()).toEqual(expected());
    await db.exec(DELIST);
    await db.exec(ANSWERS);
    expect(await rows()).toEqual(expected());
  });

  it('change nothing on a database seeded from products.js', async () => {
    await db.exec(DELIST);
    await db.exec(ANSWERS);
    expect(await rows()).toEqual(expected());
  });
});
