// The service-area check takes a ZIP code but has no route list to look it
// up in, so it only ever says to call (AW-123, Cursor PR #13).
import { fireEvent, render, screen, within } from '@testing-library/react';
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
    expect(result()).toBe(`Texas isn’t on our delivery routes.Delivery is currently on routes in Alabama, Mississippi and Georgia.You can pick up orders at will-call in Birmingham, or call ${COMPANY.phone} to ask about your area.Contact & visit`);
    // Nothing is guessed from the ZIP: no route, day or cutoff is named.
    expect(result()).not.toMatch(/Tuesday|Friday|cutoff is|\bis on our .* route/);
  });
});

// An out-of-area answer says so and gives the next steps: will-call, the
// phone and the contact page (AW-270). Tennessee is in the list, off the
// routes until the owner says otherwise.
describe('DeliveryPage out-of-area answer', () => {
  const box = () => document.querySelector('.eligibility-result');
  const options = (group) => [...state().querySelectorAll(`optgroup[label="${group}"] option`)].map((o) => [o.value, o.textContent]);

  it('lists Tennessee among the states off the routes, in order, and not on the routes', () => {
    render(<DeliveryPage />);
    expect(options('Delivery routes').map(([code]) => code)).toEqual(['AL', 'MS', 'GA']);
    const other = options('Other');
    expect(other).toContainEqual(['TN', 'Tennessee']);
    const names = other.filter(([code]) => code !== 'XX').map(([, name]) => name);
    expect(names).toEqual([...names].sort());
    expect(other[other.length - 1]).toEqual(['XX', 'Another state']);
  });

  it.each([['FL', 'Florida isn’t on our delivery routes.'], ['TN', 'Tennessee isn’t on our delivery routes.'], ['XX', 'Your state isn’t on our delivery routes.']])(
    'answers %s with the state, the route sentence, the phone and the contact page',
    (code, lead) => {
      render(<DeliveryPage />);
      fireEvent.change(state(), { target: { value: code } });
      expect(box().querySelector('b').textContent).toBe(lead);
      const spans = [...box().querySelectorAll(':scope > span')].map((s) => s.textContent);
      // The published route sentence, word for word.
      expect(spans[0]).toBe('Delivery is currently on routes in Alabama, Mississippi and Georgia.');
      expect(spans[1]).toBe(`You can pick up orders at will-call in Birmingham, or call ${COMPANY.phone} to ask about your area.`);
      expect(within(box()).getByRole('link', { name: COMPANY.phone }).getAttribute('href')).toBe(`tel:${COMPANY.phoneRaw}`);
      const contact = within(box()).getByRole('link', { name: 'Contact & visit' });
      expect(contact.getAttribute('href')).toBe('/contact');
      expect(contact.className).toBe('text-link');
      // The route states are listed with no serial comma.
      expect(box().textContent).not.toMatch(/Mississippi, and/);
    },
  );
});

// The minimum-order card says its fact once, in the heading (AW-276).
describe('DeliveryPage minimum-order card', () => {
  it('keeps the heading and drops the sentence that repeated it', () => {
    render(<DeliveryPage />);
    const card = [...document.querySelectorAll('.info-card')].find((c) => c.querySelector('.eyebrow').textContent === 'MINIMUM ORDER');
    expect(card.querySelector('h2').textContent).toBe('$500.00 minimum');
    expect(card.querySelector('p:not(.eyebrow)')).toBeNull();
    expect(screen.queryByText(/^The minimum order is/)).toBeNull();
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
