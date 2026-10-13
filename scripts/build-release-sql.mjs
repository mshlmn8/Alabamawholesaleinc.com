#!/usr/bin/env node
// Writes supabase/release/apply-to-live-database.sql: every migration the live
// Supabase project doesn't have yet, in order, then the product seed, in one
// file the owner pastes into the SQL editor once (SETUP.md, part A).
//
//   npm run release:sql            # regenerate the file; commit the result
//   npm run release:sql -- --check # exit 1 when the committed file is stale
//
// The live project has the migrations up to and including LIVE_BASELINE
// (BACKEND.md, section 2). The file holds every migration after it, word for
// word under a numbered header, and then supabase/seed/products.sql (insert
// only: it adds products whose id is new and never changes a row that is
// there). A guard block first stops the run, changing nothing, on a database
// that isn't at the baseline: an empty project, or one that already has the
// updates from APPLIED.from on (the files before it run again harmlessly;
// from it on they don't, so the guard says so instead of failing midway).
//
// There is no BEGIN/COMMIT: the SQL editor sends the whole file as one query,
// which Postgres runs as one transaction, so a statement that fails leaves
// the database as it was. With psql, run it with
// `psql -v ON_ERROR_STOP=1 --single-transaction -f <file>` for the same.
//
// The SQL editor refuses a query over about 1 MB ("Query is too large to be
// run via the SQL Editor": Supabase Studio, apps/studio/data/sql/
// execute-sql-mutation.ts, checked 2026-10-11), so the file must stay under
// MAX_RELEASE_BYTES or `npm run release:sql` stops. It shows the result of
// the last statement that returns rows: the closing select, DONE_MESSAGE.
// Because the file drops and replaces old policies and functions, the editor
// first asks to confirm "destructive operations" (button "Run query"); every
// table it creates enables row-level security in the same file, so it never
// offers "Run and enable RLS", which would change the file.
//
// scripts/build-release-sql.test.mjs fails when the file is out of date, and
// `npm run test:db` replays it on a copy of the live database
// (scripts/check-migrations.mjs --from-live). Once the owner has applied a
// release file, move LIVE_BASELINE to its last migration and BASELINE_CHECK
// to something that migration creates, point APPLIED at the first new
// migration that can't run twice, and regenerate: the next file then holds
// only what came after.

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The newest migration the live project has (BACKEND.md, section 2). */
export const LIVE_BASELINE = '20260927180000_application_documents.sql';
/** SQL that is true on a database with LIVE_BASELINE (it creates profile_documents). */
export const BASELINE_CHECK = "to_regclass('public.profile_documents') is not null";
/**
 * SQL that is true once the release has (partly) run. Every file before
 * `from` runs again harmlessly on a database that already has it; `from`
 * drops products.flavors, and a second run would stop there, so from it on
 * the guard stops the file first.
 */
export const APPLIED = {
  from: '20261009110000_variant_model.sql',
  check: "not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'flavors')",
};

export const MIGRATIONS_DIR = 'supabase/migrations';
export const SEED_FILE = 'supabase/seed/products.sql';
export const RELEASE_FILE = 'supabase/release/apply-to-live-database.sql';
export const DONE_MESSAGE = 'Done: the live database has every update in this file.';
/**
 * The largest release file the Supabase SQL editor takes with room to spare:
 * Studio refuses a query over 0.98 MiB (1,027,604 bytes). Past this, split the
 * release in two files rather than raise it.
 */
export const MAX_RELEASE_BYTES = 900 * 1024;

const RULE = `-- ${'='.repeat(77)}`;

/** The migration file names after `baseline`, in the order they run. */
export function pendingMigrations(names, baseline = LIVE_BASELINE) {
  return names.filter((n) => n.endsWith('.sql')).sort().filter((n) => n > baseline);
}

const sectionHeader = (index, total, title, lines) => [
  '',
  RULE,
  `-- ${index} of ${total}: ${title}`,
  ...lines.map((l) => (l ? `-- ${l}` : '--')),
  RULE,
  '',
].join('\n');

/**
 * The release file's text. Throws when it would be too large for the SQL editor.
 * @param {{ migrations: {name: string, sql: string}[], seed: {name: string, sql: string},
 *           baseline?: string, baselineCheck?: string, applied?: {from: string, check: string},
 *           maxBytes?: number }} parts
 */
