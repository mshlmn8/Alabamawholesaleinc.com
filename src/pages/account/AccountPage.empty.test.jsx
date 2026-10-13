// An empty order history is the shared empty state (AW-299): an h3 under the
// section's "Order history" h2, the line about Reorder, and a way to the
// catalog.
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// No orders: a fake client with an empty orders table (OrderHistory pages
// with range() and cancels with abortSignal()).
vi.mock('../../lib/supabase.js', async () => {
  const { createFakeSupabase } = await import('../admin/fakeSupabase.js');
  const fake = createFakeSupabase();
  return { supabase: fake.client, fake, isBackendConfigured: true, AUTH_STORAGE_KEY: 'aw-auth' };
});

const { AccountPage } = await import('./AccountPage.jsx');

const PROFILE = { id: 'u1', business: 'Test Market LLC', name: 'Test Buyer', email: 'buyer@example.test', status: 'approved', role: 'customer', pricing_tier: 'silver' };

describe('AccountPage with no orders (AW-299)', () => {
  it('shows the empty state under Order history, with a way to the catalog', async () => {
    render(<AccountPage profile={PROFILE} account="ready" products={[]} isApprovedBuyer />);
    const heading = await screen.findByRole('heading', { level: 3, name: 'No orders yet' });
    const box = heading.closest('.empty-state');
    expect(box.className).toBe('empty-state is-boxed');
    expect(box.closest('section').querySelector('h2').textContent).toBe('Order history');
    expect(box.querySelector('.empty-state-text').textContent).toBe('Orders you place will show up here, each with a one-click Reorder.');
    expect(screen.getByRole('link', { name: 'Browse the catalog' }).getAttribute('href')).toBe('/catalog');
  });
});
