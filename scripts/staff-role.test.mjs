// @vitest-environment node
// supabase/migrations/20261014120000_staff_role.sql recreates eight admin
// functions and alters the admin policies so approved staff pass them
// (AW-030, owner answer 2026-10). This replays every migration before it in
// PGlite, then the file itself, and checks that it changed exactly
// is_admin() to is_staff_or_admin() and nothing else: each function is its
// previous definition word for word, each policy keeps its command, roles
// and expression, and only writing the pricing tiers (and is_admin() itself)
// stays admin-only. supabase/tests/28_staff_role.sql checks what staff,
// admins and customers may do.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SUPABASE_STUB } from './pglite-stub.mjs';

const DIR = resolve(import.meta.dirname, '..', 'supabase', 'migrations');
const STAFF = '20261014120000_staff_role.sql';
const FUNCTIONS = [
  'admin_product_prices', 'admin_price_order', 'admin_convert_quote', 'admin_bulk_adjust_prices', 'admin_import_products',
  'admin_set_order_status', 'admin_mark_orders_seen', 'admin_import_products_v2',
];
// The policies that stay admin-only.
const ADMIN_ONLY = ['public.pricing_tiers.pricing_tiers_admin_write'];

const functions = async (db) => Object.fromEntries((await db.query(`
  select p.proname as name, pg_get_functiondef(p.oid) as def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
`)).rows.map((r) => [r.name, r.def]));
const policies = async (db) => Object.fromEntries((await db.query(`
  select schemaname || '.' || tablename || '.' || policyname as key, cmd, roles::text as roles, qual, with_check
  from pg_policies
`)).rows.map(({ key, ...rest }) => [key, rest]));
const usesIsAdmin = (text) => /\bis_admin\(\)/.test(text || '');
const swapped = (text) => (text == null ? text : text.replace(/\bis_admin\(\)/g, 'is_staff_or_admin()'));

let db;
let before;
let after;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
  expect(files).toContain(STAFF);
  for (const file of files.filter((f) => f < STAFF)) await db.exec(readFileSync(resolve(DIR, file), 'utf8'));
  before = { functions: await functions(db), policies: await policies(db) };
  await db.exec(readFileSync(resolve(DIR, STAFF), 'utf8'));
  after = { functions: await functions(db), policies: await policies(db) };
});
afterAll(async () => {
  await db?.close();
});

describe(STAFF, () => {
  it('recreates each admin function as it was, with is_staff_or_admin() for is_admin()', () => {
    for (const name of FUNCTIONS) {
      expect(usesIsAdmin(before.functions[name]), `${name} called is_admin()`).toBe(true);
      expect(after.functions[name], name).toBe(before.functions[name].replace(/public\.is_admin\(\)/g, 'public.is_staff_or_admin()'));
    }
  });

  it('leaves no other function calling is_admin() but the profile guard, which keeps the admin rules', () => {
    const still = Object.entries(after.functions).filter(([name, def]) => name !== 'is_admin' && usesIsAdmin(def.replace(/--.*$/gm, ''))).map(([name]) => name);
    expect(still).toEqual(['protect_profile_columns']);
    expect(after.functions.is_admin).toBe(before.functions.is_admin);
    expect(after.functions.protect_profile_columns).toMatch(/is_staff_or_admin\(\)/);
  });

  it('opens every admin policy to approved staff, except writing the pricing tiers', () => {
    const admin = Object.keys(before.policies).filter((key) => usesIsAdmin(before.policies[key].qual) || usesIsAdmin(before.policies[key].with_check));
    // The 29 policies that called is_admin() before this file.
    expect(admin.length).toBe(29);
    for (const key of admin) {
      const was = before.policies[key];
      const now = after.policies[key];
      expect(now, key).toBeDefined();
      expect([now.cmd, now.roles], key).toEqual([was.cmd, was.roles]);
      if (ADMIN_ONLY.includes(key)) {
        expect(now, key).toEqual(was);
      } else {
        expect({ qual: now.qual, with_check: now.with_check }, key).toEqual({ qual: swapped(was.qual), with_check: swapped(was.with_check) });
      }
    }
    // Nothing else changed, and no policy was added or dropped.
    expect(Object.keys(after.policies).sort()).toEqual(Object.keys(before.policies).sort());
    for (const key of Object.keys(before.policies).filter((k) => !admin.includes(k))) expect(after.policies[key], key).toEqual(before.policies[key]);
  });
});