export function releaseSql({
  migrations, seed, baseline = LIVE_BASELINE, baselineCheck = BASELINE_CHECK, applied = APPLIED,
  maxBytes = MAX_RELEASE_BYTES,
}) {
  if (!migrations.length) throw new Error('build-release-sql: no migration after the live baseline');
  const total = migrations.length + 1;
  const first = migrations[0].name;
  const last = migrations[migrations.length - 1].name;
  const contents = [
    ...migrations.map((m, i) => `${String(i + 1).padStart(String(total).length)}. ${m.name}`),
    `${total}. ${seed.name} (the product seed)`,
  ];
  const head = [
    RULE,
    '-- Alabama Wholesale: bring the live database up to date',
    RULE,
    '--',
    `-- Every database update the live Supabase project doesn't have yet, in order,`,
    `-- in one file. The live project has the updates up to and including`,
    `-- ${baseline}; this file has the ${migrations.length} after it`,
    `-- (${first.slice(0, 14)} to ${last.slice(0, 14)}), then the product seed.`,
    '--',
    '-- How to run it (SETUP.md, part A): back up the database first. Then in',
    '-- Supabase open SQL Editor, start a new query, paste this whole file and',
    '-- click Run. Supabase asks to confirm because the file replaces old rules',
    '-- ("destructive operations"): click Run query. It runs as one unit: if any',
    '-- statement fails, nothing in the file is applied, and the error says where',
    '-- it stopped. When it has worked, the result at the bottom says:',
    `--   ${DONE_MESSAGE}`,
    '--',
    '-- Run it once, on the live project. It refuses to run, and changes nothing,',
    `-- on a database without the updates up to ${baseline.slice(0, 14)} (a new, empty`,
    '-- project needs every file in supabase/migrations instead: BACKEND.md,',
    `-- section 2), or on one that already has the updates from ${applied.from.slice(0, 14)} on.`,
    '--',
    '-- Generated by `npm run release:sql` (scripts/build-release-sql.mjs) from',
    `-- ${MIGRATIONS_DIR}/ and ${SEED_FILE}. Don't edit it by hand: change`,
    '-- or add a migration, then regenerate. scripts/build-release-sql.test.mjs',
    '-- fails when this file is out of date.',
    '--',
    '-- Contents:',
    ...contents.map((c) => `--   ${c}`),
    '',
    RULE,
    '-- Check: is this the live database, without these updates yet?',
    RULE,
    '',
    'do $$',
    'begin',
    `  if not (${baselineCheck}) then`,
    `    raise exception 'This database doesn''t have the updates up to ${baseline}, so this file is not for it. Nothing was changed.'`,
    `      using hint = 'A new, empty Supabase project needs every file in supabase/migrations, in order (BACKEND.md, section 2).';`,
    '  end if;',
    `  if ${applied.check} then`,
    `    raise exception 'This database already has some or all of these updates (${applied.from} or a later one ran). Nothing was changed.'`,
    `      using hint = 'Apply only the files it doesn''t have yet, one at a time and in order (BACKEND.md, release checklist).';`,
    '  end if;',
    'end $$;',
  ].join('\n');

  const body = migrations.map((m, i) => [
    sectionHeader(i + 1, total, m.name, [`${MIGRATIONS_DIR}/${m.name}, word for word.`]),
    m.sql.trimEnd(),
    '',
  ].join('\n'));

  const seedPart = [
    sectionHeader(total, total, seed.name, [
      `${SEED_FILE}, word for word: adds the products whose id is new and`,
      'never changes a product that is already there (prices, names and the',
      'active flag staff set in Admin stay as they are).',
    ]),
    seed.sql.trimEnd(),
    '',
  ].join('\n');

  const tail = [
    '',
    RULE,
    '-- Finished',
    RULE,
    '',
    `select '${DONE_MESSAGE}' as result;`,
    '',
  ].join('\n');

  const text = `${head}\n${body.join('')}${seedPart}${tail}`;
  const bytes = Buffer.byteLength(text);
  if (bytes > maxBytes) {
    throw new Error(`build-release-sql: the release file would be ${bytes} bytes, over the ${maxBytes} the Supabase SQL editor takes safely; split it in two files`);
  }
  return text;
}

/** Reads the migrations and the seed from the repository and returns the release file's text. */
export function buildRelease(root = ROOT) {
  const dir = path.join(root, MIGRATIONS_DIR);
  const names = readdirSync(dir);
  if (!names.includes(LIVE_BASELINE)) throw new Error(`build-release-sql: ${LIVE_BASELINE} is not in ${MIGRATIONS_DIR}`);
  const migrations = pendingMigrations(names).map((name) => ({ name, sql: readFileSync(path.join(dir, name), 'utf8') }));
  const seed = { name: path.basename(SEED_FILE), sql: readFileSync(path.join(root, SEED_FILE), 'utf8') };
  return releaseSql({ migrations, seed });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const out = path.join(ROOT, RELEASE_FILE);
  const text = buildRelease();
  if (process.argv.includes('--check')) {
    let current = '';
    try { current = readFileSync(out, 'utf8'); } catch { /* missing counts as stale */ }
    if (current !== text) {
      console.error(`build-release-sql: ${RELEASE_FILE} is out of date; run npm run release:sql and commit it.`);
      process.exit(1);
    }
    console.log(`build-release-sql: ${RELEASE_FILE} is up to date.`);
  } else {
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, text);
    const count = pendingMigrations(readdirSync(path.join(ROOT, MIGRATIONS_DIR))).length;
    console.log(`build-release-sql: wrote ${RELEASE_FILE} (${count} migrations after ${LIVE_BASELINE.slice(0, 14)}, then the seed).`);
  }
}
