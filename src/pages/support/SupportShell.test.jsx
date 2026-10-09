// One help and policy nav on every support page (AW-122): the same six pages
// in the same order, the current one marked (AW-273), and the page content
// beside it with the full-width contact strip after it.
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PolicyNav, POLICY_LINKS, SUPPORT_NAV } from './SupportShell.jsx';
import { PolicyPage } from './PolicyPage.jsx';
import { ContactPage } from './ContactPage.jsx';
import { DeliveryPage } from './DeliveryPage.jsx';
import { ApplyPage } from './ApplyPage.jsx';

// The documents panel needs the auth provider; these tests are about the page around it.
vi.mock('../../components/DocumentUploads.jsx', () => ({ ApplicationDocuments: () => null }));

const ORDER = [
  ['Contact & visit', '/contact'],
  ['Delivery & service area', '/delivery'],
  ['Delivery policy', '/shipping'],
  ['Apply for an account', '/apply'],
  ['Trade terms', '/terms'],
  ['Privacy', '/privacy'],
];
const nav = () => screen.getByRole('navigation', { name: 'Help and policies' });
const links = () => within(nav()).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')]);
const current = () => within(nav()).getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.textContent);

describe('PolicyNav', () => {
  it('lists the help and policy pages in order under one eyebrow', () => {
    render(<PolicyNav current="terms" />);
    expect(links()).toEqual(ORDER);
    expect(SUPPORT_NAV.map((l) => l.label)).toEqual(ORDER.map(([label]) => label));
    expect(nav().querySelector('.eyebrow').textContent).toBe('HELP & POLICIES');
    expect(current()).toEqual(['Trade terms']);
  });

  it('marks nothing when the page is not in the list', () => {
    render(<PolicyNav current="catalog" />);
    expect(current()).toEqual([]);
  });

  it('keeps the short crumb labels for the policy pages', () => {
    expect(POLICY_LINKS.find((l) => l.page === 'shipping').label).toBe('Delivery');
  });
});

// The layout around a page: the nav, then the content in .support-layout-main.
const layoutOf = (container) => {
  const layout = container.querySelector('.support-layout');
  return { layout, main: layout?.querySelector(':scope > .support-layout-main'), nav: layout?.querySelector(':scope > nav.policy-nav') };
};

describe('SupportLayout on every support page', () => {
  it.each([['shipping', 'Delivery policy', 'Delivery'], ['privacy', 'Privacy', 'Privacy'], ['terms', 'Trade terms', 'Trade terms']])(
    'puts the %s policy beside the nav, marked current, with the strip after it',
    (kind, label, crumb) => {
      const { container } = render(<PolicyPage kind={kind} />);
      const { main, nav: side } = layoutOf(container);
      expect(side).toBeTruthy();
      expect(main.querySelector(':scope > article.policy-body')).toBeTruthy();
      expect(current()).toEqual([label]);
      expect(container.querySelector('.crumbs').textContent).toContain(crumb);
      expect(container.querySelector('.support-layout ~ .contact-strip')).toBeTruthy();
      expect(screen.getAllByRole('navigation', { name: 'Help and policies' })).toHaveLength(1);
    },
  );

  it('wraps the contact cards, hours, will-call and the account call to action', () => {
    const { container } = render(<ContactPage onApplyClick={() => {}} />);
    const { main, nav: side } = layoutOf(container);
    expect(side).toBeTruthy();
    expect(current()).toEqual(['Contact & visit']);
    for (const cls of ['info-grid', 'support-columns', 'support-cta']) expect(main.querySelector(`:scope > .${cls}`), cls).toBeTruthy();
    // The page heading stays above the layout, full width.
    expect(container.querySelector('.page-head + .support-layout')).toBeTruthy();
  });

  it('wraps the delivery cards, the service-area check and the steps, not the contact strip', () => {
    const { container } = render(<DeliveryPage />);
    const { main } = layoutOf(container);
    expect(current()).toEqual(['Delivery & service area']);
    for (const cls of ['info-grid', 'eligibility', 'support-columns']) expect(main.querySelector(`:scope > .${cls}`), cls).toBeTruthy();
    expect(main.querySelector('.contact-strip')).toBeNull();
    expect(container.querySelector('.support-layout + .contact-strip')).toBeTruthy();
  });

  it('wraps the application checklist for a guest, and the status for a signed-in applicant', () => {
    const props = { isBackendConfigured: true, onApplyClick: vi.fn(), onLoginClick: vi.fn(), onResetClick: vi.fn() };
    const guest = render(<ApplyPage profile={null} account="signed-out" {...props} />);
    expect(current()).toEqual(['Apply for an account']);
    expect(layoutOf(guest.container).main.querySelector(':scope > .apply-layout')).toBeTruthy();
    expect(guest.container.querySelector('.support-layout + .contact-strip')).toBeTruthy();
    guest.unmount();

    // Signed in, the heading says 'Your trade account'; the nav keeps its label.
    const pending = render(<ApplyPage profile={{ id: 'p', name: 'Test Buyer', email: 'buyer@example.test', status: 'pending' }} account="ready" {...props} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Your trade account');
    expect(current()).toEqual(['Apply for an account']);
    expect(layoutOf(pending.container).main.querySelector(':scope > .status-panel')).toBeTruthy();
  });
});
