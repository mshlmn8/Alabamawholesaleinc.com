// Products without a photo stay off the home rails (AW-029, Cursor PR #13).
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRODUCTS, NEW_ARRIVALS_IDS } from '../data/products.js';
import { HomePage, hasPhoto } from './HomePage.jsx';

afterEach(() => vi.unstubAllGlobals());

describe('HomePage rails', () => {
  it('tells a product with a photo from one without', () => {
    expect(hasPhoto({ picture: { src: '/a.jpg' } })).toBe(true);
    expect(hasPhoto({ img: '/a.jpg', picture: null })).toBe(true);
    expect(hasPhoto({ img: null, picture: null })).toBe(false);
    expect(hasPhoto(undefined)).toBe(false);
  });

  it('leaves photo-less products such as Dubai chocolate (#342) off New arrivals and Bestsellers', () => {
    // #342 is listed as a new arrival but has no photo yet.
    expect(NEW_ARRIVALS_IDS).toContain(342);
    expect(PRODUCTS.find((p) => p.id === 342).picture).toBeNull();
    // jsdom has no matchMedia; the hero carousel asks for reduced motion.
    vi.stubGlobal('matchMedia', vi.fn((media) => ({ media, matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })));
    render(<HomePage products={PRODUCTS} departments={[]} profile={null} isApprovedBuyer={false} cart={{}}
                     addLine={() => {}} decLine={() => {}} onLoginClick={() => {}} onApplyClick={() => {}} />);
    const names = (id) => [...document.querySelectorAll(`#${id} .content-card h3`)].map((h) => h.textContent);
    expect(names('new-arrivals')).not.toContain('Dubai chocolate');
    expect(names('new-arrivals').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('#new-arrivals .photo-soon, #bestsellers .photo-soon')).toHaveLength(0);
  });
});
