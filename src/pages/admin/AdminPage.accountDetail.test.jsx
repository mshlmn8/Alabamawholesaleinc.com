// Admin -> Accounts' search and an account's own page (AW-113), with the
// fake client: the page loads the account, its documents, internal notes,
// orders and status history; the contact form checks and saves only what
// changed; notes are added; a database without the notes table says so;
// and Back returns to the list with the business link focused.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', async () => {
  const { createFakeSupabase } = await import('./fakeSupabase.js');
  const fake = createFakeSupabase();
  return { supabase: fake.client, fake, isBackendConfigured: true, AUTH_STORAGE_KEY: 'aw-auth' };
});

const { fake } = await import('../../lib/supabase.js');
const { AdminPage } = await import('./AdminPage.jsx');
const { resetOrderStatusForTests } = await import('./OrdersSection.jsx');
const { resetOrdersSeenForTests } = await import('./ordersSeen.js');
const { navigate, useRoute } = await import('../../lib/router.js');

function RoutedAdmin(props) {
  const { raw } = useRoute();
  return <AdminPage route={raw} {...props} />;
}

const ADMIN_ID = '11111111-2222-4333-8444-0000000000a1';
const ALPHA_ID = '11111111-2222-4333-8444-000000000aaa';
const BRAVO_ID = '11111111-2222-4333-8444-000000000bbb';
const ADMIN = { id: ADMIN_ID, name: 'Desk Admin', business: 'Alabama Wholesale', email: 'desk@example.test', role: 'admin', status: 'approved', pricing_tier: 'standard' };
const ALPHA = {
  id: ALPHA_ID, business: 'Alpha Food Mart', name: 'Alice Alpha', email: 'alpha@example.test', phone: '205-555-0101', status: 'approved', role: 'customer',
  pricing_tier: 'silver', state: 'AL', store_street: '1 Alpha Way', store_city: 'Birmingham', store_zip: '35203', business_type: 'Convenience Store',
  ein: '12-3456789', license_no: 'TL-1', resale_cert_no: 'RC-1', expected_volume: '$5K — $15K', verification_note: 'Checked',
  approved_at: '2026-10-01T15:00:00Z', approved_by: ADMIN_ID, created_at: '2026-09-28T15:00:00Z',
};
const BRAVO = { id: BRAVO_ID, business: 'Bravo Tobacco Outlet', name: 'Bea Bravo', email: 'bravo@example.test', phone: '334-555-0102', status: 'pending', role: 'customer', pricing_tier: 'standard', business_type: 'Smoke Shop' };
const ORDERS = [
  { id: 'o1', user_id: ALPHA_ID, ref_num: 'ALW-O-AAAA000001', status: 'fulfilled', kind: 'order', subtotal: 120.1, total_units: 9, created_at: '2026-10-08T15:00:00Z' },
  { id: 'o2', user_id: ALPHA_ID, ref_num: 'ALW-O-AAAA000002', status: 'cancelled', kind: 'order', subtotal: 50, total_units: 3, created_at: '2026-10-05T15:00:00Z' },
  { id: 'o3', user_id: ALPHA_ID, ref_num: 'ALW-Q-AAAA000003', status: 'new', kind: 'quote', subtotal: null, total_units: 2, created_at: '2026-10-02T15:00:00Z' },
  { id: 'o4', user_id: ALPHA_ID, ref_num: 'ALW-O-AAAA000004', status: 'confirmed', kind: 'order', subtotal: 22.2, total_units: 1, created_at: '2026-09-30T15:00:00Z' },
];
const MISSING_TABLE = { code: 'PGRST205', message: 'Could not find the table' };

