// The /shipping policy is "Delivery policy" in the policy navigation, its
// breadcrumb (AW-316), its h1 and its tab title (NEW-043), so it isn't
// confused with /delivery, "Delivery & service area". The two pages are both
// kept and link to each other (AW-130).
import { act, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { navigate } from '../../lib/router.js';
import { pageMeta } from '../../lib/meta.js';
import { DeliveryPage } from './DeliveryPage.jsx';
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
    const nav = screen.getByRole('navigation', { name: 'Help and policies' });
    const names = within(nav).getAllByRole('link').map((a) => a.textContent);
    expect(names).toContain('Delivery policy');
    expect(names).toContain('Delivery & service area');
    expect(names).not.toContain('Delivery');
    expect(within(nav).getByRole('link', { name: 'Delivery policy' }).getAttribute('aria-current')).toBe('page');
  });

  it('names the page "Delivery policy" in its breadcrumb, h1 and title, the words its links use (NEW-043)', () => {
    render(<PolicyPage kind="shipping" />);
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByText('Delivery policy')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Delivery policy');
    expect(POLICY_TITLES.shipping).toBe('Delivery policy');
    expect(pageMeta({ page: 'shipping' }, [], []).title).toBe('Delivery policy · Alabama Wholesale Inc');
  });

  it('links the delivery policy and "Delivery & service area" to each other (AW-130)', () => {
    const { unmount } = render(<PolicyPage kind="shipping" />);
    const body = document.querySelector('.policy-body');
    expect(within(body).getByRole('link', { name: 'Delivery & service area' }).getAttribute('href')).toBe('/delivery');
    unmount();
    render(<DeliveryPage />);
    const main = document.querySelector('.support-layout-main');
    expect(within(main).getByRole('link', { name: 'Delivery policy' }).getAttribute('href')).toBe('/shipping');
  });

  it('calls /shipping "Delivery policy" in the Trade terms too, never just "Delivery"', () => {
    render(<PolicyPage kind="terms" />);
    const body = document.querySelector('.policy-body');
    expect(within(body).getByRole('link', { name: 'Delivery policy' }).getAttribute('href')).toBe('/shipping');
    expect(within(body).queryByRole('link', { name: 'Delivery' })).toBeNull();
  });
});
