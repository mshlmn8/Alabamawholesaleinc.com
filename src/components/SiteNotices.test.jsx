// Account notices: read out once through the shared live region, and
// dismissing one keeps focus on the page.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SiteNotices } from './SiteNotices.jsx';

afterEach(() => vi.useRealTimers());

describe('SiteNotices', () => {
  it('renders nothing without notices', () => {
    const { container } = render(<SiteNotices notices={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('announces a new notice once and runs its actions', () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    const notices = [{ id: 'session-ended', title: 'Your session has ended', text: 'Sign in again.', actions: [{ id: 'sign-in', label: 'Sign in', onClick }] }];
    const view = render(<SiteNotices notices={notices} />);
    act(() => { vi.advanceTimersByTime(1000); });
    const region = document.getElementById('aw-announcer');
    expect(region.textContent).toBe('Your session has ended. Sign in again.');
    region.textContent = '';
    view.rerender(<SiteNotices notices={[...notices]} />);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(region.textContent).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onClick).toHaveBeenCalled();
  });

  it('moves focus to <main> when a notice is dismissed', () => {
    const main = document.createElement('main');
    main.id = 'main';
    main.tabIndex = -1;
    document.body.appendChild(main);
    const onDismiss = vi.fn();
    render(<SiteNotices notices={[{ id: 'signed-out', text: 'You’re signed out.', onDismiss }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss this notice' }));
    expect(onDismiss).toHaveBeenCalled();
    expect(document.activeElement).toBe(main);
    main.remove();
  });
});
