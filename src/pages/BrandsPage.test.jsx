import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../data/products.js';
import { catalogBrands, homeBrands } from '../lib/brands.js';
import { BrandPage } from './BrandPage.jsx';
import { BrandsPage } from './BrandsPage.jsx';
import { HomePage } from './HomePage.jsx';
import { departmentsFor } from '../lib/departments.js';

describe('BrandsPage', () => {
  it('lists every brand, and each one opens that brand', () => {
    render(<BrandsPage products={PRODUCTS} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Brands');
    const brands = catalogBrands(PRODUCTS);
    expect(screen.getAllByRole('link', { name: 'Swisher Sweets' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Swisher Sweets' }).getAttribute('href')).toBe('/brands/swisher-sweets');
    expect(screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/brands/'))).toHaveLength(brands.length);
    expect(screen.queryByRole('link', { name: 'Shroom Puff' })).toBeNull();
  });
});

describe('BrandPage', () => {
  it('lists that brand’s products and leads back to every brand', () => {
    render(<BrandPage slug="swisher-sweets" products={PRODUCTS} profile={null} account="signed-out" isApprovedBuyer={false} cart={{}} addLine={() => {}} decLine={() => {}} onLoginClick={() => {}} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Swisher Sweets');
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'Brands' }).getAttribute('href')).toBe('/brands');
    expect(screen.getByRole('link', { name: 'Swisher Sweets cigarillos' }).getAttribute('href')).toBe('/product/1');
  });
});

describe('home brands', () => {
  it('shows a few brands and Show all opens the brands page', () => {
    render(<HomePage products={PRODUCTS} departments={departmentsFor(PRODUCTS)} profile={null} account="signed-out" isApprovedBuyer={false} cart={{}} addLine={() => {}} decLine={() => {}} onLoginClick={() => {}} onApplyClick={() => {}} />);
    const section = document.getElementById('brands');
    const links = [...section.querySelectorAll('.brand-tile')].map((a) => a.textContent);
    expect(links).toEqual(homeBrands(PRODUCTS).map((b) => b.label));
    const showAll = section.querySelector('.section-head a');
    expect(showAll.textContent.replace(/\s+/g, ' ').trim()).toBe('Show all brands');
    expect(showAll.getAttribute('href')).toBe('/brands');
  });
});
