// The /shipping policy is "Delivery policy" in the policy navigation and its
// breadcrumb (AW-316), so it isn't confused with /delivery, "Delivery &
// service area". The page keeps its own heading and title.
import { act, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { navigate } from '../../lib/router.js';
import { POLICY_LINKS, PolicyNav } from './SupportShell.jsx';
import { POLICY_TITLES, PolicyPage } from './PolicyPage.jsx';

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  act(() => navigate('/shipping', { replace: true }));
});

describe('policy link names', () => {
  it('calls /shipping "Delivery policy" in the policy navigation', () => {
    expect(POLICY_LINKS.find((l) => l.page === 'shipping').label).toBe('Delivery policy');
    render(<PolicyNav current="shipping" />);
    const nav = screen.getByRole('navigation', { name: 'Customer policies' });
    const names = within(nav).getAllByRole('link').map((a) => a.textContent);
    expect(names).toContain('Delivery policy');
    expect(names).toContain('Delivery & service area');
    expect(names).not.toContain('Delivery');
    expect(within(nav).getByRole('link', { name: 'Delivery policy' }).getAttribute('aria-current')).toBe('page');
  });

  it('puts "Delivery policy" in the breadcrumb and keeps the page heading and title', () => {
    render(<PolicyPage kind="shipping" />);
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByText('Delivery policy')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Delivery');
    expect(POLICY_TITLES.shipping).toBe('Delivery');
  });
});
