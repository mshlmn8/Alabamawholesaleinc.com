// The service-area check takes a ZIP code but has no route list to look it
// up in, so it only ever says to call (AW-123, Cursor PR #13).
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { COMPANY } from '../../data/content.js';
import { DeliveryPage } from './DeliveryPage.jsx';

const result = () => document.querySelector('.eligibility-result').textContent;
const zip = () => screen.getByLabelText('Store ZIP code');
const state = () => screen.getByLabelText('State your store is in');

describe('DeliveryPage service-area check', () => {
  it('keeps only digits, five at most, and answers a full ZIP with "call to confirm"', () => {
    render(<DeliveryPage />);
    expect(zip().getAttribute('inputmode')).toBe('numeric');
    expect(zip().getAttribute('autocomplete')).toBe('postal-code');
    fireEvent.change(zip(), { target: { value: '35-2' } });
    expect(zip().value).toBe('352');
    expect(result()).toBe('');
    fireEvent.change(zip(), { target: { value: '352039999' } });
    expect(zip().value).toBe('35203');
    expect(result()).toBe(`Call ${COMPANY.phone} to confirm whether 35203 is on a route. Route days and the order cutoff are confirmed by the trade desk.`);
  });

  it('names the ZIP in the route-state answer, and points other states to will-call', () => {
    render(<DeliveryPage />);
    fireEvent.change(state(), { target: { value: 'AL' } });
    expect(result()).toMatch(/^We run delivery routes in Alabama\.Routes don’t reach every address\. Call .* to confirm your stop and delivery day/);
    fireEvent.change(zip(), { target: { value: '35203' } });
    expect(result()).toMatch(/to confirm whether 35203 is on a route and delivery day/);
    fireEvent.change(state(), { target: { value: 'TX' } });
    expect(result()).toBe(`Delivery is currently on routes in Alabama, Mississippi and Georgia.Call ${COMPANY.phone} about will-call pickup in Birmingham.`);
    // Nothing is guessed from the ZIP: no route, day or cutoff is named.
    expect(result()).not.toMatch(/Tuesday|Friday|cutoff is|on our .* route/);
  });
});

// The three info cards are not ordered steps, so their eyebrows carry no
// '01 ·' numbers (AW-296); the route steps below them are the numbered list.
describe('DeliveryPage info cards', () => {
  it('labels the info cards without numbers', () => {
    render(<DeliveryPage />);
    const eyebrows = [...document.querySelectorAll('.info-card .eyebrow')].map((p) => p.textContent);
    expect(eyebrows).toEqual(['ROUTE DELIVERY', 'WILL-CALL', 'MINIMUM ORDER']);
    expect(document.querySelector('ol.next-steps').children.length).toBeGreaterThan(1);
  });
});
