// Products without a photo stay off the home rails (AW-029, Cursor PR #13);
// the page has one h1, in the split hero (AW-004).
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRODUCTS, NEW_ARRIVALS_IDS } from '../data/products.js';
import { HomePage, hasPhoto } from './HomePage.jsx';

afterEach(() => vi.restoreAllMocks());

const renderHome = (props = {}) => render(
  <HomePage products={PRODUCTS} departments={[]} profile={null} isApprovedBuyer={false} cart={{}}
            addLine={() => {}} decLine={() => {}} onLoginClick={() => {}} onApplyClick={() => {}} {...props} />,
);

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
    renderHome();
    const names = (id) => [...document.querySelectorAll(`#${id} .content-card h3`)].map((h) => h.textContent);
    expect(names('new-arrivals')).not.toContain('Dubai chocolate');
    expect(names('new-arrivals').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('#new-arrivals .photo-soon, #bestsellers .photo-soon')).toHaveLength(0);
  });

  it('opens with the split hero, holding the page\'s only h1', () => {
    renderHome();
    expect(document.querySelectorAll('h1')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).closest('.home-hero')).not.toBeNull();
    // Nothing in the page comes before the hero.
    expect(document.querySelector('.home-hero').previousElementSibling).toBeNull();
  });

  it('passes the signed-in state to the hero calls to action', () => {
    const { unmount } = renderHome();
    expect(screen.getByRole('button', { name: 'Apply for a trade account' })).toBeTruthy();
    unmount();
    renderHome({ signedIn: true });
    expect(screen.queryByRole('button', { name: 'Apply for a trade account' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Go to my account' }).getAttribute('href')).toBe('/account');
  });
});
