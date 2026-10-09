// The header logo: the photo, or the brand in text when it fails (AW-341).
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Header } from './Header.jsx';

const props = {
  cartCount: 0, onCart: vi.fn(), products: [], departments: [], user: null, isAdmin: false,
  onLoginClick: vi.fn(), onSignupClick: vi.fn(), onLogout: vi.fn(), onHelp: vi.fn(),
};

describe('Header logo', () => {
  it('reserves the logo slot with the photo\'s size, and shows the brand in text when it fails', () => {
    render(<Header {...props} />);
    const home = screen.getByRole('link', { name: 'Alabama Wholesale home' });
    const logo = home.querySelector('img');
    expect(logo.getAttribute('alt')).toBe('');
    expect([logo.getAttribute('width'), logo.getAttribute('height')]).toEqual(['320', '320']);
    fireEvent.error(logo);
    expect(home.querySelector('img')).toBeNull();
    expect(home.querySelector('.aw-logo-text').textContent).toBe('AlabamaWHOLESALE INC.');
    // Same link, same name, still the home page.
    expect(screen.getByRole('link', { name: 'Alabama Wholesale home' })).toBe(home);
    expect(home.getAttribute('href')).toBe('/');
    // The photo comes back with the connection.
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(home.querySelector('img')).not.toBeNull();
    expect(home.querySelector('.aw-logo-text')).toBeNull();
  });
});
