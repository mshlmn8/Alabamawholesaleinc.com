// One apply label and one basket name per account state (AW-131, AW-132).
import { describe, expect, it } from 'vitest';
import {
  APPLY_INSTEAD, APPLY_LABEL, CART_DEVICE_NOTE, SIGN_IN_INSTEAD, SIGN_IN_LABEL, basketBadge, basketButtonLabel, basketTerms, cartDeviceNote,
} from './terms.js';

const KEYS = ['kind', 'noun', 'label', 'title', 'empty', 'items', 'add', 'view', 'cta', 'page', 'submit'];

describe('apply and sign-in labels (AW-131)', () => {
  it('is one sentence-case label each, and the cross links build on them', () => {
    expect(APPLY_LABEL).toBe('Apply for a trade account');
    expect(SIGN_IN_LABEL).toBe('Sign in');
    expect(SIGN_IN_INSTEAD).toBe('Already have an account? Sign in');
    expect(APPLY_INSTEAD).toBe('New here? Apply for a trade account');
    expect(SIGN_IN_INSTEAD.endsWith(SIGN_IN_LABEL)).toBe(true);
    expect(APPLY_INSTEAD.endsWith(APPLY_LABEL)).toBe(true);
  });
});

describe('basketTerms (AW-132)', () => {
  it('calls the basket a quote for everyone but an approved buyer', () => {
    expect(basketTerms(false)).toEqual({
      kind: 'quote', noun: 'quote', label: 'Quote', title: 'Your quote', empty: 'Your quote is empty', items: 'Items in your quote',
      add: 'Add to quote', view: 'View quote', cta: 'Review quote', page: 'Request a quote', submit: 'Submit quote request',
    });
    expect(basketTerms(undefined)).toBe(basketTerms(false));
  });

  it('calls it an order for an approved buyer', () => {
    expect(basketTerms(true)).toEqual({
      kind: 'order', noun: 'order', label: 'Order', title: 'Your order', empty: 'Your order is empty', items: 'Items in your order',
      add: 'Add to order', view: 'View order', cta: 'Review order', page: 'Place your order', submit: 'Submit order',
    });
  });

  it('gives both the same keys, frozen, and never mixes the two words', () => {
    for (const asOrder of [false, true]) {
      const terms = basketTerms(asOrder);
      expect(Object.keys(terms)).toEqual(KEYS);
      expect(Object.isFrozen(terms)).toBe(true);
      const other = asOrder ? 'quote' : 'order';
      for (const key of KEYS) expect(terms[key].toLowerCase(), key).not.toContain(other);
      expect(Object.values(terms).join(' ').toLowerCase()).not.toMatch(/\b(cart|checkout)\b/);
    }
  });

  it('names the header button with the count, one item or many (AW-240)', () => {
    expect(basketButtonLabel(basketTerms(false), 0)).toBe('Quote, 0 items');
    expect(basketButtonLabel(basketTerms(false), 1)).toBe('Quote, 1 item');
    expect(basketButtonLabel(basketTerms(true), 2)).toBe('Order, 2 items');
    expect(basketButtonLabel(basketTerms(true), 1500)).toBe('Order, 1,500 items');
    expect([1, 9, 10, 99, 100, 1500].map(basketBadge)).toEqual(['1', '9', '10', '99', '99+', '99+']);
  });

  it('writes every label in sentence case', () => {
    for (const asOrder of [false, true]) {
      for (const value of Object.values(basketTerms(asOrder))) {
        const [first, ...rest] = value.split(' ');
        expect(rest.join(' ')).toBe(rest.join(' ').toLowerCase());
        expect(first).toMatch(/^([A-Z][a-z]+|[a-z]+)$/);
      }
    }
  });
});

describe('cartDeviceNote (AW-334)', () => {
  it('says where the cart is kept: this browser for a guest, this device for an account until it is saved with it', () => {
    expect(cartDeviceNote(false)).toBe(CART_DEVICE_NOTE.guest);
    expect(cartDeviceNote(false, true)).toBe(CART_DEVICE_NOTE.guest);
    expect(cartDeviceNote(true)).toBe(CART_DEVICE_NOTE.account);
    expect(cartDeviceNote(true, true)).toBe('Saved with your account. It shows up when you sign in on another phone or computer.');
  });
});
