// The contact page prints the shared hours from content.js, in Central Time
// (AW-283, AW-275).
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPANY, HOURS, hoursRange } from '../../data/content.js';
import { dismissToast, getToast } from '../../lib/toast.js';
import { COPIED_MS, ContactPage, EMAIL_COPIED, EMAIL_COPY_FAILED } from './ContactPage.jsx';

describe('ContactPage hours', () => {
  it('lists one row per HOURS entry, with the spelled-out days and an unbreakable range', () => {
    render(<ContactPage onApplyClick={() => {}} />);
    const rows = [...document.querySelectorAll('.hours-list > div')]
      .map(row => [row.querySelector('dt').textContent, row.querySelector('dd').textContent]);
    expect(rows).toEqual(HOURS.map(row => [row.long, hoursRange(row)]));
    expect(rows.map(([days]) => days)).toEqual(['Monday – Friday', 'Saturday – Sunday']);
    expect(rows[0][1].replace(/\u00A0/g, ' ').replace(/\u2060/g, '')).toBe('7:00 AM – 6:00 PM');
    expect(rows[1][1]).not.toMatch(/[ \t\n]/);
  });

  it('says the times are Central Time and keeps the holiday note', () => {
    render(<ContactPage onApplyClick={() => {}} />);
    expect(screen.getByText('All times are Central Time (CT).')).toBeTruthy();
    expect(screen.getByText(/^Holiday hours can differ/)).toBeTruthy();
  });

  describe('open now', () => {
    afterEach(() => vi.useRealTimers());
    const status = () => document.querySelector('#hours-title').parentElement.querySelectorAll('.support-note')[1].textContent
      .replace(/\u00A0/g, ' ');

    it('fills in after mount, next to the holiday note, and stays current', () => {
      vi.useFakeTimers();
      // Wednesday 7 October 2026, 5:59:30 PM CDT.
      vi.setSystemTime(new Date('2026-10-07T22:59:30Z'));
      render(<ContactPage onApplyClick={() => {}} />);
      // Rendered without reading the clock: the line holds its space.
      expect(status()).toBe(' ');
      act(() => { vi.advanceTimersByTime(0); });
      expect(status()).toBe('Open now · closes 6:00 PM CT');
      expect(document.querySelector('#hours-title').parentElement.querySelectorAll('.support-note')[2].textContent).toMatch(/^Holiday hours can differ/);
      act(() => { vi.advanceTimersByTime(60 * 1000); });
      expect(status()).toBe('Closed · opens tomorrow 7:00 AM CT');
    });
  });
});

// The Call, Email and Visit cards are headings in the page outline (AW-278),
// and the email wraps after its '@' rather than mid-word (AW-120).
describe('ContactPage cards', () => {
  it('heads each card with an h2 eyebrow, between the page title and the hours', () => {
    render(<ContactPage onApplyClick={() => {}} />);
    const cards = [...document.querySelectorAll('.info-card')];
    expect(cards.map((card) => card.firstElementChild.tagName + ' ' + card.firstElementChild.className)).toEqual(['H2 eyebrow', 'H2 eyebrow', 'H2 eyebrow']);
    const outline = screen.getAllByRole('heading').map((h) => `${h.tagName} ${h.textContent}`);
    expect(outline).toEqual(['H1 Contact & visit', 'H2 Call', 'H2 Email', 'H2 Visit', 'H2 When we’re open', 'H2 Pick up at the warehouse', 'H2 Open a trade account']);
  });

  it('offers a line break only after the @ in the email, and keeps the address whole', () => {
    render(<ContactPage onApplyClick={() => {}} />);
    const link = document.querySelector('a.info-lead-small');
    expect(link.getAttribute('href')).toBe(`mailto:${COMPANY.email}`);
    expect(link.textContent).toBe(COMPANY.email);
    // One child, so the 44px touch rule's flex box keeps the break inside it.
    expect(link.children).toHaveLength(1);
    const [local, wbr, domain] = link.firstElementChild.childNodes;
    expect([local.nodeName, wbr.nodeName, domain.nodeName]).toEqual(['SPAN', 'WBR', 'SPAN']);
    expect(local.textContent).toBe(COMPANY.email.slice(0, COMPANY.email.indexOf('@') + 1));
    expect(domain.textContent).toBe(COMPANY.email.slice(COMPANY.email.indexOf('@') + 1));
    expect(screen.getByRole('link', { name: COMPANY.email })).toBe(link);
  });
});

