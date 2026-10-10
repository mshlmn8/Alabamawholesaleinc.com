// One apply label, and one basket name for everyone (AW-131, AW-132, AW-024).
import { describe, expect, it } from 'vitest';
import {
  APPLY_INSTEAD, APPLY_LABEL, BASKET, CART_DEVICE_NOTE, SIGN_IN_INSTEAD, SIGN_IN_LABEL, basketBadge, basketButtonLabel, cartDeviceNote,
} from './terms.js';

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

describe('BASKET (AW-132, AW-024)', () => {
  it('calls the basket an order for everyone: customers place orders, not quotes', () => {
    expect(BASKET).toEqual({
      noun: 'order', label: 'Order', title: 'Your order', empty: 'Your order is empty', items: 'Items in your order',
      add: 'Add to order', view: 'View order', cta: 'Checkout', page: 'Checkout', submit: 'Place order', received: 'Order received',
    });
    expect(Object.isFrozen(BASKET)).toBe(true);
    expect(Object.values(BASKET).join(' ').toLowerCase()).not.toMatch(/quote/);
  });

  it('names the header button with the count, one item or many (AW-240)', () => {
    expect(basketButtonLabel(0)).toBe('Order, 0 items');
    expect(basketButtonLabel(1)).toBe('Order, 1 item');
    expect(basketButtonLabel(2)).toBe('Order, 2 items');
    expect(basketButtonLabel(1500)).toBe('Order, 1,500 items');
    expect([1, 9, 10, 99, 100, 1500].map(basketBadge)).toEqual(['1', '9', '10', '99', '99+', '99+']);
  });

  it('writes every label in sentence case', () => {
    for (const value of Object.values(BASKET)) {
      const [first, ...rest] = value.split(' ');
      expect(rest.join(' ')).toBe(rest.join(' ').toLowerCase());
      expect(first).toMatch(/^([A-Z][a-z]+|[a-z]+)$/);
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
