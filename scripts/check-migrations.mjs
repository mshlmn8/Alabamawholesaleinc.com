// Replays supabase/migrations/*.sql (and, with --seed, supabase/seed/*.sql) in
// an in-memory Postgres (PGlite) with stubbed Supabase auth/storage schemas and
// the anon/authenticated/service_role roles, then runs the assertion files in
// supabase/tests/*.sql. Nothing connects to a real database.
//
//   npm run test:db                                   # migrations + seed + every test file
//   node scripts/check-migrations.mjs [--seed] [--test file.sql ...] [--repo <dir>]
//
// Passing --test runs only the named files instead of supabase/tests/*.sql.
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

const args = process.argv.slice(2);
const argValue = (flag) => { const i = args.indexOf(flag); return i === -1 ? null : args[i + 1]; };
const repo = path.resolve(argValue('--repo') || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const withSeed = args.includes('--seed');
const explicitTests = [];
args.forEach((a, i) => { if (a === '--test') explicitTests.push(path.resolve(args[i + 1])); });

const sqlFiles = (dir) => (fs.existsSync(dir)
  ? fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => path.join(dir, f))
  : []);

const db = new PGlite();
async function run(label, sql) {
  try {
    await db.exec(sql);
    console.log(`ok   ${label}`);
  } catch (e) {
    console.error(`FAIL ${label}\n     ${e.message}${e.position ? ` (at char ${e.position})` : ''}`);
    if (e.position) {
      const pos = Number(e.position);
      console.error('     …' + sql.slice(Math.max(0, pos - 160), pos + 80).replace(/\n/g, '\n     ') + '…');
    }
    process.exit(1);
  }
}

const migrations = sqlFiles(path.join(repo, 'supabase', 'migrations'));
if (migrations.length === 0) {
  console.error(`No migrations found under ${path.join(repo, 'supabase', 'migrations')}`);
  process.exit(2);
}

await run('supabase stubs', SUPABASE_STUB);
for (const f of migrations) await run(`migration ${path.basename(f)}`, fs.readFileSync(f, 'utf8'));
if (withSeed) {
  for (const f of sqlFiles(path.join(repo, 'supabase', 'seed'))) await run(`seed ${path.basename(f)}`, fs.readFileSync(f, 'utf8'));
}
const tests = explicitTests.length ? explicitTests : sqlFiles(path.join(repo, 'supabase', 'tests'));
for (const t of tests) {
  await run(`test ${path.basename(t)}`, fs.readFileSync(t, 'utf8'));
  await db.exec('select test_reset();').catch(() => {});
}
await db.close();
console.log(`all passed (${migrations.length} migrations${withSeed ? ', seed' : ''}, ${tests.length} test files)`);
