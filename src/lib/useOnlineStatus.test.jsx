// The online status follows the browser's online and offline events (AW-344).
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useOnlineStatus } from './useOnlineStatus.js';

function Probe() {
  return <p data-testid="online">{useOnlineStatus() ? 'online' : 'offline'}</p>;
}

describe('useOnlineStatus', () => {
  it('follows the online and offline events', () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    render(<Probe />);
    expect(screen.getByTestId('online').textContent).toBe('online');
    onLine.mockReturnValue(false);
    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(screen.getByTestId('online').textContent).toBe('offline');
    onLine.mockReturnValue(true);
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(screen.getByTestId('online').textContent).toBe('online');
  });

  it('starts offline when the page opens offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<Probe />);
    expect(screen.getByTestId('online').textContent).toBe('offline');
  });
});
