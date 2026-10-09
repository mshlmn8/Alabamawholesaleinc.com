// The phone menu's account group (AW-131): Sign in, then the one apply
// button at the bottom, never a second 'Sign Up' item; sentence case.
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MobileMenu } from './MobileMenu.jsx';

const go = { logout: vi.fn(), signin: vi.fn(), signup: vi.fn(), help: vi.fn() };
const menu = (props) => (
  <MobileMenu onClose={vi.fn()} onFollowLink={vi.fn()} departments={[]} products={[]} user={null} isAdmin={false} go={go} {...props} />
);

describe('MobileMenu account labels (AW-131)', () => {
  it('lists the apply action once, as the bottom button, for guests', () => {
    render(menu());
    const group = screen.getByRole('navigation', { name: 'Account and help' });
    expect([...group.querySelectorAll('a, button')].map((el) => el.textContent)).toEqual(['Sign in', 'Quick reorder', 'Help']);
    const apply = screen.getAllByRole('button', { name: 'Apply for a trade account' });
    expect(apply).toHaveLength(1);
    expect(apply[0].closest('.menu-contact')).not.toBeNull();
    apply[0].click();
    expect(go.signup).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Sign up/i })).toBeNull();
  });

  it('says My account, Quick reorder and Sign out to a signed-in buyer, with no apply button', () => {
    render(menu({ user: { name: '', business: '' } }));
    const group = screen.getByRole('navigation', { name: 'Account and help' });
    // (My account's line for the business name is empty here, AW-267.)
    expect([...group.querySelectorAll('a, button')].map((el) => el.textContent.trim())).toEqual(['My account', 'Quick reorder', 'Sign out', 'Help']);
    expect(screen.queryByRole('button', { name: 'Apply for a trade account' })).toBeNull();
    expect(screen.getByRole('link', { name: 'New arrivals' })).toBeTruthy();
  });
});
