// The home page's application panel (AW-281, AW-131): a heading that says
// what a store opens, the one apply label, and steps that match the rest of
// the site (a few minutes, no emailed price list).
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PRODUCTS } from '../data/products.js';
import { departmentsFor } from '../lib/departments.js';
import { HomePage } from './HomePage.jsx';

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

describe('HomePage application panel (AW-281)', () => {
  it('asks stores to open a trade account with the one apply label', () => {
    const onApplyClick = vi.fn();
    render(
      <HomePage products={PRODUCTS} departments={departmentsFor(PRODUCTS)} profile={null} isApprovedBuyer={false} cart={{}}
                addLine={vi.fn()} decLine={vi.fn()} onLoginClick={vi.fn()} onApplyClick={onApplyClick} />,
    );
    const panel = within(document.getElementById('apply'));
    expect(panel.getByRole('heading', { level: 2 }).textContent).toBe('Open a trade account');
    panel.getByRole('button', { name: 'Apply for a trade account' }).click();
    expect(onApplyClick).toHaveBeenCalledTimes(1);
    const steps = [...document.querySelectorAll('.apply-steps li p')].map(text);
    expect(steps[0]).toMatch(/ Takes a few minutes\.$/);
    expect(steps.join(' ')).not.toMatch(/price list|five minutes|email/i);
    expect(screen.queryByText(/Become a retail account|Start application/)).toBeNull();
  });
});
