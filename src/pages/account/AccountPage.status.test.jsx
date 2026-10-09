// My account for an account on hold (AW-101): why nothing can be ordered and
// who to call. And order history that didn't load says what to do, never the
// database's own message (AW-084).
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ result: { data: [], error: null } }));

vi.mock('../../lib/supabase.js', () => {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    then: (resolve) => Promise.resolve(mock.result).then(resolve),
  };
  return { supabase: { from: () => query }, isBackendConfigured: true, AUTH_STORAGE_KEY: 'aw-auth' };
});

// The documents panel needs the auth provider (DocumentUploads.test covers
// it); here it shows what it was given.
vi.mock('../../components/DocumentUploads.jsx', () => ({
  ApplicationDocuments: ({ status, disabled, id }) => (
    <section id={id} data-testid="documents" data-status={status} data-disabled={String(disabled)}><h2>License documents</h2></section>
  ),
}));

const { AccountPage, ORDERS_LOAD_ERROR } = await import('./AccountPage.jsx');

const PROFILE = { id: 'u1', business: 'Test Market LLC', name: 'Test Buyer', email: 'buyer@example.test', status: 'approved', role: 'customer', pricing_tier: 'silver' };
const PAUSED = /^Ordering is paused on this account\. Call .+ or email .+ and a trade rep will help you sort it out\.$/;

beforeEach(() => { mock.result = { data: [], error: null }; });

describe('AccountPage for an account on hold (AW-101)', () => {
  it('says ordering is paused, with the trade desk’s phone and email, right after the stats', async () => {
    render(<AccountPage profile={{ ...PROFILE, status: 'suspended' }} account="ready" products={[]} />);
    const notice = screen.getByText((_, el) => el?.tagName === 'P' && PAUSED.test(el.textContent));
    expect(notice.className).toBe('notice');
    expect(notice.previousElementSibling.className).toBe('account-stats');
    expect([...notice.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([expect.stringMatching(/^tel:/), expect.stringMatching(/^mailto:/)]);
    expect(await screen.findByText('No orders yet')).toBeTruthy();
  });

  it('shows no such notice to approved or pending accounts', async () => {
    for (const status of ['approved', 'pending']) {
      const view = render(<AccountPage profile={{ ...PROFILE, status }} account="ready" products={[]} />);
      expect(screen.queryByText(/Ordering is paused/)).toBeNull();
      await screen.findByText('No orders yet');
      view.unmount();
    }
  });
});

describe('AccountPage order history that did not load (AW-084)', () => {
  it('says what to do, with the trade desk, and never the database’s message', async () => {
    mock.result = { data: null, error: { code: '42501', message: 'permission denied for table orders', details: null, hint: null } };
    render(<AccountPage profile={PROFILE} account="ready" products={[]} />);
    const error = await screen.findByText((_, el) => el?.tagName === 'P' && el.className === 'form-error');
    expect(error.textContent).toMatch(/^We couldn’t load your orders\. Refresh the page, or call .+ or email .+\.$/);
    expect(error.textContent.startsWith(ORDERS_LOAD_ERROR)).toBe(true);
    expect([...error.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([expect.stringMatching(/^tel:/), expect.stringMatching(/^mailto:/)]);
    expect(screen.queryByText(/permission denied|Couldn't load orders/)).toBeNull();
    expect(screen.queryByText('Loading…')).toBeNull();
  });
});

// A pending applicant adds license documents on My account, where the
// application dialog sends them (AW-085).
describe('AccountPage license documents (AW-085)', () => {
  it('gives a pending account the documents panel at #documents, after the notices', async () => {
    render(<AccountPage profile={{ ...PROFILE, status: 'pending' }} account="ready" products={[]} />);
    const panel = screen.getByTestId('documents');
    expect(panel.id).toBe('documents');
    expect(panel.dataset).toMatchObject({ status: 'pending', disabled: 'false' });
    expect(panel.previousElementSibling.textContent).toMatch(/^Your account is awaiting approval\./);
    expect(screen.queryByRole('link', { name: 'view or replace' })).toBeNull();
    await screen.findByText('No orders yet');
  });

  it('disables the panel without the account backend', async () => {
    render(<AccountPage profile={{ ...PROFILE, status: 'pending' }} account="ready" products={[]} isBackendConfigured={false} />);
    expect(screen.getByTestId('documents').dataset.disabled).toBe('true');
    await screen.findByText('No orders yet');
  });

  it('keeps the one-line link to /apply for approved and suspended accounts', async () => {
    for (const status of ['approved', 'suspended']) {
      const view = render(<AccountPage profile={{ ...PROFILE, status }} account="ready" products={[]} />);
      expect(screen.queryByTestId('documents')).toBeNull();
      expect(screen.getByRole('link', { name: 'view or replace' }).getAttribute('href')).toBe('/apply');
      await screen.findByText('No orders yet');
      view.unmount();
    }
  });
});
