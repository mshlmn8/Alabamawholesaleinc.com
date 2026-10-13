// The home page's application panel (AW-281, AW-131): a heading that says
// what a store opens, the one apply label, and steps that match the rest of
// the site (a few minutes, no emailed price list).
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PRODUCTS } from '../data/products.js';
import { departmentsFor } from '../lib/departments.js';
import { HomePage } from './HomePage.jsx';

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

describe('HomePage application panel (AW-281)', () => {
  it('asks stores to open a trade account with the one apply label', () => {
    const onApplyClick = vi.fn();
    render(
      <HomePage products={PRODUCTS} departments={departmentsFor(PRODUCTS)} profile={null} isApprovedBuyer={false} cart={{}}
                addLine={vi.fn()} decLine={vi.fn()} onLoginClick={vi.fn()} onApplyClick={onApplyClick} />,
    );
    const panel = within(document.getElementById('apply'));
    expect(panel.getByRole('heading', { level: 2 }).textContent).toBe('Open a trade account');
    panel.getByRole('button', { name: 'Apply for a trade account' }).click();
    expect(onApplyClick).toHaveBeenCalledTimes(1);
    const steps = [...document.querySelectorAll('.apply-steps li p')].map(text);
    expect(steps[0]).toMatch(/ Takes a few minutes\.$/);
    expect(steps.join(' ')).not.toMatch(/price list|five minutes|email/i);
    expect(screen.queryByText(/Become a retail account|Start application/)).toBeNull();
  });
});

// Signed in, the panel never offers a second application (AW-066): it says
// where the account stands, as /apply's page head does, and links to My
// account once approved, or to the application status while it waits or is
// on hold. App passes signedIn and account in cardProps.
describe('HomePage account panel for a signed-in account (AW-066)', () => {
  const home = (props) => render(
    <HomePage products={PRODUCTS} departments={departmentsFor(PRODUCTS)} isApprovedBuyer={false} cart={{}}
              addLine={vi.fn()} decLine={vi.fn()} onLoginClick={vi.fn()} onApplyClick={vi.fn()} {...props} />,
  );
  const panel = () => {
    const section = document.getElementById('apply');
    return {
      eyebrow: section.querySelector('.eyebrow').textContent,
      title: section.querySelector('h2').textContent,
      text: section.querySelector('.trade-account-body p').textContent,
      links: [...section.querySelectorAll('a, button')].map((el) => [el.tagName, el.textContent, el.getAttribute('href')]),
    };
  };

  it.each([
    ['approved', 'ACCOUNT ACTIVE', ['A', 'My account', '/account']],
    ['pending', 'APPLICATION UNDER REVIEW', ['A', 'Application status', '/apply']],
    ['suspended', 'ACCOUNT ON HOLD', ['A', 'Application status', '/apply']],
  ])('shows a %s account its trade account, with no Apply and no steps', (status, eyebrow, link) => {
    home({ signedIn: true, account: 'ready', profile: { id: 'p', status }, isApprovedBuyer: status === 'approved' });
    expect(panel()).toMatchObject({ eyebrow, title: 'Your trade account', links: [link] });
    expect(panel().text.length).toBeGreaterThan(0);
    expect(within(document.getElementById('apply')).queryByRole('button')).toBeNull();
    expect(document.querySelector('.apply-steps')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Open a trade account' })).toBeNull();
  });

  it('offers My account while the profile loads, and keeps Apply for a guest', () => {
    const view = home({ signedIn: true, account: 'loading', profile: null });
    expect(panel()).toEqual({ eyebrow: 'TRADE ACCOUNT', title: 'Your trade account', text: 'Checking your account…', links: [['A', 'My account', '/account']] });
    view.unmount();
    home({ signedIn: false, account: 'signed-out', profile: null });
    expect(within(document.getElementById('apply')).getByRole('button', { name: 'Apply for a trade account' })).toBeTruthy();
    expect(document.querySelectorAll('.apply-steps li')).toHaveLength(3);
  });
});
