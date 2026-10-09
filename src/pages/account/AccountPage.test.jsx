// Account and admin pages while auth loads (AW-186, AW-087), when the
// profile fails (AW-089), and "Sign out of all devices" (AW-337). Signed
// out, My account says what an account gives and offers Sign in and Apply,
// and a link to a section that arrives before the account does opens it
// once the account has loaded (AW-086).
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigate } from '../../lib/router.js';

// No network: order history reads from a fake client.
vi.mock('../../lib/supabase.js', async () => {
  const { createFakeSupabase } = await import('../admin/fakeSupabase.js');
  const fake = createFakeSupabase();
  return { supabase: fake.client, fake, isBackendConfigured: true, AUTH_STORAGE_KEY: 'aw-auth' };
});

const { fake } = await import('../../lib/supabase.js');
const { AccountPage, SIGNED_OUT_TEXT } = await import('./AccountPage.jsx');
const { AdminPage } = await import('../admin/AdminPage.jsx');

beforeEach(() => {
  fake.reset();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  // jsdom has no scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
  act(() => navigate('/account', { replace: true }));
});
afterEach(() => { delete Element.prototype.scrollIntoView; });

const PROFILE = { id: 'u1', business: 'Test Market LLC', name: 'Test Buyer', email: 'buyer@example.test', status: 'approved', role: 'customer', pricing_tier: 'silver' };

describe('AccountPage', () => {
  it('says it is loading, not "sign in", while the account loads', () => {
    render(<AccountPage profile={null} account="loading" onSignIn={vi.fn()} onApplyClick={vi.fn()} />);
    expect(screen.getByText('Loading your account…')).toBeTruthy();
    expect(screen.queryByText(SIGNED_OUT_TEXT)).toBeNull();
    expect(screen.queryByRole('button', { name: /Sign in|Apply/ })).toBeNull();
  });

  it('offers Try again and Sign out when the profile did not load', () => {
    const onRetry = vi.fn();
    const onSignOut = vi.fn();
    render(<AccountPage profile={null} account="no-profile" onRetry={onRetry} onSignOut={onSignOut} />);
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onRetry).toHaveBeenCalled();
    expect(onSignOut).toHaveBeenCalled();
  });

  it('tells a signed-out visitor what an account gives, with Sign in and Apply (AW-086)', () => {
    const onSignIn = vi.fn();
    const onApplyClick = vi.fn();
    render(<AccountPage profile={null} account="signed-out" onSignIn={onSignIn} onApplyClick={onApplyClick} />);
    expect(SIGNED_OUT_TEXT).toBe('A trade account shows your order history, lets you reorder by SKU with Quick Reorder, and shows your wholesale prices once it is approved.');
    expect(screen.getByText(SIGNED_OUT_TEXT).tagName).toBe('P');
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply for a trade account' }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(onApplyClick).toHaveBeenCalledTimes(1);
  });

  it('keeps one heading element from loading to loaded', () => {
    const view = render(<AccountPage profile={null} account="loading" />);
    const heading = screen.getByRole('heading', { level: 1 });
    view.rerender(<AccountPage profile={PROFILE} account="ready" products={[]} />);
    expect(screen.getByRole('heading', { level: 1 })).toBe(heading);
    expect(heading.textContent).toBe('Test Market LLC');
  });

  it('offers Change password and Sign out under the email (AW-252)', () => {
    const onSignOut = vi.fn();
    const view = render(<AccountPage profile={PROFILE} account="ready" products={[]} onSignOut={onSignOut} />);
    const email = screen.getByText(PROFILE.email);
    const links = email.nextElementSibling;
    expect(links.className).toBe('dialog-actions compact-actions account-links');
    expect(screen.getByRole('link', { name: 'Change password' }).getAttribute('href')).toBe('/reset-password');
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect([...links.children].map((el) => el.textContent)).toEqual(['Change password', 'Sign out']);
    view.rerender(<AccountPage profile={PROFILE} account="ready" products={[]} onSignOut={onSignOut} signingOut />);
    expect(screen.getByRole('button', { name: 'Sign out' }).disabled).toBe(true);
  });

  it('signs out of all devices on request', () => {
    const onSignOutEverywhere = vi.fn();
    const view = render(<AccountPage profile={PROFILE} account="ready" products={[]} onSignOutEverywhere={onSignOutEverywhere} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out of all devices' }));
    expect(onSignOutEverywhere).toHaveBeenCalled();
    view.rerender(<AccountPage profile={PROFILE} account="ready" products={[]} onSignOutEverywhere={onSignOutEverywhere} signingOut />);
    expect(screen.getByRole('button', { name: 'Signing out…' }).disabled).toBe(true);
  });
});

// A guest's Quick Reorder, then sign-in; a reload of /account#documents
// (AW-086).
describe('AccountPage sections a link points at', () => {
  const quickReorder = () => screen.getByRole('heading', { level: 2, name: 'Reorder by SKU' });

  it('brings Quick Reorder into view and focuses its heading once the account has loaded', async () => {
    act(() => navigate('/account#quick-reorder'));
    const view = render(<AccountPage profile={null} account="loading" />);
    view.rerender(<AccountPage profile={PROFILE} account="ready" products={[]} />);
    await waitFor(() => expect(document.activeElement).toBe(quickReorder()));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    // Once: later updates leave focus where the buyer puts it.
    act(() => document.body.focus());
    quickReorder().blur();
    view.rerender(<AccountPage profile={{ ...PROFILE }} account="ready" products={[]} />);
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(document.activeElement).toBe(document.body);
  });

  it('waits for a dialog over the page to close, so it lands after the dialog hands focus back', async () => {
    act(() => navigate('/account#quick-reorder'));
    const cover = document.body.appendChild(document.createElement('div'));
    cover.setAttribute('inert', '');
    const view = render(<AccountPage profile={null} account="loading" />, { container: cover.appendChild(document.createElement('div')) });
    view.rerender(<AccountPage profile={PROFILE} account="ready" products={[]} />);
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(document.activeElement).not.toBe(quickReorder());
    cover.removeAttribute('inert');
    await waitFor(() => expect(document.activeElement).toBe(quickReorder()));
    view.unmount();
    cover.remove();
  });

  it('leaves a page that was ready from the start, or another address, to the router', async () => {
    act(() => navigate('/account#quick-reorder'));
    const view = render(<AccountPage profile={PROFILE} account="ready" products={[]} />);
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(document.activeElement).toBe(document.body);
    view.unmount();
    act(() => navigate('/account#order-history'));
    const other = render(<AccountPage profile={null} account="loading" />);
    other.rerender(<AccountPage profile={PROFILE} account="ready" products={[]} />);
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(document.activeElement).toBe(document.body);
  });
});

describe('AdminPage', () => {
  it('shows a loading state, never access denied, while auth loads (AW-087)', () => {
    render(<AdminPage profile={null} account="loading" onSignIn={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Admin');
    expect(screen.getByText('Loading your account…')).toBeTruthy();
    expect(screen.queryByText(/Sign in to continue|trade desk/)).toBeNull();
  });

  it('still helps signed-out visitors and other accounts', () => {
    const view = render(<AdminPage profile={null} account="signed-out" onSignIn={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sign in to continue');
    view.rerender(<AdminPage profile={PROFILE} account="ready" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('This page is for the trade desk');
    expect(screen.getByRole('link', { name: /My account/ }).getAttribute('href')).toBe('/account');
  });
});
