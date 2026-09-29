// Account and admin pages while auth loads (AW-186, AW-087), when the
// profile fails (AW-089), and "Sign out of all devices" (AW-337).
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccountPage } from './AccountPage.jsx';
import { AdminPage } from '../admin/AdminPage.jsx';

const PROFILE = { id: 'u1', business: 'Test Market LLC', name: 'Test Buyer', email: 'buyer@example.test', status: 'approved', role: 'customer', pricing_tier: 'silver' };

describe('AccountPage', () => {
  it('says it is loading, not "sign in", while the account loads', () => {
    render(<AccountPage profile={null} account="loading" onSignIn={vi.fn()} />);
    expect(screen.getByText('Loading your account…')).toBeTruthy();
    expect(screen.queryByText(/Sign in to view your account/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Sign in/ })).toBeNull();
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

  it('asks a signed-out visitor to sign in', () => {
    render(<AccountPage profile={null} account="signed-out" onSignIn={vi.fn()} />);
    expect(screen.getByText(/Sign in to view your account/)).toBeTruthy();
  });

  it('keeps one heading element from loading to loaded', () => {
    const view = render(<AccountPage profile={null} account="loading" />);
    const heading = screen.getByRole('heading', { level: 1 });
    view.rerender(<AccountPage profile={PROFILE} account="ready" products={[]} />);
    expect(screen.getByRole('heading', { level: 1 })).toBe(heading);
    expect(heading.textContent).toBe('Test Market LLC');
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
