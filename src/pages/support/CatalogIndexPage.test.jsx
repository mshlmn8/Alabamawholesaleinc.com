// The catalog index counts a product's variants by their axis, only when
// there is a choice (AW-233, AW-332, AW-128).
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { departmentsFor } from '../../lib/departments.js';
import { CatalogIndexPage } from './CatalogIndexPage.jsx';

const products = [
  { id: 1, name: 'Swisher Sweets cigarillos', brand: 'Swisher', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-SS', variants: ['Red', 'Grape'], variantAxis: 'Flavor' },
  { id: 2, name: 'Gas cans', brand: 'Assorted', cat: 'MOTOR OIL', sub: 'Auto', sku: 'AW-GAS', variants: ['1 gal', '2gal', '5 gal'], variantAxis: 'Size' },
  { id: 3, name: 'Gatorade', brand: 'Gatorade', cat: 'DRINKS & BAGS', sub: 'Sports', sku: 'AW-GATORADE', variants: ['Blue'] },
  { id: 4, name: 'Kite', brand: 'Kite', cat: 'TOBACCO', sub: 'Cigarettes', sku: 'AW-KITE', variants: [] },
];
const row = (name) => screen.getByText(name).closest('a').querySelector('small').textContent;

describe('CatalogIndexPage', () => {
  it('counts variants by their axis, and not a single one', () => {
    render(<CatalogIndexPage products={products} departments={departmentsFor(products)} profile={null} isApprovedBuyer={false} onLoginClick={() => {}} />);
    expect(row('Swisher Sweets cigarillos')).toBe('Swisher · Cigars · AW-SS · 2 flavors');
    expect(row('Gas cans')).toBe('Assorted · Auto · AW-GAS · 3 sizes');
    expect(row('Gatorade')).toBe('Gatorade · Sports · AW-GATORADE');
    expect(row('Kite')).toBe('Kite · Cigarettes · AW-KITE');
    expect(screen.queryByText(/1 variants/)).toBeNull();
  });
});
