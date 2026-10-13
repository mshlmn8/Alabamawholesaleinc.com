// Staff's site settings on the storefront (AW-030): the trade bar's messages
// and phone, the footer's address, phone, email and hours, the contact
// page's (without "Open now" for free-text hours), Help, the error copy and
// the order email's will-call address all follow Admin -> Site settings;
// without a row they are content.js's. The store is fed with
// showSiteSettings(), as Admin's save does; nothing on the network.
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { COMPANY } from '../data/content.js';
import { PRODUCTS } from '../data/products.js';
import { departmentsFor } from '../lib/departments.js';
import { resetSiteSettingsForTests, showSiteSettings } from '../lib/siteSettings.js';
import { unavailableMessage } from '../lib/errors.js';
import { orderNotificationFields } from '../lib/orderNotification.js';
import { TRADE_NOTICE, TradeBar } from './TradeBar.jsx';
import { Footer } from './Footer.jsx';
import { HelpDialog } from './HelpDialog.jsx';
import { ContactPage } from '../pages/support/ContactPage.jsx';

const ROW = {
  announcements: ['Closed Monday for the holiday', 'New candy in stock'],
  phone: '(205) 555-0129',
  email: 'desk@example.test',
  hours: [{ days: 'Mon–Sat', time: '6 AM – 7 PM CT' }, { days: 'Sun', time: 'Closed' }],
  street: '100 Test Street', city: 'Hoover', state: 'AL', zip: '35244',
};
const plain = (text) => text.replace(/[\u00A0]/g, ' ').replace(/\u2060/g, '');
const noop = () => {};

beforeEach(() => resetSiteSettingsForTests({ client: null }));
afterEach(() => resetSiteSettingsForTests({ client: null }));

describe('the trade bar', () => {
  it('shows staff’s messages after the trade notice, and staff’s phone', () => {
    render(<TradeBar />);
    act(() => showSiteSettings(ROW));
    expect([...document.querySelectorAll('.announcement-list li')].map((li) => li.textContent))
      .toEqual([TRADE_NOTICE, 'Closed Monday for the holiday', 'New candy in stock']);
    const call = screen.getByRole('link', { name: 'Call (205) 555-0129' });
    expect(call.getAttribute('href')).toBe('tel:+12055550129');
  });

  it('names the new phone in its own volume-pricing message', () => {
    render(<TradeBar />);
    act(() => showSiteSettings({ phone: '(205) 555-0129' }));
    expect(document.querySelector('.announcement-list li:last-child').textContent).toBe('For volume pricing, email us or call (205) 555-0129.');
  });
});

describe('the footer', () => {
  it('prints staff’s address, phone, email and hours', () => {
    render(<Footer departments={departmentsFor(PRODUCTS)} onLoginClick={noop} onApplyClick={noop} />);
    const contact = document.querySelector('.footer-contact');
    expect(contact.textContent).toContain(COMPANY.addressLine1);
    act(() => showSiteSettings(ROW));
    expect(contact.textContent).not.toContain(COMPANY.addressLine1);
    expect(contact.textContent).toContain('100 Test Street');
    expect(contact.textContent).toContain('Hoover, AL 35244');
    expect(within(contact).getByRole('link', { name: '(205) 555-0129' }).getAttribute('href')).toBe('tel:+12055550129');
    expect(within(contact).getByRole('link', { name: 'desk@example.test' }).getAttribute('href')).toBe('mailto:desk@example.test');
    expect([...contact.querySelectorAll('.footer-hours')].map((el) => plain(el.textContent))).toEqual(['Mon–Sat 6 AM – 7 PM CT', 'Sun Closed']);
  });
});

describe('Help', () => {
  it('gives staff’s phone, email, hours and will-call address', () => {
    render(<HelpDialog onClose={noop} onApply={noop} />);
    act(() => showSiteSettings(ROW));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('link', { name: '(205) 555-0129' })).toBeTruthy();
    expect([...dialog.querySelectorAll('.hours-line')].map((el) => plain(el.textContent))).toEqual(['Mon–Sat 6 AM – 7 PM CT', 'Sun Closed']);
    expect(dialog.textContent).toContain('100 Test Street, Hoover, AL 35244');
  });
});

describe('Contact & visit', () => {
  it('shows "Open now" for the site’s own hours only', () => {
    render(<ContactPage onApplyClick={noop} />);
    expect(screen.getByText(/All times are Central Time/)).toBeTruthy();
    act(() => showSiteSettings(ROW));
    const hours = document.querySelector('.hours-list');
    expect([...hours.querySelectorAll('div')].map((row) => [row.querySelector('dt').textContent, plain(row.querySelector('dd').textContent)]))
      .toEqual([['Mon–Sat', '6 AM – 7 PM CT'], ['Sun', 'Closed']]);
    expect(screen.queryByText(/All times are Central Time/)).toBeNull();
    expect(screen.getAllByRole('link', { name: '(205) 555-0129' }).length).toBeGreaterThan(0);
    const directions = screen.getByRole('link', { name: /Get directions/ });
    expect(directions.getAttribute('href')).toContain(encodeURIComponent('100 Test Street, Hoover, AL 35244'));
  });
});

describe('code outside React', () => {
  it('names staff’s phone and email in error copy, and staff’s address in the order email', () => {
    expect(unavailableMessage('Checkout')).toContain(COMPANY.phone);
    act(() => showSiteSettings(ROW));
    expect(unavailableMessage('Checkout')).toBe('Checkout is unavailable right now. Call (205) 555-0129 or email desk@example.test and a trade rep will help you.');
    const fields = orderNotificationFields({ ref: 'ALW-O-TEST000001', data: { delivery: 'willcall', business: 'Test Market' }, lines: [] });
    expect(Object.values(fields).join('\n')).toContain('Will-call pickup at 100 Test Street, Hoover, AL 35244');
  });
});
