// Replays supabase/migrations/*.sql (and, with --seed, supabase/seed/*.sql) in
// an in-memory Postgres (PGlite) with stubbed Supabase auth/storage schemas and
// the anon/authenticated/service_role roles, then runs the assertion files in
// supabase/tests/*.sql. Nothing connects to a real database.
//
//   npm run test:db                                   # both checks below
//   node scripts/check-migrations.mjs [--seed] [--test file.sql ...] [--repo <dir>]
//   node scripts/check-migrations.mjs --from-live [--repo <dir>]
//
// Passing --test runs only the named files instead of supabase/tests/*.sql.
//
// --from-live checks the owner's release file instead of a fresh install. It
// builds a copy of the live project: the migrations up to LIVE_BASELINE
// (scripts/build-release-sql.mjs), then supabase/tests/live-baseline/before-*.sql
// (the products table as the live project has it, with made-up prices, and
// live-like accounts, documents and orders made through the live functions).
// Then it runs supabase/release/apply-to-live-database.sql and checks that
// the result has the same tables, columns, functions, policies, triggers,
// constraints, indexes, grants, buckets and catalog rows as a fresh install
// (prices aside). It checks the guard at the top of the file: an empty
// project is refused, unchanged, and a copy that already ran the files
// before APPLIED.from by hand takes the file and matches a fresh install too.
// Then it runs supabase/tests/live-baseline/after-release.sql (the live data
// afterwards), the seed's other files (provision_owner.sql) and every
// supabase/tests/*.sql, and finally checks that running the release file
// again stops at its guard, changing nothing.
//
// Inside a test file, impersonate a user with:
//   select test_login('<uuid>');   -- sets auth.uid() and switches to role authenticated
//   select test_anon();            -- role anon, no uid
//   select test_reset();           -- back to the superuser
// Use `do $$ begin ... assert ...; end $$;` blocks for assertions; a failed
// assert fails the run. The exit code is non-zero on the first error, and the
// failing file and statement are printed.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUPABASE_STUB } from './pglite-stub.mjs';
import { APPLIED, LIVE_BASELINE, RELEASE_FILE, SEED_FILE } from './build-release-sql.mjs';

const args = process.argv.slice(2);
const argValue = (flag) => { const i = args.indexOf(flag); return i === -1 ? null : args[i + 1]; };
const repo = path.resolve(argValue('--repo') || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const withSeed = args.includes('--seed');
const fromLive = args.includes('--from-live');
const explicitTests = [];
args.forEach((a, i) => { if (a === '--test') explicitTests.push(path.resolve(args[i + 1])); });

const sqlFiles = (dir) => (fs.existsSync(dir)
  ? fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => path.join(dir, f))
  : []);
const read = (f) => fs.readFileSync(f, 'utf8');

function fail(label, message) {
  console.error(`FAIL ${label}\n     ${message}`);
  process.exit(1);
}

async function run(db, label, sql) {
  try {
    await db.exec(sql);
    console.log(`ok   ${label}`);
  } catch (e) {
    let message = `${e.message}${e.position ? ` (at char ${e.position})` : ''}`;
    if (e.position) {
      const pos = Number(e.position);
      message += '\n     …' + sql.slice(Math.max(0, pos - 160), pos + 80).replace(/\n/g, '\n     ') + '…';
    }
    fail(label, message);
  }
}

const migrations = sqlFiles(path.join(repo, 'supabase', 'migrations'));
if (migrations.length === 0) {
  console.error(`No migrations found under ${path.join(repo, 'supabase', 'migrations')}`);
  process.exit(2);
}
const seeds = sqlFiles(path.join(repo, 'supabase', 'seed'));
const tests = explicitTests.length ? explicitTests : sqlFiles(path.join(repo, 'supabase', 'tests'));

async function runTests(db) {
  for (const t of tests) {
    await run(db, `test ${path.basename(t)}`, read(t));
    await db.exec('select test_reset();').catch(() => {});
  }
}

async function freshInstall({ seed }) {
  const db = new PGlite();
  await run(db, 'supabase stubs', SUPABASE_STUB);
  for (const f of migrations) await run(db, `migration ${path.basename(f)}`, read(f));
  if (seed) for (const f of seeds) await run(db, `seed ${path.basename(f)}`, read(f));
  return db;
}

