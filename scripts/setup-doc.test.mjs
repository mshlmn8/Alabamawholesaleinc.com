// @vitest-environment node
// SETUP.md is the owner's click-by-click guide to going live. Every name it
// tells the owner to type or click must be the one the code, netlify.toml
// and .env.example use, so a rename fails here instead of leaving the owner
// stuck halfway through.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DONE_MESSAGE, RELEASE_FILE } from './build-release-sql.mjs';
import { ORDER_NOTIFICATION_FORM } from '../src/lib/orderNotification.js';
import { DEFAULT_SITE_URL } from '../src/lib/routes.js';
import { COMPANY } from '../src/data/content.js';
import { APPLY_LABEL, BASKET, SIGN_IN_LABEL } from '../src/data/terms.js';

const ROOT = resolve(import.meta.dirname, '..');
const read = (file) => readFileSync(resolve(ROOT, file), 'utf8');
const SETUP = read('SETUP.md');
// The text with each run of spaces and line breaks as one space.
const FLAT = SETUP.replace(/\s+/g, ' ');
const ORDERS_INBOX = 'alwholesale@gmail.com';

describe('SETUP.md', () => {
  it('is linked from the README, BACKEND.md, NETLIFY-DEPLOY.md and the owner TODO list', () => {
    expect(read('README.md')).toContain('[SETUP.md](SETUP.md)');
    expect(read('BACKEND.md')).toContain('SETUP.md, part A');
    expect(read('NETLIFY-DEPLOY.md')).toContain('[SETUP.md](SETUP.md)');
    expect(read('docs/OWNER-TODO.md')).toContain('[SETUP.md](../SETUP.md)');
  });

  it('runs the release file and quotes what it prints', () => {
    expect(SETUP).toContain(`(${RELEASE_FILE})`);
    expect(FLAT).toContain(`**${DONE_MESSAGE}**`);
    expect(read(RELEASE_FILE)).toContain('already has some or all of these updates');
    expect(FLAT).toContain('already has some or all of these updates');
    // The SQL editor's confirmation for "destructive operations" (Supabase
    // Studio's RunQueryWarningModal); the file's own header says the same.
    expect(FLAT).toContain('**Run query**');
    expect(read(RELEASE_FILE).replace(/\n-- /g, ' ')).toContain('click Run query');
  });

  it('names the owner provisioning file and its placeholder', () => {
    expect(SETUP).toContain('(supabase/seed/provision_owner.sql)');
    expect(read('supabase/seed/provision_owner.sql')).toContain("'REPLACE_WITH_OWNER_EMAIL'");
    expect(SETUP).toContain('`REPLACE_WITH_OWNER_EMAIL`');
  });

  it('gives Netlify the build settings and every variable of .env.example', () => {
    const toml = read('netlify.toml');
    expect(toml).toMatch(/command = "npm run build"/);
    expect(toml).toMatch(/publish = "dist"/);
    expect(FLAT).toContain('**Build command** `npm run build`');
    expect(FLAT).toContain('**Publish directory** `dist`');
    expect(FLAT).toContain('**Branch to deploy** `main`');
    expect(read('NETLIFY-DEPLOY.md')).toContain('- Production branch: `main`');
    const names = [...read('.env.example').matchAll(/^([A-Z_]+)=/gm)].map((m) => m[1]);
    expect(names).toEqual(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_SITE_URL']);
    for (const name of names) expect(SETUP, name).toContain(`\`${name}\``);
  });

  it('emails orders to the orders inbox through the order form', () => {
    expect(SETUP).toContain(`\`${ORDER_NOTIFICATION_FORM}\``);
    expect(SETUP).toContain(`\`${ORDERS_INBOX}\``);
    expect(read('index.html')).toContain(`name="${ORDER_NOTIFICATION_FORM}"`);
    expect(read('NETLIFY-DEPLOY.md')).toContain(`**${ORDERS_INBOX}**`);
  });

  it('sends Supabase email from the address the site shows, to the site\'s own domain', () => {
    expect(SETUP).toContain(`\`${COMPANY.email}\``);
    expect(SETUP).toContain(`**Site URL**: \`${DEFAULT_SITE_URL}\``);
    expect(SETUP).toContain(`\`${DEFAULT_SITE_URL}/reset-password\``);
  });

  it('uses the labels the site and Admin show', () => {
    const labels = {
      [APPLY_LABEL]: 'src/data/terms.js',
      [SIGN_IN_LABEL]: 'src/data/terms.js',
      [BASKET.label]: 'src/data/terms.js',
      [BASKET.cta]: 'src/data/terms.js',
      [BASKET.submit]: 'src/data/terms.js',
      'How to use Admin': 'src/pages/admin/AdminHelp.jsx',
      'Upload a photo': 'src/pages/admin/ProductEditor.jsx',
      'Save product': 'src/pages/admin/ProductEditor.jsx',
      'Make staff': 'src/pages/admin/AccountChanges.jsx',
      'Remove staff access': 'src/pages/admin/AccountChanges.jsx',
      'Cancel the order': 'src/pages/admin/OrdersSection.jsx',
      Approve: 'src/pages/admin/AccountsSection.jsx',
      Details: 'src/pages/admin/AccountsSection.jsx',
      Edit: 'src/pages/admin/ProductsSection.jsx',
      'Export CSV': 'src/pages/admin/ProductsSection.jsx',
      'Import CSV': 'src/pages/admin/ProductsSection.jsx',
      'Yes, I am 21+': 'src/components/AgeGate.jsx',
    };
    for (const [label, file] of Object.entries(labels)) {
      expect(read(file), `${label} in ${file}`).toContain(label);
      expect(FLAT, `SETUP.md says **${label}**`).toContain(`**${label}**`);
    }
  });

  it('names only Admin sections that exist', () => {
    const sections = [...FLAT.matchAll(/Admin → ([A-Z][a-z]+(?: [a-z]+)?)/g)].map((m) => m[1]);
    expect(new Set(sections)).toEqual(new Set(['Accounts', 'Orders', 'Products', 'Homepage']));
    const admin = read('src/pages/admin/AdminPage.jsx');
    for (const label of sections) expect(admin, `Admin → ${label}`).toContain(`label: '${label}'`);
  });
});
