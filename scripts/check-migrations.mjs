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

const args = process.argv.slice(2);
const argValue = (flag) => { const i = args.indexOf(flag); return i === -1 ? null : args[i + 1]; };
const repo = path.resolve(argValue('--repo') || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const withSeed = args.includes('--seed');
const explicitTests = [];
args.forEach((a, i) => { if (a === '--test') explicitTests.push(path.resolve(args[i + 1])); });

const STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  raw_app_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  email_confirmed_at timestamptz
);
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.role() returns text language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
create or replace function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create schema storage;
create table storage.buckets (
  id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now()
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text, owner uuid, metadata jsonb, created_at timestamptz default now()
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as
  $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
create or replace function storage.filename(name text) returns text language sql immutable as
  $$ select (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)] $$;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create or replace function public.test_login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
  execute 'set role authenticated';
end $$;
create or replace function public.test_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', 'anon', false);
  execute 'set role anon';
end $$;
create or replace function public.test_reset() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;
grant execute on function public.test_login(uuid), public.test_anon(), public.test_reset() to anon, authenticated;
`;

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

await run('supabase stubs', STUB);
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