// What must be the same after the release file as after a fresh install.
// Timestamps differ by nature; prices differ because the live table has its
// own (the seed has none).
const SCHEMA_QUERIES = {
  columns: `select table_schema || '.' || table_name || '.' || column_name || ' ' || data_type || ' ' || is_nullable || ' ' || coalesce(column_default, '') as k
    from information_schema.columns where table_schema in ('public', 'storage')`,
  functions: `select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') ' || md5(pg_get_functiondef(p.oid)) as k
    from pg_proc p where p.pronamespace = 'public'::regnamespace`,
  policies: `select schemaname || '.' || tablename || '.' || policyname || ' ' || cmd || ' ' || array_to_string(roles, ',') || ' ' || coalesce(qual, '') || ' ' || coalesce(with_check, '') as k
    from pg_policies`,
  triggers: `select tgrelid::regclass || '.' || tgname || ' ' || md5(pg_get_triggerdef(oid)) as k from pg_trigger where not tgisinternal`,
  constraints: `select conrelid::regclass || '.' || conname || ' ' || pg_get_constraintdef(oid) as k from pg_constraint where connamespace = 'public'::regnamespace`,
  indexes: `select indexname || ' ' || indexdef as k from pg_indexes where schemaname = 'public'`,
  'table grants': `select grantee || ' ' || table_name || ' ' || privilege_type as k from information_schema.role_table_grants where table_schema = 'public'`,
  'column grants': `select grantee || ' ' || table_name || '.' || column_name || ' ' || privilege_type as k from information_schema.column_privileges where table_schema = 'public'`,
  'function grants': `select grantee || ' ' || routine_name || ' ' || privilege_type as k from information_schema.routine_privileges where routine_schema = 'public'`,
  buckets: `select id || ' ' || public || ' ' || coalesce(file_size_limit::text, '') || ' ' || coalesce(array_to_string(allowed_mime_types, ','), '') as k from storage.buckets`,
  'row-level security': `select relname || ' ' || relrowsecurity as k from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'`,
};
const DATA_TABLES = { products: ['price', 'updated_at'], home_slides: ['created_at', 'updated_at'], site_settings: ['updated_at'], pricing_tiers: [] };

async function snapshot(db) {
  const out = {};
  for (const [name, q] of Object.entries(SCHEMA_QUERIES)) out[name] = (await db.query(`${q} order by 1`)).rows.map((r) => r.k);
  for (const [table, skip] of Object.entries(DATA_TABLES)) {
    const cols = (await db.query(`select column_name from information_schema.columns
      where table_schema = 'public' and table_name = $1 order by ordinal_position`, [table])).rows
      .map((r) => r.column_name).filter((c) => !skip.includes(c));
    out[`${table} rows`] = (await db.query(`select ${cols.map((c) => `"${c}"`).join(', ')} from public.${table} order by 1`)).rows
      .map((r) => JSON.stringify(r));
  }
  return out;
}

function compare(fresh, upgraded) {
  const problems = [];
  for (const name of Object.keys(fresh)) {
    const a = new Set(fresh[name]);
    const b = new Set(upgraded[name]);
    const onlyFresh = fresh[name].filter((x) => !b.has(x));
    const onlyUpgraded = upgraded[name].filter((x) => !a.has(x));
    if (onlyFresh.length || onlyUpgraded.length) {
      problems.push(`${name}: ${onlyFresh.length} only in a fresh install, ${onlyUpgraded.length} only after the release file`,
        ...onlyFresh.slice(0, 5).map((x) => `  fresh:   ${x.slice(0, 200)}`),
        ...onlyUpgraded.slice(0, 5).map((x) => `  release: ${x.slice(0, 200)}`));
    }
  }
  return problems;
}