const db = { tableError: {}, updateResult: null };
beforeEach(() => {
  // Every status: the list opens on pending accounts (AW-268).
  act(() => navigate('/admin/accounts?status=all', { replace: true }));
  fake.reset();
  resetOrderStatusForTests();
  resetOrdersSeenForTests();
  db.tableError = {};
  db.updateResult = null;
  fake.tables = {
    profiles: [ADMIN, ALPHA, BRAVO],
    orders: ORDERS,
    pricing_tiers: [{ tier: 'standard', discount_pct: 0 }, { tier: 'silver', discount_pct: 5 }, { tier: 'gold', discount_pct: 10 }],
    profile_documents: [{ profile_id: ALPHA_ID, document_type: 'tobacco_license', storage_path: `${ALPHA_ID}/tobacco_license/1-l.pdf`, uploaded_at: '2026-09-29T12:00:00Z' }],
    profile_admin_notes: [{ id: 7, profile_id: ALPHA_ID, author: ADMIN_ID, body: 'Owner asked for Friday deliveries', created_at: '2026-10-02T14:00:00Z' }],
    profile_status_log: [{ id: 3, profile_id: ALPHA_ID, old_status: 'pending', new_status: 'approved', changed_by: ADMIN_ID, changed_at: '2026-10-01T15:00:00Z' }],
  };
  fake.respond = (request) => {
    if (request.table && db.tableError[request.table]) return { data: null, error: db.tableError[request.table] };
    if (request.op === 'update' && db.updateResult) return db.updateResult;
    if (request.op === 'insert' && request.table === 'profile_admin_notes') {
      return { data: { id: 90 + fake.find({ op: 'insert' }).length, author: ADMIN_ID, created_at: new Date().toISOString(), ...request.rows }, error: null };
    }
    return undefined;
  };
});
afterEach(async () => {
  vi.useRealTimers();
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  vi.restoreAllMocks();
});

const open = async (path) => {
  if (path) act(() => navigate(path, { replace: true }));
  await act(async () => { render(<RoutedAdmin profile={ADMIN} account="ready" />); });
  await act(async () => {});
};
const section = (name) => screen.getByRole('heading', { level: 3, name }).closest('section');
const updates = () => fake.find({ op: 'update' }).map(({ table, filters, patch, returning }) => ({ table, id: filters.find(([n]) => n === 'eq')[2], patch, returning }));

describe('the Accounts search (AW-113)', () => {
  it('matches business, name, email and phone without the URL, counts the results, and survives a visit to an account', async () => {
    await open();
    expect(screen.getByText('3 accounts')).toBeTruthy();
    const box = screen.getByLabelText('Search accounts');
    fireEvent.change(box, { target: { value: 'BRAVO' } });
    expect(screen.getByText('1 of 3 accounts')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Alpha Food Mart' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Bravo Tobacco Outlet' })).toBeTruthy();
    fireEvent.change(box, { target: { value: '2055550101' } });
    expect(screen.getByRole('link', { name: 'Alpha Food Mart' })).toBeTruthy();
    // The URL keeps the status filter, never the search.
    expect(window.location.search).toBe('?status=all');
    fireEvent.change(box, { target: { value: 'nobody' } });
    expect(screen.getByText('No account matches “nobody”.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }));
    expect(box.value).toBe('');
    fireEvent.change(box, { target: { value: 'alpha' } });
    await act(async () => { fireEvent.click(screen.getByRole('link', { name: 'Alpha Food Mart' })); });
    expect(window.location.pathname).toBe(`/admin/accounts/${ALPHA_ID}`);
    await act(async () => { navigate('/admin/accounts?status=all'); });
    expect(screen.getByLabelText('Search accounts').value).toBe('alpha');
  });

  it('links each business to its page, and gives the contact a mailto: and a tel: link', async () => {
    await open();
    const link = screen.getByRole('link', { name: 'Alpha Food Mart' });
    expect(link.getAttribute('href')).toBe(`/admin/accounts/${ALPHA_ID}`);
    const row = link.closest('tr');
    expect(within(row).getByRole('link', { name: 'alpha@example.test' }).getAttribute('href')).toBe('mailto:alpha@example.test');
    expect(within(row).getByRole('link', { name: '205-555-0101' }).getAttribute('href')).toBe('tel:2055550101');
  });
});

