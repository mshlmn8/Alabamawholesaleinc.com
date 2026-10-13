// useLeaveGuard (AW-118): a dirty form holds the router's leave guard and a
// beforeunload prompt; a clean or unmounted one holds neither.
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigate } from '../../lib/router.js';
import { useLeaveGuard } from './useLeaveGuard.js';

const url = () => window.location.pathname + window.location.search;
function Form({ dirty }) {
  useLeaveGuard(dirty, 'Leave without saving?');
  return null;
}
const unloadPrevented = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  act(() => navigate('/admin/products', { replace: true }));
});
afterEach(() => vi.restoreAllMocks());

describe('useLeaveGuard', () => {
  it('asks before leaving only while the form is dirty', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const view = render(<Form dirty={false} />);
    expect(unloadPrevented()).toBe(false);
    act(() => navigate('/admin/orders'));
    expect(confirm).not.toHaveBeenCalled();
    expect(url()).toBe('/admin/orders');

    view.rerender(<Form dirty />);
    expect(unloadPrevented()).toBe(true);
    act(() => navigate('/admin/accounts'));
    expect(confirm).toHaveBeenCalledWith('Leave without saving?');
    expect(url()).toBe('/admin/orders');
    confirm.mockReturnValue(true);
    act(() => navigate('/admin/accounts'));
    expect(url()).toBe('/admin/accounts');

    confirm.mockClear();
    view.rerender(<Form dirty={false} />);
    expect(unloadPrevented()).toBe(false);
    act(() => navigate('/admin/products'));
    expect(confirm).not.toHaveBeenCalled();
    expect(url()).toBe('/admin/products');
  });

  it('lets go when the form unmounts', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const view = render(<Form dirty />);
    view.unmount();
    expect(unloadPrevented()).toBe(false);
    act(() => navigate('/admin/orders'));
    expect(confirm).not.toHaveBeenCalled();
    expect(url()).toBe('/admin/orders');
  });
});
