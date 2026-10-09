// The phone menu's department links say what their count is (AW-316): "68
// products", not a bare "68". The count and the hidden unit are each in their
// own element (translate-safe).
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../data/products.js';
import { departmentsFor } from '../lib/departments.js';
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
    }
  });
});
