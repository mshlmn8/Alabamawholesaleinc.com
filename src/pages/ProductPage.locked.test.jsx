// The product page's price slot without a price (AW-133): a sentence and one
// way forward for guests, accounts waiting for approval and suspended
// accounts, never 'Sign in' or 'Pending' set as a price, and no second set
// of links under the add button. And the add labels match the basket terms
// (AW-132): the page, its related cards and the add toast.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { basketTerms } from '../data/terms.js';
import { COMPANY } from '../data/content.js';
import { dismissToast, getToast } from '../lib/toast.js';
import { ProductPage } from './ProductPage.jsx';

vi.mock('../lib/announce.js', async (importOriginal) => ({ ...(await importOriginal()), announce: vi.fn() }));

const P = [
  { id: 1, sku: 'AW-ONE', name: 'Kite cigarette tobacco', brand: 'Kite', cat: 'TOBACCO', sub: 'Pipe Tobacco', variants: [] },
  { id: 2, sku: 'AW-TWO', name: 'Gambler pipe tobacco', brand: 'Gambler', cat: 'TOBACCO', sub: 'Pipe Tobacco', variants: [] },
];
const PENDING = { id: 'p', status: 'pending' };
const SUSPENDED = { id: 's', status: 'suspended' };
const APPROVED = { id: 'a', status: 'approved' };
const page = (props) => (
  <ProductPage productId={1} products={P} cart={{}} addLine={vi.fn(() => ({ key: '1', qty: 1, capped: false }))} decLine={vi.fn()}
               profile={null} isApprovedBuyer={false} onLoginClick={vi.fn()} onApplyClick={vi.fn()} {...props} />
);
const slot = () => document.querySelector('.pd-price');
const info = () => document.querySelector('.pd-info');

afterEach(() => dismissToast());

describe('ProductPage price slot without a price (AW-133)', () => {
  it('tells a guest where prices show, with a sign-in button and the apply link', () => {
    const onLoginClick = vi.fn();
    const onApplyClick = vi.fn();
    render(page({ onLoginClick, onApplyClick }));
    expect(slot().className).toBe('pd-price is-locked');
    expect(slot().querySelector('b')).toBeNull();
    expect(slot().querySelector('p').textContent).toBe('Trade prices are shown to approved accounts.');
    const signIn = within(slot()).getByRole('button', { name: 'Sign in to see wholesale prices' });
    expect(signIn.className).toBe('button ghost');
    fireEvent.click(signIn);
    expect(onLoginClick).toHaveBeenCalledTimes(1);
    const apply = within(slot()).getByRole('button', { name: 'Apply for a trade account' });
    expect(apply.className).toBe('text-link');
    fireEvent.click(apply);
    expect(onApplyClick).toHaveBeenCalledTimes(1);
  });

  it('asks a guest to sign in once, in the price slot only', () => {
    render(page({}));
    expect(within(info()).getAllByRole('button', { name: /sign in/i })).toHaveLength(1);
    expect(within(info()).getAllByRole('button', { name: /apply/i })).toHaveLength(1);
    expect(info().querySelector('.compact-actions')).toBeNull();
    expect(within(info()).queryByText('Sign in for pricing')).toBeNull();
    expect(screen.queryByText('Apply for account')).toBeNull();
  });

  it('tells an account waiting for approval when pricing unlocks, with its status page', () => {
    render(page({ profile: PENDING }));
    expect(slot().className).toBe('pd-price is-locked');
    expect(slot().querySelector('b')).toBeNull();
    expect(slot().querySelector('p').textContent).toBe('Pricing unlocks after your account is approved.');
    const status = within(slot()).getByRole('link', { name: 'View approval status' });
    expect(status.getAttribute('href')).toBe('/account');
    expect(status.className).toBe('text-link');
    expect(within(info()).getAllByRole('link', { name: 'View approval status' })).toHaveLength(1);
    expect(within(info()).queryByRole('button', { name: /sign in|apply/i })).toBeNull();
  });

  it('tells a suspended account ordering is paused, with the trade desk', () => {
    render(page({ profile: SUSPENDED }));
    expect(slot().className).toBe('pd-price is-locked');
    expect(slot().textContent).toMatch(/^Ordering is paused on this account\. Call .+ or email .+ and a trade rep will help you sort it out\.$/);
    expect(slot().querySelector(`a[href="tel:${COMPANY.phoneRaw}"]`)).toBeTruthy();
    expect(slot().querySelector(`a[href="mailto:${COMPANY.email}"]`)).toBeTruthy();
    expect(within(info()).queryByRole('link', { name: 'View approval status' })).toBeNull();
  });

  // A signed-in account's profile still loading, or failed (NEW-002): never
  // the guest's Sign in and Apply.
  it('says the account is being checked while it loads, with nothing to press', () => {
    render(page({ account: 'loading' }));
    expect(slot().className).toBe('pd-price is-locked');
    expect(slot().querySelector('b')).toBeNull();
    const status = within(slot()).getByRole('status');
    expect(status.textContent).toBe('Checking your account…');
    const hold = slot().querySelector('.pd-price-hold');
    expect(hold.getAttribute('aria-hidden')).toBe('true');
    expect(slot().querySelectorAll('button, a')).toHaveLength(0);
    expect(within(info()).queryByRole('button', { name: /sign in|apply/i })).toBeNull();
  });

  it('says prices need the account details when the profile didn’t load', () => {
    render(page({ account: 'no-profile' }));
    expect(slot().className).toBe('pd-price is-locked');
    expect(slot().querySelector('b')).toBeNull();
    expect(slot().textContent).toBe('Prices need your account details.');
    expect(slot().querySelectorAll('button, a')).toHaveLength(0);
    expect(within(info()).queryByRole('button', { name: /sign in|apply/i })).toBeNull();
  });

  it('offers Sign in only when nobody is signed in', () => {
    render(page({ account: 'signed-out' }));
    expect(within(slot()).getByRole('button', { name: 'Sign in to see wholesale prices' })).toBeTruthy();
  });

  it('keeps the price itself for an approved buyer', () => {
    render(page({ profile: APPROVED, isApprovedBuyer: true, priceOf: () => 12.25, pricesStatus: 'ready' }));
    expect(slot().className).toBe('pd-price');
    expect(slot().querySelector('b').textContent).toBe('$12.25');
  });
});

describe('ProductPage add labels follow the basket terms (AW-132)', () => {
  for (const [who, props] of [['a guest', {}], ['an approved buyer', { profile: APPROVED, isApprovedBuyer: true }]]) {
    it(`says ${who} adds to the ${basketTerms(Boolean(props.isApprovedBuyer)).noun}, on the page, its cards and the toast`, () => {
      const basket = basketTerms(Boolean(props.isApprovedBuyer));
      render(page(props));
      const add = within(document.querySelector('.qty-row')).getByRole('button', { name: basket.add });
      const card = document.querySelector('.card-grid');
      expect(within(card).getByRole('button', { name: new RegExp(`^${basket.add}`) })).toBeTruthy();
      fireEvent.click(add);
      expect(getToast().action.label).toBe(basket.view);
      expect(getToast().text).toMatch(new RegExp(`to your ${basket.noun}\\.$`));
    });
  }
});
