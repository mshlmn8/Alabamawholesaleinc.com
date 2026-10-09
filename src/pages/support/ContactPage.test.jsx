// The contact page prints the shared hours from content.js, in Central Time
// (AW-283, AW-275).
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HOURS, hoursRange } from '../../data/content.js';
import { ContactPage } from './ContactPage.jsx';

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
