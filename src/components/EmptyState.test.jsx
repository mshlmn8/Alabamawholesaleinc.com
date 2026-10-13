// The shared empty state (AW-299): a heading at the level the page needs, a
// line of text and the actions, in that order.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './EmptyState.jsx';

describe('EmptyState', () => {
  it('renders the heading, the text and the actions in order, with an h2 by default', () => {
    render(
      <EmptyState title="No products match" actions={<button type="button">Clear filters</button>}>
        Try another search.
      </EmptyState>,
    );
    const box = document.querySelector('.empty-state');
    expect(box.className).toBe('empty-state');
    expect([...box.children].map((el) => `${el.tagName.toLowerCase()}.${el.className}`))
      .toEqual(['h2.empty-state-title', 'p.empty-state-text', 'div.empty-state-actions']);
    expect(screen.getByRole('heading', { level: 2, name: 'No products match' })).toBeTruthy();
    expect(box.querySelector('p').textContent).toBe('Try another search.');
    expect(box.querySelector('.empty-state-actions').contains(screen.getByRole('button', { name: 'Clear filters' }))).toBe(true);
  });

  it('takes the heading level and a modifier class', () => {
    render(<EmptyState level={3} title="No orders yet" className="is-boxed">Orders show up here.</EmptyState>);
    expect(screen.getByRole('heading', { level: 3, name: 'No orders yet' })).toBeTruthy();
    expect(document.querySelector('.empty-state').className).toBe('empty-state is-boxed');
  });

  it('leaves out the text and the actions when there are none', () => {
    render(<EmptyState level={1} title="Your cart is empty" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Your cart is empty' })).toBeTruthy();
    expect(document.querySelector('.empty-state').children).toHaveLength(1);
  });
});
