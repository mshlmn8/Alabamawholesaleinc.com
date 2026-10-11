// @vitest-environment node
// supabase/release/apply-to-live-database.sql is the one file the owner runs
// on the live database (SETUP.md, part A). It must hold every migration after
// the live baseline, word for word and in order, then the product seed, and
// be regenerated whenever one of them changes. npm run test:db
// (check-migrations.mjs --from-live) proves it on a copy of the live project.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APPLIED, BASELINE_CHECK, DONE_MESSAGE, LIVE_BASELINE, MAX_RELEASE_BYTES, MIGRATIONS_DIR, RELEASE_FILE, SEED_FILE,
  buildRelease, pendingMigrations, releaseSql,
} from './build-release-sql.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const RELEASE = readFileSync(resolve(ROOT, RELEASE_FILE), 'utf8');
const NAMES = readdirSync(resolve(ROOT, MIGRATIONS_DIR)).filter((n) => n.endsWith('.sql')).sort();
const PENDING = pendingMigrations(NAMES);
const migration = (name) => readFileSync(resolve(ROOT, MIGRATIONS_DIR, name), 'utf8');
const SEED = readFileSync(resolve(ROOT, SEED_FILE), 'utf8');

describe('supabase/release/apply-to-live-database.sql', () => {
  it('is up to date with supabase/migrations and the seed (run npm run release:sql)', () => {
    // A failure here means a migration or the seed changed after the file was
    // written: run `npm run release:sql` and commit the result.
    expect(RELEASE === buildRelease(ROOT), `${RELEASE_FILE} is out of date: run npm run release:sql`).toBe(true);
  });

  it('holds every migration after the live baseline, in order, word for word, each once', () => {
    expect(NAMES).toContain(LIVE_BASELINE);
    expect(PENDING).toEqual(NAMES.slice(NAMES.indexOf(LIVE_BASELINE) + 1));
    expect(PENDING.length).toBeGreaterThan(0);
    const total = PENDING.length + 1;
    let at = 0;
    PENDING.forEach((name, i) => {
      const header = `-- ${i + 1} of ${total}: ${name}\n`;
      expect(RELEASE.split(header), `${name} has one section`).toHaveLength(2);
      const start = RELEASE.indexOf(header);
      expect(start, `${name} comes after the one before it`).toBeGreaterThan(at);
      const body = migration(name).trimEnd();
      expect(RELEASE.indexOf(body, start), `${name} is in the file word for word`).toBeGreaterThan(start);
      at = start;
    });
    // Nothing at or before the baseline.
    for (const name of NAMES.slice(0, NAMES.indexOf(LIVE_BASELINE) + 1)) expect(RELEASE).not.toContain(`: ${name}\n`);
  });

  it('ends with the product seed, then says it is done', () => {
    const seedHeader = `-- ${PENDING.length + 1} of ${PENDING.length + 1}: products.sql\n`;
    const start = RELEASE.indexOf(seedHeader);
    expect(start).toBeGreaterThan(RELEASE.indexOf(`: ${PENDING[PENDING.length - 1]}\n`));
    expect(RELEASE.indexOf(SEED.trimEnd(), start)).toBeGreaterThan(start);
    expect(RELEASE.trimEnd().endsWith(`select '${DONE_MESSAGE}' as result;`)).toBe(true);
    // The seed is insert-only and carries no prices (build-seed.test.mjs).
    expect(SEED).toMatch(/on conflict \(id\) do nothing;/);
  });

  it('first stops, changing nothing, on a database that is not at the live baseline or already has the updates', () => {
    const guard = RELEASE.slice(0, RELEASE.indexOf(`-- 1 of ${PENDING.length + 1}:`));
    expect(guard).toContain(`if not (${BASELINE_CHECK}) then`);
    expect(guard).toContain(`if ${APPLIED.check} then`);
    expect(guard).toMatch(/raise exception 'This database doesn''t have the updates up to 20260927180000_application_documents\.sql/);
    expect(guard).toMatch(/raise exception 'This database already has some or all of these updates/);
    // APPLIED.from is the release's first migration that can't run twice: it
    // drops the column the guard looks for.
    expect(PENDING).toContain(APPLIED.from);
    expect(APPLIED.check).toContain("column_name = 'flavors'");
    expect(migration(APPLIED.from)).toMatch(/alter table public\.products drop column if exists flavors;/);
    expect(migration(LIVE_BASELINE)).toMatch(/create table if not exists public\.profile_documents/);
  });

  it('runs as one transaction: no statement of its own starts, ends or splits one', () => {
    // The SQL editor sends the file as one query, which Postgres runs as one
    // transaction (all or nothing) unless the text has its own BEGIN/COMMIT.
    // PL/pgSQL's `begin` (no semicolon) and `end;` are not transaction control.
    expect(RELEASE).not.toMatch(/^\s*(begin|commit|rollback|end transaction|start transaction|savepoint|release savepoint)\s*;/im);
    expect(RELEASE).not.toMatch(/\bconcurrently\b/i);
    expect(RELEASE).not.toMatch(/^\s*vacuum\b/im);
  });

  it('fits the Supabase SQL editor, which refuses a query over 0.98 MiB', () => {
    expect(MAX_RELEASE_BYTES).toBeLessThan(0.98 * 1024 * 1024);
    expect(Buffer.byteLength(RELEASE)).toBeLessThanOrEqual(MAX_RELEASE_BYTES);
  });

  it('enables row-level security on every table it creates, so the SQL editor never offers to add it', () => {
    // Supabase Studio's check (sql-event-parser.ts): function and DO bodies
    // and comments don't count; a CREATE TABLE with no ALTER TABLE … ENABLE
    // ROW LEVEL SECURITY for it in the same query gets "Run and enable RLS",
    // which would append statements to the file.
    const top = RELEASE.replace(/(\$[a-zA-Z0-9_]*\$)[\s\S]*?\1/g, '$1$1').replace(/--.*$/gm, '');
    const created = [...top.matchAll(/create\s+(?:temp(?:orary)?\s+|unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?([\w.]+)/gi)].map((m) => m[1]);
    expect(created.length).toBeGreaterThan(5);
    for (const table of created) {
      expect(top, `${table} enables row-level security`).toMatch(new RegExp(String.raw`alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?${table.replace('.', '\\.')}\s+enable\s+row\s+level\s+security`, 'i'));
    }
  });

  it('names the live baseline the way BACKEND.md does', () => {
    const backend = readFileSync(resolve(ROOT, 'BACKEND.md'), 'utf8');
    expect(backend).toContain(`up to \`${LIVE_BASELINE.slice(0, 14)}\``);
    expect(backend).toContain(RELEASE_FILE);
  });
});

describe('releaseSql', () => {
  const seed = { name: 'products.sql', sql: 'insert into t values (1) on conflict (id) do nothing;\n' };

  it('numbers the sections and lists them at the top', () => {
    const text = releaseSql({
      migrations: [{ name: '20300101000000_a.sql', sql: 'select 1;\n' }, { name: '20300102000000_b.sql', sql: 'select 2;' }],
      seed,
      baseline: '20291231000000_base.sql',
    });
    expect(text).toContain('--   1. 20300101000000_a.sql\n--   2. 20300102000000_b.sql\n--   3. products.sql (the product seed)');
    expect(text).toContain('-- 1 of 3: 20300101000000_a.sql\n');
    expect(text).toContain('-- 3 of 3: products.sql\n');
    expect(text).toContain('has the 2 after it\n-- (20300101000000 to 20300102000000)');
    expect(text.indexOf('select 1;')).toBeLessThan(text.indexOf('select 2;'));
    expect(text.indexOf('select 2;')).toBeLessThan(text.indexOf('on conflict (id) do nothing;'));
  });

  it('refuses to write a file with no migration in it', () => {
    expect(() => releaseSql({ migrations: [], seed })).toThrow(/no migration after the live baseline/);
  });

  it('refuses to write a file too large for the SQL editor', () => {
    const migrations = [{ name: '20300101000000_a.sql', sql: 'select 1;' }];
    expect(() => releaseSql({ migrations, seed, maxBytes: 1000 })).toThrow(/over the 1000 the Supabase SQL editor takes safely; split it/);
    expect(releaseSql({ migrations, seed })).toContain('select 1;');
  });

  it('picks the files after the baseline, in name order', () => {
    expect(pendingMigrations(['b_2.sql', 'a_1.sql', 'c_3.sql', 'notes.txt', 'b_1.sql'], 'b_1.sql')).toEqual(['b_2.sql', 'c_3.sql']);
  });
});
