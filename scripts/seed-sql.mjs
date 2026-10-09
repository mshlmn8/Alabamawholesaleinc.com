// The SQL of supabase/seed/products.sql, built from the catalog rows (the
// rows themselves come from src/data/products.js through scripts/build-seed.mjs,
// which needs Vite; this module doesn't, so tests can run what it writes).
//
// Insert-only (AW-032): a row whose id is already in the table is left exactly
// as it is (on conflict (id) do nothing), so re-applying the file never
// overwrites what an admin changed. No prices (AW-003, AW-002).
//
// Since 20261010120000_admin_product_editor.sql, Admin -> Products takes new
// ids from products_id_seq, while products.js rows choose theirs by hand: the
// same id space (NEW-022). So before the insert, a guard block compares the
// seed's (id, SKU) pairs with public.products:
//   - a seed id already in the table under another SKU is skipped by the
//     insert; the guard names those ids in a NOTICE (an admin may have edited
//     the SKU, or created a different product under that id);
//   - a new seed id whose SKU another product already uses (same SKU, any
//     case or surrounding spaces) would fail the insert on
//     products_sku_upper_key, or, without that index, store the SKU twice; the
//     guard stops the file with an EXCEPTION naming them, before anything is
//     inserted.
// Never switch the insert to a bare `on conflict do nothing`: it would skip a
// SKU clash without a word.

export const COLUMNS = ['id', 'name', 'brand', 'cat', 'sub', 'sku', 'variants', 'variant_axis', 'img', 'tag', 'active', 'description', 'sell_unit'];

const text = (v) => (v == null || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const requiredText = (v) => `'${String(v ?? '').replace(/'/g, "''")}'`;
const jsonb = (v) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;

function rowSql(p) {
  const variants = Array.isArray(p.variants) ? p.variants : [];
  const values = [
    Number(p.id),
    requiredText(p.name),
    requiredText(p.brand),
    requiredText(p.cat),
    requiredText(p.sub),
    requiredText(p.sku),
    jsonb(variants),
    text(p.variantAxis),
    text(p.img),
    text(p.tag),
    'true',
    requiredText(p.description),
    requiredText(p.sellUnit),
  ];
  return `  (${values.join(', ')})`;
}

// The guard (NEW-022), above. Runs before the insert, in the same statement
// batch, so its exception stops the file before any row goes in.
export function seedGuardSql(rows) {
  const pairs = rows.map((p) => `      (${Number(p.id)}, ${requiredText(p.sku)})`).join(',\n');
  return [
    '-- Ids and SKUs (NEW-022): Admin -> Products takes new ids from products_id_seq, the',
    '-- id space products.js rows use. A seed id that is already in the table under another',
    '-- SKU is skipped by the insert below (NOTICE). A new seed id whose SKU another product',
    '-- already uses would fail the insert, or store the SKU twice: this stops the file',
    '-- first (EXCEPTION). A new products.js row needs an id above',
    '-- `select max(id) from public.products` on the live database.',
    'do $$',
    'declare',
    '  v_skipped text;',
    '  v_taken text;',
    'begin',
    '  with seed (id, sku) as (',
    '    values',
    pairs,
    '  )',
    '  select',
    "    (select string_agg(format('%s (seed SKU %s, database SKU %s)', s.id, upper(btrim(s.sku)), upper(btrim(p.sku))), ', ' order by s.id)",
    '     from seed s',
    '     join public.products p on p.id = s.id',
    '     where upper(btrim(p.sku)) is distinct from upper(btrim(s.sku))),',
    "    (select string_agg(format('%s (seed id %s, database id %s)', upper(btrim(s.sku)), s.id, p.id), ', ' order by s.id)",
    '     from seed s',
    '     join public.products p on upper(btrim(p.sku)) = upper(btrim(s.sku)) and p.id <> s.id',
    '     where not exists (select 1 from public.products e where e.id = s.id))',
    '  into v_skipped, v_taken;',
    '',
    '  if v_skipped is not null then',
    "    raise notice 'Seed rows skipped: these ids are already in public.products with another SKU, and the database keeps its row: %. A product added in Admin -> Products may have taken the id; give a new products.js row an id above select max(id) from public.products.', v_skipped;",
    '  end if;',
    '  if v_taken is not null then',
    "    raise exception 'Seed not applied: these SKUs are already used by another product: %', v_taken",
    "      using hint = 'Give the products.js row another SKU, or the id the database already has for it, then run npm run seed and apply the file again.';",
    '  end if;',
    'end $$;',
  ].join('\n');
}

// 20261010120000_admin_product_editor.sql gives products.id a sequence
// default, so Admin -> Products inserts new products without an id. The seed
// inserts explicit ids after the migrations, which the sequence doesn't see:
// move it past them, never back, so the next admin insert can't take a seeded
// id. Does nothing on a database without that migration.
export const SEQUENCE_FOOTER = [
  '-- Moves products_id_seq (20261010120000_admin_product_editor.sql) past the ids above, so',
  '-- the next product added in Admin -> Products gets a new id. Never moves it back.',
  'do $$',
  'begin',
  "  if to_regclass('public.products_id_seq') is not null then",
  '    perform setval(',
  "      'public.products_id_seq',",
  '      greatest(',
  '        coalesce((select max(id) from public.products), 0) + 1,',
  '        (select case when is_called then last_value + 1 else last_value end from public.products_id_seq)',
  '      ),',
  '      false',
  '    );',
  '  end if;',
  'end $$;',
];

export function seedSql(rows) {
  return [
    `-- Seed catalog: ${rows.length} SKUs, generated from src/data/products.js by scripts/build-seed.mjs.`,
    '-- Regenerate with: npm run seed.',
    '--',
    '-- Insert-only (AW-032): a row whose id already exists is left alone (on conflict do',
    '-- nothing), so re-applying this file never overwrites an admin\'s edits to names,',
    '-- brands, tags, prices or the active flag. Corrections to existing rows ship as',
    '-- idempotent UPDATE data migrations in supabase/migrations/.',
    '--',
    '-- No prices (AW-003, AW-002): products.price is set only in the database, through',
    '-- Admin -> Products or a private SQL file under supabase/private/ (gitignored). A new',
    '-- row starts with a null price, which the storefront shows as "Price on request".',
    '--',
    '-- Needs supabase/migrations/20260927120000_product_copy.sql (description, sell_unit),',
    '-- 20261009100000_price_boundary.sql (price nullable) and 20261009110000_variant_model.sql',
    '-- (variant_axis; no flavors column). Postgres checks NOT NULL before ON CONFLICT, so on a',
    '-- database without the price-boundary migration every row fails, including ids that',
    '-- already exist.',
    '',
    seedGuardSql(rows),
    '',
    `insert into public.products (${COLUMNS.join(', ')}) values`,
    rows.map(rowSql).join(',\n'),
    'on conflict (id) do nothing;',
    '',
    ...SEQUENCE_FOOTER,
    '',
  ].join('\n');
}
