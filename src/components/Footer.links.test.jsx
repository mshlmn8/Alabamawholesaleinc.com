// The footer's columns, blurb, year and licensed-only line (AW-285): the shop
// links in one column, the account and help links (with My account, Quick
// reorder and Help) in the other, every department named in the blurb, and
// one wording of the licensed-only statement in the footer and the trade-only
// strip above the header.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPANY, LICENSED_ONLY } from '../data/content.js';
import { PRODUCTS } from '../data/products.js';
import { APPLY_LABEL } from '../data/terms.js';
import { departmentsFor } from '../lib/departments.js';
import { Footer, footerBlurb } from './Footer.jsx';
import { HelpDialog } from './HelpDialog.jsx';
import { TradeBar } from './TradeBar.jsx';

const departments = departmentsFor(PRODUCTS);
const footer = (props) => <Footer departments={departments} onLoginClick={vi.fn()} onApplyClick={vi.fn()} onHelp={vi.fn()} {...props} />;
// The column under a heading: its links and buttons, in order.
const column = (name) => {
  const heading = screen.getByRole('heading', { name });
  return [...heading.parentElement.querySelectorAll('a, button')].map((el) => ({ text: el.textContent, href: el.getAttribute('href') }));
};

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
});

describe('footer links (AW-285)', () => {
  it('lists all products, every department, then new arrivals and bestsellers under Departments', () => {
    render(footer());
    expect(column('Departments')).toEqual([
      { text: 'All products', href: '/catalog' },
      ...departments.map((d) => ({ text: `${d.label} (${d.count})`, href: expect.stringMatching(/^\/category\/[a-z-]+$/) })),
      { text: 'New arrivals', href: '/#new-arrivals' },
      { text: 'Bestsellers', href: '/#bestsellers' },
    ]);
  });

  it('keeps the account and help links together, with My account, Quick reorder and Help, and no shop links', () => {
    render(footer());
    expect(column('Account & help')).toEqual([
      { text: APPLY_LABEL, href: null },
      { text: 'Application checklist', href: '/apply' },
      { text: 'Sign in', href: null },
      { text: 'My account', href: '/account' },
      { text: 'Quick reorder', href: '/account#quick-reorder' },
      { text: 'Help', href: null },
      { text: 'Contact & visit', href: '/contact' },
      { text: 'Delivery & service area', href: '/delivery' },
    ]);
  });

  it('calls each dialog opener from its button', () => {
    const props = { onLoginClick: vi.fn(), onApplyClick: vi.fn(), onHelp: vi.fn() };
    render(footer(props));
    const help = within(screen.getByRole('heading', { name: 'Account & help' }).parentElement);
    fireEvent.click(help.getByRole('button', { name: 'Help' }));
    fireEvent.click(help.getByRole('button', { name: 'Sign in' }));
    fireEvent.click(help.getByRole('button', { name: APPLY_LABEL }));
    expect(props.onHelp).toHaveBeenCalledTimes(1);
    expect(props.onLoginClick).toHaveBeenCalledTimes(1);
    expect(props.onApplyClick).toHaveBeenCalledTimes(1);
  });

  it('opens the Help dialog the way App wires it, and hands focus back to the button on close', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Footer departments={departments} onLoginClick={vi.fn()} onApplyClick={vi.fn()} onHelp={() => setOpen(true)} />
          {open && <HelpDialog onClose={() => setOpen(false)} onApply={() => setOpen(false)} />}
        </>
      );
    }
    render(<Harness />);
    const button = screen.getByRole('button', { name: 'Help' });
    button.focus();
    fireEvent.click(button);
    const dialog = screen.getByRole('dialog', { name: 'Talk to the warehouse' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('names the delivery policy link as the policy it is', () => {
    render(footer());
    // 'Policies', apart from the support pages' 'Help and policies' (AW-316).
    const policies = screen.getByRole('navigation', { name: 'Policies' });
    expect(within(policies).getByRole('link', { name: 'Delivery policy' }).getAttribute('href')).toBe('/shipping');
    expect(within(policies).queryByRole('link', { name: 'Delivery' })).toBeNull();
  });
});

describe('footer copy (AW-285)', () => {
  it('names every department in the blurb, from the catalog, without the consumer aside', () => {
    render(footer());
    const blurb = document.querySelector('.footer-brand p').textContent;
    expect(blurb).toBe('Wholesale distributor of tobacco, novelties & vapes, merchandise, candies, food stuff, grocery, motor oil, and drinks & bags. Serving licensed retail stores.');
    for (const d of departments) expect(blurb).toContain(d.label.toLowerCase());
    expect(blurb).not.toMatch(/consumer/i);
    // A department the live catalog adds is named too.
    expect(footerBlurb([...departments, { key: 'SEASONAL', label: 'SEASONAL' }])).toContain('drinks & bags, and seasonal.');
    expect(footerBlurb([])).toBe('Wholesale distributor. Serving licensed retail stores.');
  });

  it('prints the current year, read when the module loads', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2031-03-04T12:00:00Z'));
    vi.resetModules();
    const { Footer: Fresh } = await import('./Footer.jsx');
    render(<Fresh departments={departments} onLoginClick={vi.fn()} onApplyClick={vi.fn()} onHelp={vi.fn()} />);
    expect(screen.getByText(`© 2031 ${COMPANY.name}. All rights reserved.`)).toBeTruthy();
    expect(readFileSync(resolve(process.cwd(), 'src/components/Footer.jsx'), 'utf8')).not.toMatch(/©\s*20\d\d/);
  });

  // The trade-only strip is the trade bar's first message now (AW-153).
  it('says licensed-only in one wording, in the footer and the trade bar', () => {
    render(<><TradeBar onApplyClick={vi.fn()} /><Footer departments={departments} onLoginClick={vi.fn()} onApplyClick={vi.fn()} onHelp={vi.fn()} /></>);
    expect(LICENSED_ONLY).toBe('Wholesale to licensed retail businesses only · No consumer sales · 21+');
    expect(document.querySelector('.announcement-list li').textContent).toBe(LICENSED_ONLY.toUpperCase());
    expect([...document.querySelectorAll('.footer-legal p')].map((p) => p.textContent)).toContain(LICENSED_ONLY);
    // No other wording of the statement is left in the components.
    for (const file of ['src/components/Footer.jsx', 'src/components/TradeBar.jsx']) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source, file).not.toMatch(/No consumer orders|never consumers|NO CONSUMER SALES/);
    }
  });
});
