// Checkout's buyer details for a signed-in account (AW-102): phone, store
// state and store address from the profile, then the address of the last
// delivery order (loadShipTo, a stand-in here: no network), never over typed
// text, and "Use a different address". Details are test values.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuotePage } from './QuotePage.jsx';

vi.mock('../lib/announce.js', async (importOriginal) => ({ ...(await importOriginal()), announce: vi.fn() }));

const ITEMS = [{ lineKey: '14', productId: 14, variant: null, name: 'Kite cigarette tobacco', sku: 'AW-KITE', cat: 'TOBACCO', qty: 2, price: 10 }];
const A = {
  id: 'a', business: 'Alpha Food Mart', name: 'Alice Alpha', email: 'alpha@example.test', phone: '205-000-0001', status: 'approved',
  state: 'AL', store_street: '1 Alpha Way', store_city: 'Birmingham', store_zip: '35203',
};
const B = { id: 'b', business: 'Bravo Tobacco Outlet', name: 'Bea Bravo', email: 'bravo@example.test', phone: '205-000-0002', status: 'approved', state: 'GA' };
const SAVED = { shipStreet: '4100 Test Rd', shipCity: 'Hoover', shipState: 'AL', shipZip: '35244' };

function page(props) {
  return (
    <QuotePage items={ITEMS} total={20} setLine={vi.fn()} chooseVariant={vi.fn()} removeLine={vi.fn()} removeLines={vi.fn()} clearCart={vi.fn()}
               isBackendConfigured onSignIn={vi.fn()} account="ready" signedIn isApprovedBuyer pricesStatus="ready" {...props} />
  );
}
const value = (id) => document.getElementById(id).value;
const address = () => ['ship-street', 'ship-city', 'ship-state', 'ship-zip'].map(value);
const other = () => screen.queryByRole('button', { name: 'Use a different address' });
// A loader that answers when told to.
function deferredLoader() {
  const pending = [];
  const load = vi.fn((userId, { signal } = {}) => new Promise((resolve) => pending.push({ userId, signal, resolve })));
  return { load, pending };
}

describe('QuotePage ship-to for a signed-in buyer (AW-102)', () => {
  it('fills phone, store state and store address from the profile', () => {
    render(page({ profile: A }));
    expect([value('quote-business'), value('quote-contact'), value('quote-email'), value('quote-phone')])
      .toEqual(['Alpha Food Mart', 'Alice Alpha', 'alpha@example.test', '205-000-0001']);
    expect(address()).toEqual(['1 Alpha Way', 'Birmingham', 'AL', '35203']);
    expect(document.querySelector('.ship-from span').textContent).toBe('Your store address.');
  });

  it('then uses the last delivery address, asked for once per account', async () => {
    const { load, pending } = deferredLoader();
    render(page({ profile: A, loadShipTo: load }));
    expect(load).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[0][0]).toBe('a');
    expect(load.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    await act(async () => pending[0].resolve(SAVED));
    expect(address()).toEqual(['4100 Test Rd', 'Hoover', 'AL', '35244']);
    expect(document.querySelector('.ship-from span').textContent).toBe('Your last delivery address.');
  });

  it('never writes over an address the buyer started typing', async () => {
    const { load, pending } = deferredLoader();
    render(page({ profile: A, loadShipTo: load }));
    fireEvent.change(document.getElementById('ship-street'), { target: { value: '9 Typed Rd' } });
    await act(async () => pending[0].resolve(SAVED));
    expect(address()).toEqual(['9 Typed Rd', 'Birmingham', 'AL', '35203']);
    // A typed address is not the account's: nothing to offer.
    expect(other()).toBeNull();
  });

  it('"Use a different address" empties the four fields and moves to Street', async () => {
    render(page({ profile: A, loadShipTo: async () => SAVED }));
    await act(async () => {});
    const button = other();
    expect(button.className).toBe('text-link');
    expect(button.getAttribute('type')).toBe('button');
    fireEvent.click(button);
    expect(address()).toEqual(['', '', '', '']);
    expect(document.activeElement.id).toBe('ship-street');
    expect(other()).toBeNull();
    // The rest of the details stay.
    expect(value('quote-phone')).toBe('205-000-0001');
  });

  it('keeps the form as it is when there is no last address or it can’t be read', async () => {
    const view = render(page({ profile: A, loadShipTo: async () => null }));
    await act(async () => {});
    expect(address()).toEqual(['1 Alpha Way', 'Birmingham', 'AL', '35203']);
    view.unmount();
    render(page({ profile: A, loadShipTo: () => Promise.reject(new Error('offline')) }));
    await act(async () => {});
    expect(address()).toEqual(['1 Alpha Way', 'Birmingham', 'AL', '35203']);
  });

  it('asks nothing for a guest, and drops an answer that arrives after the account changed', async () => {
    const { load, pending } = deferredLoader();
    const view = render(page({ profile: null, account: 'signed-out', signedIn: false, isApprovedBuyer: false, loadShipTo: load }));
    expect(load).not.toHaveBeenCalled();
    expect(other()).toBeNull();
    view.rerender(page({ profile: A, loadShipTo: load }));
    expect(load).toHaveBeenCalledTimes(1);
    view.rerender(page({ profile: B, loadShipTo: load }));
    expect(pending[0].signal.aborted).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
    // Buyer A's address, late: not for buyer B.
    await act(async () => pending[0].resolve(SAVED));
    expect(address()).toEqual(['', '', 'GA', '']);
    await act(async () => pending[1].resolve({ shipStreet: '2 Bravo Rd', shipCity: 'Atlanta', shipState: 'GA', shipZip: '30301' }));
    expect(address()).toEqual(['2 Bravo Rd', 'Atlanta', 'GA', '30301']);
    expect(value('quote-business')).toBe('Bravo Tobacco Outlet');
  });

  it('offers nothing while will-call hides the address', async () => {
    render(page({ profile: A, loadShipTo: async () => SAVED }));
    await act(async () => {});
    fireEvent.change(screen.getByLabelText('Delivery method'), { target: { value: 'willcall' } });
    expect(other()).toBeNull();
    expect(document.getElementById('ship-street')).toBeNull();
  });
});