describe('an account’s page (AW-113)', () => {
  it('loads the account, its documents, notes, orders and history, with the heading focused', async () => {
    await open(`/admin/accounts/${ALPHA_ID}`);
    const heading = screen.getByRole('heading', { level: 2, name: 'Alpha Food Mart' });
    expect(document.activeElement).toBe(heading);
    expect(document.querySelector('.account-pill').textContent).toBe('Approved');
    expect(screen.queryByRole('table', { name: /accounts/i })).toBeNull();
    // Contact and store, with the email read only.
    const contact = section('Contact and store');
    expect(within(contact).getByLabelText('Business name').value).toBe('Alpha Food Mart');
    expect(within(contact).getByLabelText('Store state').value).toBe('AL');
    expect(within(contact).getByLabelText('ZIP').value).toBe('35203');
    expect(within(contact).getByLabelText('Email').readOnly).toBe(true);
    const types = document.getElementById(within(contact).getByLabelText('Business type').getAttribute('list'));
    expect([...types.querySelectorAll('option')].map((o) => o.value)).toEqual(['Convenience Store', 'Smoke Shop']);
    // Verification: the application answers (without the ones the form edits) and the note.
    const verify = section('Verification');
    for (const text of ['12-3456789', 'TL-1', 'RC-1', '$5K — $15K', 'Desk Admin']) expect(within(verify).getByText(text)).toBeTruthy();
    expect(within(verify).queryByText('1 Alpha Way')).toBeNull();
    expect(within(verify).getByLabelText('Verification note').value).toBe('Checked');
    // Dates as the rest of admin writes them, whatever the browser's
    // language, without seconds (NEW-038).
    const fact = (label) => within(verify).getByText(label, { selector: '.fact-label' }).nextElementSibling.textContent;
    expect(fact('Signed up')).toMatch(/^Sep 28, 2026, \d{1,2}:00 [AP]M$/);
    expect(fact('Approved')).toMatch(/^Oct 1, 2026, \d{1,2}:00 [AP]M$/);
    expect(fact('Terms accepted')).toBe('—');
    // Documents: this account's only, signed when View is clicked.
    expect(fake.find({ table: 'profile_documents' })[0].filters).toEqual([['eq', 'profile_id', ALPHA_ID]]);
    const docs = section('License documents');
    expect(within(docs).getByText('Uploaded on September 29, 2026')).toBeTruthy();
    expect(within(docs).getByRole('button', { name: /^View ?State retail tobacco license for Alpha Food Mart/ })).toBeTruthy();
    expect(within(docs).getByText('Not on file')).toBeTruthy();
    expect(fake.find({ kind: 'storage' })).toHaveLength(0);
    // Internal notes with the author's name.
    const notes = section('Internal notes');
    expect(notes.querySelector('.order-timeline-line').textContent).toMatch(/^Note by Desk Admin · Oct 2,( 2026,)? \d{1,2}:00 [AP]M$/);
    expect(within(notes).getByText('Owner asked for Friday deliveries')).toBeTruthy();
    // Status history.
    expect(section('Status history').querySelector('.order-timeline-line').textContent).toMatch(/^Approved by Desk Admin · Oct 1,( 2026,)? \d{1,2}:00 [AP]M$/);
  });

  it('sums the priced orders that weren’t cancelled, and links them to Admin -> Orders for the account', async () => {
    await open(`/admin/accounts/${ALPHA_ID}`);
    const orders = section('Orders');
    const select = fake.find({ table: 'orders', op: 'select' })[0];
    expect(select.columns).toBe('id,ref_num,status,kind,subtotal,total_units,created_at');
    expect(select.filters).toEqual([['eq', 'user_id', ALPHA_ID]]);
    expect(select.modifiers).toEqual([['order', 'created_at', { ascending: false }], ['limit', 50]]);
    const facts = [...orders.querySelectorAll('.account-order-summary div')].map((d) => [d.querySelector('dt').textContent, d.querySelector('dd').textContent]);
    // 120.10 + 22.20; the cancelled $50 and the unpriced quote are left out.
    expect(facts).toEqual([['Last order', 'Oct 8, 2026'], ['Total of priced orders, cancelled ones excluded', '$142.30']]);
    const href = `/admin/orders?status=all&account=${ALPHA_ID}`;
    expect(within(orders).getByRole('link', { name: 'ALW-O-AAAA000001' }).getAttribute('href')).toBe(href);
    expect(within(orders).getByRole('link', { name: 'All orders for this account' }).getAttribute('href')).toBe(href);
    expect(within(orders).getByText('Not priced')).toBeTruthy();
  });

  it('checks the changed fields, then saves only them', async () => {
    await open(`/admin/accounts/${ALPHA_ID}`);
    const contact = section('Contact and store');
    const field = (label) => within(contact).getByLabelText(label);
    const save = within(contact).getByRole('button', { name: 'Save changes' });
    expect(save.disabled).toBe(true);
    fireEvent.change(field('Store state'), { target: { value: 'A1' } });
    fireEvent.change(field('ZIP'), { target: { value: '352' } });
    fireEvent.change(field('Phone'), { target: { value: ' 205-555-0199 ' } });
    await act(async () => { fireEvent.submit(contact.querySelector('form')); });
    expect(updates()).toHaveLength(0);
    expect(field('Store state').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field('Store state'));
    const errorOf = (label) => document.getElementById(field(label).getAttribute('aria-describedby').split(' ').at(-1)).textContent;
    expect(errorOf('Store state')).toBe('Use the two-letter state code, such as AL.');
    expect(errorOf('ZIP')).toBe('Enter a 5-digit ZIP code, or ZIP+4.');
    fireEvent.change(field('Store state'), { target: { value: 'ms' } });
    expect(field('Store state').getAttribute('aria-invalid')).toBeNull();
    fireEvent.change(field('ZIP'), { target: { value: '39201' } });
    // Enter in a field saves (a real form).
    await act(async () => { fireEvent.submit(contact.querySelector('form')); });
    expect(updates()).toEqual([{ table: 'profiles', id: ALPHA_ID, patch: { phone: '205-555-0199', state: 'MS', store_zip: '39201' }, returning: 'id' }]);
    expect(screen.getByRole('status').textContent).toBe('Saved the contact and store details of Alpha Food Mart.');
    expect(field('Store state').value).toBe('MS');
    expect(within(contact).getByRole('button', { name: 'Save changes' }).disabled).toBe(true);
    // The header line shows the saved phone.
    expect(document.querySelector('.account-detail-contact').textContent).toContain('205-555-0199');
  });

  it('shows a refused save and one the live database can’t take, and keeps what was typed', async () => {
    await open(`/admin/accounts/${ALPHA_ID}`);
    const contact = section('Contact and store');
    fireEvent.change(within(contact).getByLabelText('City'), { target: { value: 'Hoover' } });
    db.updateResult = { data: null, error: { code: '42501', message: 'permission denied for table profiles' }, status: 403 };
    await act(async () => { fireEvent.submit(contact.querySelector('form')); });
    expect(within(contact).getByRole('alert').textContent).toBe('That change to Alpha Food Mart isn’t allowed.');
    db.updateResult = { data: null, error: { code: 'PGRST204', message: "Could not find the 'store_city' column of 'profiles' in the schema cache" } };
    await act(async () => { fireEvent.submit(contact.querySelector('form')); });
    expect(within(contact).getByRole('alert').textContent).toBe('Saving this needs the October 2026 database update (see BACKEND.md).');
    expect(within(contact).getByLabelText('City').value).toBe('Hoover');
    // Unsaved: leaving asks first.
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    act(() => navigate('/admin/orders'));
    expect(confirm).toHaveBeenCalledWith('Your changes to Alpha Food Mart aren’t saved. Leave without saving them?');
    expect(window.location.pathname).toBe(`/admin/accounts/${ALPHA_ID}`);
  });

  it('adds an internal note, with an inline error for an empty or long one', async () => {
    await open(`/admin/accounts/${ALPHA_ID}`);
    const notes = section('Internal notes');
    const box = within(notes).getByLabelText('Add an internal note');
    await act(async () => { fireEvent.click(within(notes).getByRole('button', { name: 'Add note' })); });
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(notes.querySelector('.account-note-form .form-error').textContent).toBe('Write the note first.');
    expect(document.activeElement).toBe(box);
    fireEvent.change(box, { target: { value: 'x'.repeat(2001) } });
    await act(async () => { fireEvent.click(within(notes).getByRole('button', { name: 'Add note' })); });
    expect(notes.querySelector('.account-note-form .form-error').textContent).toBe('Keep the note to 2,000 characters or fewer (it has 2,001).');
    fireEvent.change(box, { target: { value: '  Prefers calls after 2 pm  ' } });
    await act(async () => { fireEvent.click(within(notes).getByRole('button', { name: 'Add note' })); });
    expect(fake.find({ table: 'profile_admin_notes', op: 'insert' })[0].rows).toEqual({ profile_id: ALPHA_ID, body: 'Prefers calls after 2 pm' });
    expect(box.value).toBe('');
    expect([...notes.querySelectorAll('.order-timeline-text')].map((p) => p.textContent)).toEqual(['Prefers calls after 2 pm', 'Owner asked for Friday deliveries']);
    expect(notes.querySelector('.order-timeline-line').textContent).toMatch(/^Note by Desk Admin · /);
    expect(screen.getByRole('status').textContent).toBe('Added a note to Alpha Food Mart.');
  });

  it('says the notes need the October 2026 update when the table is missing, and leaves out the history without its table', async () => {
    db.tableError.profile_admin_notes = MISSING_TABLE;
    db.tableError.profile_status_log = MISSING_TABLE;
    await open(`/admin/accounts/${ALPHA_ID}`);
    const notes = section('Internal notes');
    expect(within(notes).getByText('Internal notes need the October 2026 database update (see BACKEND.md).')).toBeTruthy();
    expect(within(notes).queryByLabelText('Add an internal note')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Status history' })).toBeNull();
  });

  it('loads the orders without kind on a database that doesn’t have it', async () => {
    fake.respond = (request) => (request.table === 'orders' && String(request.columns).includes('kind')
      ? { data: null, error: { code: '42703', message: 'column orders.kind does not exist' } } : undefined);
    await open(`/admin/accounts/${ALPHA_ID}`);
    expect(fake.find({ table: 'orders', op: 'select' }).map((c) => c.columns)).toEqual(['id,ref_num,status,kind,subtotal,total_units,created_at', 'id,ref_num,status,subtotal,total_units,created_at']);
    expect(within(section('Orders')).getByRole('link', { name: 'ALW-O-AAAA000004' })).toBeTruthy();
  });

  it('never loads the documents again after a status, tier or note change', async () => {
    await open(`/admin/accounts/${ALPHA_ID}`);
    const controls = section('Status, tier and role');
    await act(async () => { fireEvent.change(within(controls).getByLabelText('Tier'), { target: { value: 'gold' } }); });
    await act(async () => { fireEvent.change(within(controls).getByLabelText('Status'), { target: { value: 'pending' } }); });
    const verify = section('Verification');
    fireEvent.change(within(verify).getByLabelText('Verification note'), { target: { value: 'Called the store' } });
    await act(async () => { fireEvent.click(within(verify).getByRole('button', { name: 'Save note' })); });
    expect(updates().map((u) => u.patch)).toEqual([{ pricing_tier: 'gold' }, { status: 'pending' }, { verification_note: 'Called the store' }]);
    expect(fake.find({ table: 'profile_documents' })).toHaveLength(1);
    expect(fake.find({ table: 'profiles', op: 'select' })).toHaveLength(1);
    expect(document.querySelector('.account-pill').textContent).toBe('Pending');
  });

  it('locks the admin’s own status and role, with the reason', async () => {
    await open(`/admin/accounts/${ADMIN_ID}`);
    const controls = section('Status, tier and role');
    expect(within(controls).getByLabelText('Status').disabled).toBe(true);
    expect(within(controls).getByLabelText('Role').disabled).toBe(true);
    expect(within(controls).getByLabelText('Tier').disabled).toBe(false);
    expect(within(controls).getByLabelText('Status').getAttribute('aria-describedby')).toBe('account-own-row');
    expect(document.getElementById('account-own-row').textContent).toBe('Your own status and role can’t be changed here.');
  });

  it('says when no account has that id', async () => {
    await open('/admin/accounts/11111111-2222-4333-8444-000000000fff');
    expect(screen.getByRole('heading', { level: 2, name: 'Account not found' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'All accounts' }).getAttribute('href')).toBe('/admin/accounts?status=all');
  });

  it('goes back to the list it was opened from, with the business link focused', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {
      act(() => navigate('/admin/accounts?status=all', { replace: true }));
    });
    await open();
    await act(async () => { fireEvent.click(screen.getByRole('link', { name: 'Alpha Food Mart' })); });
    expect(screen.getByRole('heading', { level: 2, name: 'Alpha Food Mart' })).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('link', { name: 'Back to accounts' })); });
    expect(back).toHaveBeenCalledTimes(1);
    await act(async () => {});
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Alpha Food Mart' }));
  });

  it('opens from an order card’s account line', async () => {
    fake.tables.orders = [{ ...ORDERS[2], business: 'Alpha Food Mart', contact: 'Alice', email: 'alpha@example.test', profiles: { business: 'Alpha Food Mart', pricing_tier: 'silver' }, order_items: [] },
      { id: 'g1', user_id: null, ref_num: 'ALW-Q-GUEST00001', status: 'new', kind: 'quote', subtotal: null, created_at: '2026-10-03T15:00:00Z', business: 'Guest Mart', profiles: null, order_items: [] }];
    await open('/admin/orders');
    const account = screen.getByRole('link', { name: 'Alpha Food Mart · Silver tier' });
    expect(account.getAttribute('href')).toBe(`/admin/accounts/${ALPHA_ID}`);
    // A guest's quote has no account to open.
    const guest = screen.getByText('ALW-Q-GUEST00001', { selector: '.order-ref' }).closest('article');
    expect(within(guest).queryByRole('link', { name: /Guest Mart/ })).toBeNull();
    await act(async () => { fireEvent.click(account); });
    expect(screen.getByRole('heading', { level: 2, name: 'Alpha Food Mart' })).toBeTruthy();
  });
});

