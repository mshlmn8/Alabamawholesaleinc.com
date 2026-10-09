// One pricing notice above a product grid (AW-224): guests get Sign in and
// Apply, accounts waiting for approval a link to their status, approved and
// suspended accounts nothing.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PricingNotice } from './PricingNotice.jsx';

const notice = () => document.querySelector('.pricing-notice');

describe('PricingNotice', () => {
  it('offers guests Sign in and Apply for a trade account', () => {
    const onLoginClick = vi.fn();
    const onApplyClick = vi.fn();
    render(<PricingNotice profile={null} isApprovedBuyer={false} onLoginClick={onLoginClick} onApplyClick={onApplyClick} />);
    expect(notice().className).toBe('callout info pricing-notice');
    expect(notice().querySelector('p').textContent).toBe('Trade prices are shown to approved accounts.');
    const signIn = screen.getByRole('button', { name: 'Sign in' });
    expect(signIn.className).toBe('button sm');
    const apply = screen.getByRole('button', { name: 'Apply for a trade account' });
    expect(apply.className).toBe('text-link');
    fireEvent.click(signIn);
    fireEvent.click(apply);
    expect(onLoginClick).toHaveBeenCalledTimes(1);
    expect(onApplyClick).toHaveBeenCalledTimes(1);
  });

  it('tells an account waiting for approval, with a link to its status', () => {
    render(<PricingNotice profile={{ id: 'p', status: 'pending' }} isApprovedBuyer={false} onLoginClick={vi.fn()} onApplyClick={vi.fn()} />);
    expect(notice().querySelector('p').textContent).toBe('Pricing unlocks after your account is approved.');
    expect(screen.getByRole('link', { name: 'View approval status' }).getAttribute('href')).toBe('/account');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows nothing to approved or suspended accounts', () => {
    const { container, rerender } = render(<PricingNotice profile={{ id: 'a', status: 'approved' }} isApprovedBuyer />);
    expect(container.innerHTML).toBe('');
    rerender(<PricingNotice profile={{ id: 's', status: 'suspended' }} isApprovedBuyer={false} />);
    expect(container.innerHTML).toBe('');
  });
});
