// The catalog index counts a product's variants by their axis, only when
// there is a choice (AW-233, AW-332, AW-128).
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
    // The placeholder brand isn't printed (AW-286).
    expect(row('Gas cans')).toBe('Auto · AW-GAS · 3 sizes');
    expect(row('Gatorade')).toBe('Gatorade · Sports · AW-GATORADE');
    expect(row('Kite')).toBe('Kite · Cigarettes · AW-KITE');
    expect(screen.queryByText(/1 variants/)).toBeNull();
  });

  it('says why there are no prices: guest, under review or on hold (AW-101)', () => {
    const intro = () => document.querySelector('.page-head h1 + p').textContent;
    const props = { products, departments: departmentsFor(products), isApprovedBuyer: false, onLoginClick: () => {} };
    const view = render(<CatalogIndexPage {...props} profile={null} />);
    expect(intro()).toMatch(/ Sign in to see wholesale pricing\.$/);
    view.rerender(<CatalogIndexPage {...props} profile={{ id: 'p', status: 'pending' }} />);
    expect(intro()).toMatch(/ Pricing unlocks after your account is approved\.$/);
    view.rerender(<CatalogIndexPage {...props} profile={{ id: 's', status: 'suspended' }} />);
    expect(intro()).toMatch(/ Ordering is paused on this account — call the trade desk\.$/);
  });
});

// A guest's pricing prompt sits at the top, right under the page head, with
// both ways in (AW-274). It follows the session, so a signed-in buyer whose
// profile is still loading never sees it.
describe('CatalogIndexPage pricing prompt', () => {
  const page = (props) => render(<CatalogIndexPage products={products} departments={departmentsFor(products)} profile={null} isApprovedBuyer={false}
    onLoginClick={() => {}} onApplyClick={() => {}} {...props} />);

  it('shows a guest the banner directly after the page head, before the department links', () => {
    page({ signedIn: false });
    const banner = document.querySelector('.catalog-pricing');
    expect(banner.className).toBe('callout catalog-pricing');
    expect(banner.previousElementSibling.classList.contains('page-head')).toBe(true);
    expect(banner.nextElementSibling.matches('nav.dept-jump')).toBe(true);
    expect(banner.querySelector('p').textContent).toBe('Wholesale pricing is locked. Sign in to see your account pricing on every product, or apply for a trade account.');
    // The old prompt at the bottom of the page is gone.
    expect(document.querySelectorAll('.filter-signin, .catalog-signin')).toHaveLength(0);
    expect(screen.getAllByText(/Wholesale pricing is locked/)).toHaveLength(1);
  });

  it('calls the sign-in and apply handlers from its two buttons', () => {
    const onLoginClick = vi.fn();
    const onApplyClick = vi.fn();
    page({ signedIn: false, onLoginClick, onApplyClick });
    const banner = document.querySelector('.catalog-pricing');
    const signIn = within(banner).getByRole('button', { name: 'Sign in' });
    const apply = within(banner).getByRole('button', { name: 'Apply for an account' });
    expect(signIn.className).toBe('button sm');
    expect(apply.className).toBe('button ghost sm');
    fireEvent.click(signIn);
    expect(onLoginClick).toHaveBeenCalledTimes(1);
    expect(onApplyClick).not.toHaveBeenCalled();
    fireEvent.click(apply);
    expect(onApplyClick).toHaveBeenCalledTimes(1);
  });

  it('hides it once signed in, also while the profile is still loading', () => {
    page({ signedIn: true, profile: null });
    expect(document.querySelector('.catalog-pricing')).toBeNull();
    expect(screen.queryByText(/Wholesale pricing is locked/)).toBeNull();
  });
});
