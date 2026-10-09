// Reorder from order history after the catalog corrections (AW-135, AW-138,
// AW-126): an order saved with the old SKUs and variant labels goes back into
// the cart against the corrected catalog, with nothing reported unavailable.
// order_items keep their snapshots, so the history still shows the old codes.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PRODUCTS } from '../../data/products.js';
import { VARIANT_ALIASES } from '../../data/catalogAliases.js';

// The old #60 label, rebuilt from its alias key so it is spelled out only there.
const OLD_60_KEY = Object.keys(VARIANT_ALIASES[60])[0];
const OLD_60_LABEL = `${OLD_60_KEY[0].toUpperCase()}${OLD_60_KEY.slice(1).replace(/-/g, ' ')}`;

const ORDER = {
  id: 'o-1', ref_num: 'T-C3-OLD-SKUS', status: 'fulfilled', total_units: 21, subtotal: null, created_at: '2026-09-01T12:00:00Z',
  order_items: [
    { id: 1, product_id: 60, variant: OLD_60_LABEL, product_name: `Geek Bar Pulse 15K — ${OLD_60_LABEL}`, sku: `AW-GEEKBAR-15K-${OLD_60_KEY.toUpperCase()}`, qty: 2, unit_price: null },
    { id: 2, product_id: 130, variant: 'Yellow', product_name: 'Brillo Basics all-purpose cleaner — Yellow', sku: 'AW-BRILLO-BASICS--YELLOW', qty: 1, unit_price: null },
    { id: 3, product_id: 171, variant: 'Cookies king', product_name: "Hershey's bars — Cookies king", sku: 'AW-HERSHEY-COOKIES-KING', qty: 3, unit_price: null },
    { id: 4, product_id: 122, variant: 'Case', product_name: 'Bath tissue 4-pack — Case', sku: 'AW-4PK-TISSUES-CASE', qty: 4, unit_price: null },
    { id: 5, product_id: 329, variant: 'Tips', product_name: 'RAW tips — Tips', sku: 'AW-RAW-TIPS', qty: 5, unit_price: null },
    { id: 6, product_id: 367, variant: 'Watermelon', product_name: 'LooseLeaf wraps 5-pack — Watermelon', sku: 'AW-LOOSE-LEAFS-5P-WATERMELON', qty: 6, unit_price: null },
  ],
};

vi.mock('../../lib/supabase.js', () => {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    abortSignal: () => query,
    then: (resolve) => Promise.resolve({ data: [ORDER], error: null }).then(resolve),
  };
  return { supabase: { from: () => query }, isBackendConfigured: true, AUTH_STORAGE_KEY: 'aw-auth' };
});

const { AccountPage } = await import('./AccountPage.jsx');

const PROFILE = { id: 'u1', business: 'Test Market LLC', name: 'Test Buyer', email: 'buyer@example.test', status: 'approved', role: 'customer', pricing_tier: 'silver' };

describe('AccountPage Reorder with old SKUs', () => {
  it('adds every line of an order saved before the corrections', async () => {
    const addLines = vi.fn();
    render(<AccountPage profile={PROFILE} account="ready" products={PRODUCTS} addLines={addLines} isApprovedBuyer />);
    // The history shows the order as it was saved.
    expect(await screen.findByText('(AW-BRILLO-BASICS--YELLOW)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reorder' }));
    expect(addLines).toHaveBeenCalledWith([
      { productId: 60, variant: 'F*** fab', qty: 2 },
      { productId: 130, variant: 'Yellow', qty: 1 },
      { productId: 171, variant: 'Cookies, king size', qty: 3 },
      { productId: 122, variant: null, qty: 4 },
      { productId: 329, variant: null, qty: 5 },
      { productId: 367, variant: 'Watermelon', qty: 6 },
    ]);
    expect(screen.getByRole('status').textContent).toBe('Added 6 lines (21 units) to your order.Review cart');
  });
});