// 'Apply for a trade account' opens the form, as on /apply, and is the primary
// action; the checklist is the secondary one (AW-271).
describe('ContactPage account call to action', () => {
  it('makes the apply button the primary button, calling onApplyClick', () => {
    const onApplyClick = vi.fn();
    render(<ContactPage onApplyClick={onApplyClick} />);
    const cta = document.querySelector('.support-cta .contact-strip-actions');
    const [first, second] = cta.children;
    expect(first).toBe(within(cta).getByRole('button', { name: 'Apply for a trade account' }));
    expect(first.className).toBe('button');
    fireEvent.click(first);
    expect(onApplyClick).toHaveBeenCalledTimes(1);
    expect(second).toBe(within(cta).getByRole('link', { name: 'Application checklist' }));
    expect(second.className).toBe('button ghost');
    expect(second.getAttribute('href')).toBe('/apply');
  });
});

// Webmail users can copy the address instead of following mailto: (AW-280).
describe('ContactPage copy email address', () => {
  const card = () => screen.getByRole('heading', { name: 'Email' }).closest('.info-card');
  const withClipboard = (writeText) => Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  afterEach(() => {
    delete navigator.clipboard;
    dismissToast();
    vi.useRealTimers();
  });

  it('copies COMPANY.email, toasts once, and says Copied for a moment', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(() => Promise.resolve());
    withClipboard(writeText);
    render(<ContactPage onApplyClick={() => {}} />);
    const button = within(card()).getByRole('button', { name: 'Copy email address' });
    expect(button.className).toBe('text-link info-copy');
    // Right under the address it copies.
    expect(button.previousElementSibling).toBe(card().querySelector('a.info-lead'));
    await act(async () => { fireEvent.click(button); });
    expect(writeText).toHaveBeenCalledWith(COMPANY.email);
    expect(getToast()).toMatchObject({ text: EMAIL_COPIED, action: null });
    expect(EMAIL_COPIED).toBe('Email address copied.');
    // The label is its own span inside the same button.
    expect(button.isConnected).toBe(true);
    expect(button.children).toHaveLength(1);
    expect(button.firstElementChild.textContent).toBe('Copied');
    // No second live region next to the shared one.
    expect(card().querySelector('[aria-live]')).toBeNull();
    act(() => { vi.advanceTimersByTime(COPIED_MS); });
    expect(button.textContent).toBe('Copy email address');
  });

  it('says how to copy by hand when the clipboard refuses', async () => {
    withClipboard(vi.fn(() => Promise.reject(new Error('NotAllowedError'))));
    render(<ContactPage onApplyClick={() => {}} />);
    const button = within(card()).getByRole('button', { name: 'Copy email address' });
    await act(async () => { fireEvent.click(button); });
    expect(getToast()).toMatchObject({ text: EMAIL_COPY_FAILED });
    expect(EMAIL_COPY_FAILED).toBe('Couldn’t copy. Select the address and copy it.');
    expect(button.textContent).toBe('Copy email address');
  });

  it('leaves the button out where the browser has no clipboard API', () => {
    expect('clipboard' in navigator).toBe(false);
    render(<ContactPage onApplyClick={() => {}} />);
    expect(within(card()).queryByRole('button')).toBeNull();
    expect(document.querySelector('.info-copy')).toBeNull();
  });
});