describe('the status history’s role changes (AW-203)', () => {
  const lines = () => [...section('Status history').querySelectorAll('.order-timeline-line')].map((p) => p.textContent.replace(/ · .*$/, ''));

  it('reads the role columns, and says who made an account an admin or removed it', async () => {
    fake.tables.profile_status_log = [
      { id: 6, profile_id: ALPHA_ID, old_status: 'approved', new_status: 'approved', old_role: 'admin', new_role: 'customer', changed_by: ADMIN_ID, changed_at: '2026-10-04T15:00:00Z' },
      { id: 5, profile_id: ALPHA_ID, old_status: 'approved', new_status: 'approved', old_role: 'customer', new_role: 'admin', changed_by: ADMIN_ID, changed_at: '2026-10-03T15:00:00Z' },
      { id: 4, profile_id: ALPHA_ID, old_status: 'pending', new_status: 'approved', old_role: 'customer', new_role: 'admin', changed_by: null, changed_at: '2026-10-02T15:00:00Z' },
      { id: 3, profile_id: ALPHA_ID, old_status: 'pending', new_status: 'approved', old_role: null, new_role: null, changed_by: ADMIN_ID, changed_at: '2026-10-01T15:00:00Z' },
    ];
    await open(`/admin/accounts/${ALPHA_ID}`);
    expect(fake.find({ table: 'profile_status_log' }).map((c) => c.columns)).toEqual(['id, old_status, new_status, old_role, new_role, changed_by, changed_at']);
    expect(lines()).toEqual(['Admin access removed by Desk Admin', 'Made an admin by Desk Admin', 'Approved and made an admin', 'Approved by Desk Admin']);
  });

  it('reads the history without them on a database before 20261011111000', async () => {
    fake.respond = (request) => (request.table === 'profile_status_log' && String(request.columns).includes('old_role')
      ? { data: null, error: { code: '42703', message: 'column profile_status_log.old_role does not exist' } } : undefined);
    await open(`/admin/accounts/${ALPHA_ID}`);
    expect(fake.find({ table: 'profile_status_log' }).map((c) => c.columns))
      .toEqual(['id, old_status, new_status, old_role, new_role, changed_by, changed_at', 'id, old_status, new_status, changed_by, changed_at']);
    expect(lines()).toEqual(['Approved by Desk Admin']);
    expect(within(section('Status history')).queryByRole('alert')).toBeNull();
  });
});

