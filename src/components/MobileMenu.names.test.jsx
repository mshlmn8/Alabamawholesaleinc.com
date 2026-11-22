// The phone menu's department links say what their count is (AW-316): "68
// products", not a bare "68". The count and the hidden unit are each in their
// own element (translate-safe).
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../data/products.js';
import { departmentsFor } from '../lib/departments.js';
import { productCount } from '../lib/format.js';
import { MobileMenu } from './MobileMenu.jsx';

const noop = () => {};
const departments = departmentsFor(PRODUCTS);
const go = { logout: noop, signin: noop, signup: noop, help: noop };

describe('MobileMenu department counts', () => {
  it('reads each count with its unit', () => {
    render(<MobileMenu onClose={noop} onFollowLink={noop} departments={departments} products={PRODUCTS} user={null} isAdmin={false} go={go} />);
    const nav = screen.getByRole('navigation', { name: 'Departments' });
    for (const d of departments) {
      // jsdom joins the spans without the spaces a browser puts between them.
      const link = within(nav).getByRole('link', { name: new RegExp(`^${d.label.replace(/[&()]/g, '\\$&')}\\s*${d.count}\\s*products$`) });
      const count = link.querySelector('.menu-count');
      expect(count.children).toHaveLength(2);
      expect(count.children[0].textContent).toBe(String(d.count));
      expect(count.children[1].className).toBe('sr-only');
      expect(count.children[1].textContent).toBe(' products');
      const mark = link.querySelector('.menu-index');
      expect(mark.textContent).toBe('');
      expect(mark.querySelector('svg.icon')).toBeTruthy();
      expect(mark.querySelector('svg.icon path').getAttribute('d')).toBeTruthy();
    }
    expect([...nav.querySelectorAll('.menu-index svg.icon')].map((svg) => svg.querySelector('path') && true)).toHaveLength(departments.length);
    expect(nav.textContent).not.toMatch(/\b0\d\b/);
  });

  it('shows no catalog count at its foot, only the address', () => {
    render(<MobileMenu onClose={noop} onFollowLink={noop} departments={departments} products={PRODUCTS} user={null} isAdmin={false} go={go} />);
    expect(document.querySelector('.menu-contact p').textContent).not.toMatch(/\d+ (departments|products)|SKU/);
    for (const count of document.querySelectorAll('.menu-count')) expect(count.classList.contains('sr-only')).toBe(true);
    expect([productCount(1), productCount(2), productCount(2, '02')]).toEqual(['1 product', '2 products', '02 products']);
  });
});
