// Render-error fallback (AW-183).
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMPANY } from '../data/content.js';
import { ErrorBoundary } from './ErrorBoundary.jsx';

function Page({ name, broken }) {
  if (broken) throw new Error(`${name} is broken`);
  return <h1>{name}</h1>;
}

const quietConsole = () => vi.spyOn(console, 'error').mockImplementation(() => {});
// React's development build re-dispatches render errors as window errors,
// which jsdom would print; the boundary is what handles them here.
const swallow = (e) => e.preventDefault();
beforeEach(() => window.addEventListener('error', swallow));
afterEach(() => window.removeEventListener('error', swallow));

describe('ErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    render(<ErrorBoundary resetKey="a"><Page name="Home" /></ErrorBoundary>);
    expect(screen.getByRole('heading', { name: 'Home' })).toBeTruthy();
  });

  it('shows a recoverable fallback with the trade desk contacts', () => {
    const log = quietConsole();
    render(<ErrorBoundary resetKey="a"><Page name="Home" broken /></ErrorBoundary>);
    const heading = screen.getByRole('heading', { level: 1, name: 'Something went wrong loading this page' });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByRole('button', { name: /Reload/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Go to home' }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: COMPANY.phone }).getAttribute('href')).toBe(`tel:${COMPANY.phoneRaw}`);
    expect(screen.getByRole('link', { name: COMPANY.email }).getAttribute('href')).toBe(`mailto:${COMPANY.email}`);
    expect(log).toHaveBeenCalledWith('A page failed to render.', expect.any(Error), expect.anything());
  });

  it('shows the logo in the full-page fallback', () => {
    quietConsole();
    render(<ErrorBoundary fullPage><Page name="Home" broken /></ErrorBoundary>);
    expect(screen.getByRole('img', { name: COMPANY.name })).toBeTruthy();
  });

  it('clears the error when the route changes', () => {
    quietConsole();
    const { rerender } = render(<ErrorBoundary resetKey="a"><Page name="Broken" broken /></ErrorBoundary>);
    expect(screen.getByText('Something went wrong loading this page')).toBeTruthy();
    rerender(<ErrorBoundary resetKey="a"><Page name="Still here" /></ErrorBoundary>);
    expect(screen.getByText('Something went wrong loading this page')).toBeTruthy();
    rerender(<ErrorBoundary resetKey="b"><Page name="Next page" /></ErrorBoundary>);
    expect(screen.getByRole('heading', { name: 'Next page' })).toBeTruthy();
  });

  it('keeps the fallback, without looping, when the next page is broken too', () => {
    quietConsole();
    const { rerender } = render(<ErrorBoundary resetKey="a"><Page name="Home" /></ErrorBoundary>);
    rerender(<ErrorBoundary resetKey="b"><Page name="B" broken /></ErrorBoundary>);
    expect(screen.getByText('Something went wrong loading this page')).toBeTruthy();
    rerender(<ErrorBoundary resetKey="c"><Page name="C" broken /></ErrorBoundary>);
    expect(screen.getByText('Something went wrong loading this page')).toBeTruthy();
    rerender(<ErrorBoundary resetKey="d"><Page name="D" /></ErrorBoundary>);
    expect(screen.getByRole('heading', { name: 'D' })).toBeTruthy();
  });
});
