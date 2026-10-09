// Order history that didn't load says what to do, never the database's own
// message (AW-084).
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

const { AccountPage, ORDERS_LOAD_ERROR } = await import('./AccountPage.jsx');

const PROFILE = { id: 'u1', business: 'Test Market LLC', name: 'Test Buyer', email: 'buyer@example.test', status: 'approved', role: 'customer', pricing_tier: 'silver' };

beforeEach(() => { mock.result = { data: [], error: null }; });

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