describe('readable labels in the account selects (AW-149)', () => {
  const texts = (select) => [...select.querySelectorAll('option')].map((o) => [o.value, o.textContent]);

  it('labels the list’s status, tier and role options, values unchanged', async () => {
    await open();
    const row = screen.getByRole('link', { name: 'Alpha Food Mart' }).closest('tr');
    expect(texts(within(row).getByRole('combobox', { name: 'Status for Alpha Food Mart' })))
      .toEqual([['pending', 'Pending'], ['approved', 'Approved'], ['suspended', 'Suspended']]);
    expect(texts(within(row).getByRole('combobox', { name: 'Tier for Alpha Food Mart' })))
      .toEqual([['standard', 'Standard'], ['silver', 'Silver'], ['gold', 'Gold']]);
    expect(texts(within(row).getByRole('combobox', { name: 'Role for Alpha Food Mart' }))).toEqual([['customer', 'Customer'], ['admin', 'Admin']]);
  });

  it('labels the account page’s selects and its status pill', async () => {
    await open(`/admin/accounts/${BRAVO_ID}`);
    const controls = section('Status, tier and role');
    expect(texts(within(controls).getByLabelText('Status')).map(([, text]) => text)).toEqual(['Pending', 'Approved', 'Suspended']);
    expect(texts(within(controls).getByLabelText('Tier')).map(([, text]) => text)).toEqual(['Standard', 'Silver', 'Gold']);
    expect(texts(within(controls).getByLabelText('Role')).map(([, text]) => text)).toEqual(['Customer', 'Admin']);
    expect(document.querySelector('.account-pill').textContent).toBe('Pending');
  });
});