if (!fromLive) {
  const db = await freshInstall({ seed: withSeed });
  await runTests(db);
  await db.close();
  console.log(`all passed (${migrations.length} migrations${withSeed ? ', seed' : ''}, ${tests.length} test files)`);
} else {
  const releasePath = path.join(repo, RELEASE_FILE);
  if (!fs.existsSync(releasePath)) fail('release file', `${RELEASE_FILE} is missing: run npm run release:sql`);
  const release = read(releasePath);
  const baselineDir = path.join(repo, 'supabase', 'tests', 'live-baseline');
  const before = sqlFiles(baselineDir).filter((f) => path.basename(f).startsWith('before-'));
  const after = sqlFiles(baselineDir).filter((f) => path.basename(f).startsWith('after-'));
  const live = migrations.filter((f) => path.basename(f) <= LIVE_BASELINE);
  if (path.basename(live[live.length - 1] || '') !== LIVE_BASELINE) fail('live baseline', `${LIVE_BASELINE} is not in supabase/migrations`);

  // A copy of the live project, plus any later files `byHand` (applied in the
  // SQL editor before the release file).
  async function liveCopy({ byHand = [], quiet = false } = {}) {
    const copy = new PGlite();
    const step = quiet ? (label, sql) => copy.exec(sql).catch((e) => fail(label, e.message)) : (label, sql) => run(copy, label, sql);
    await step('supabase stubs', SUPABASE_STUB);
    for (const f of live) await step(`migration ${path.basename(f)}`, read(f));
    for (const f of before) await step(`live data ${path.basename(f)}`, read(f));
    for (const f of byHand) await step(`by hand ${path.basename(f)}`, read(f));
    return copy;
  }

  console.log(`-- a copy of the live project (migrations up to ${LIVE_BASELINE.slice(0, 14)}, live-like data)`);
  const db = await liveCopy();
  await run(db, `release ${RELEASE_FILE}`, release);

  console.log('-- compared with a fresh install');
  const fresh = await freshInstall({ seed: false });
  await run(fresh, `seed ${path.basename(SEED_FILE)}`, read(path.join(repo, SEED_FILE)));
  const freshSnapshot = await snapshot(fresh);
  await fresh.close();
  const problems = compare(freshSnapshot, await snapshot(db));
  if (problems.length) fail('release file matches a fresh install', problems.join('\n     '));
  console.log(`ok   same schema, grants, buckets and catalog as a fresh install (${Object.keys(SCHEMA_QUERIES).length} schema checks, ${Object.keys(DATA_TABLES).length} tables)`);

  console.log('-- the guard at the top of the release file');
  // An empty project: refused before anything runs.
  const empty = new PGlite();
  await empty.exec(SUPABASE_STUB);
  const refused = await empty.exec(release).then(() => null, (e) => e);
  if (!refused || !/doesn't have the updates up to/.test(refused.message)) fail('release file on an empty project', refused ? refused.message : 'it ran');
  if ((await empty.query("select to_regclass('public.products') is null as untouched")).rows[0].untouched !== true) fail('release file on an empty project', 'it changed the database');
  await empty.close();
  console.log('ok   an empty project is refused, unchanged');
  // The files before APPLIED.from run again harmlessly (BACKEND.md, "The
  // release file"): a copy that already ran all of them by hand takes the file
  // and ends up like a fresh install.
  const handApplied = migrations.filter((f) => path.basename(f) > LIVE_BASELINE && path.basename(f) < APPLIED.from);
  const partial = await liveCopy({ byHand: handApplied, quiet: true });
  await partial.exec(release).catch((e) => fail(`release file after ${handApplied.length} files by hand`, e.message));
  const partialProblems = compare(freshSnapshot, await snapshot(partial));
  await partial.close();
  if (partialProblems.length) fail(`release file after ${handApplied.length} files by hand`, partialProblems.join('\n     '));
  console.log(`ok   a copy that already ran the ${handApplied.length} files before ${APPLIED.from.slice(0, 14)} by hand takes it too, and matches a fresh install`);

  console.log('-- the live data afterwards, then every test file');
  for (const f of after) await run(db, `live data ${path.basename(f)}`, read(f));
  await db.exec('select test_reset();').catch(() => {});
  for (const f of seeds.filter((s) => path.basename(s) !== path.basename(SEED_FILE))) await run(db, `seed ${path.basename(f)}`, read(f));
  await runTests(db);

  let rerun = null;
  try {
    await db.exec(release);
  } catch (e) {
    rerun = e;
  }
  if (!rerun) fail('release file run twice', 'the second run did not stop at the guard');
  if (!/already has some or all of these updates/.test(rerun.message)) fail('release file run twice', rerun.message);
  console.log('ok   a second run stops at the guard and changes nothing');
  await db.close();
  console.log(`all passed (the release file's ${migrations.length - live.length} migrations and seed on a copy of the live project, ${tests.length} test files)`);
}
