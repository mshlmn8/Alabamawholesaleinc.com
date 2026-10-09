// Back to top on long department pages (AW-223).
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackToTop, BACK_TO_TOP_AFTER } from './BackToTop.jsx';

// jsdom does not scroll: the position is set by hand and the scroll event fired.
const scrollTo = (y) => act(() => {
  window.scrollY = y;
  window.dispatchEvent(new Event('scroll'));
});
const frames = [];

beforeEach(() => {
  window.scrollY = 0;
  frames.length = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb));
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  vi.spyOn(window, 'scrollTo').mockImplementation((options) => { window.scrollY = typeof options === 'object' ? options.top : 0; });
});
afterEach(() => {
  window.scrollY = 0;
  vi.restoreAllMocks();
});
// Runs the frames the scroll listener asked for.
const nextFrame = () => act(() => frames.splice(0).forEach((cb) => cb()));
const button = () => screen.queryByRole('button', { name: 'Back to top' });

describe('BackToTop', () => {
  it('appears once the page is scrolled past 1200px, checking once a frame', () => {
    render(<main><h1>Tobacco</h1><BackToTop /></main>);
    nextFrame();
    expect(BACK_TO_TOP_AFTER).toBe(1200);
    expect(button()).toBeNull();
    scrollTo(1200);
    nextFrame();
    expect(button()).toBeNull();
    scrollTo(1500);
    scrollTo(2000);
    scrollTo(2500);
    // Three scroll events, one frame.
    expect(frames).toHaveLength(1);
    nextFrame();
    expect(button()).not.toBeNull();
    expect(button().className).toBe('icon-btn back-to-top');
    expect(button().getAttribute('type')).toBe('button');
    expect(button().querySelector('svg.icon')).not.toBeNull();
    scrollTo(300);
    nextFrame();
    expect(button()).toBeNull();
  });

  it('shows at once on a page that opens scrolled down (a restored position)', () => {
    window.scrollY = 3000;
    render(<BackToTop />);
    expect(button()).not.toBeNull();
  });

  it('jumps to the top and puts focus on the page heading', () => {
    render(<main><h1>Tobacco</h1><BackToTop /></main>);
    scrollTo(2000);
    nextFrame();
    button().focus();
    fireEvent.click(button());
    expect(window.scrollTo).toHaveBeenCalled();
    expect(window.scrollY).toBe(0);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(document.activeElement).toBe(h1);
    expect(h1.getAttribute('tabindex')).toBe('-1');
    // The browser's scroll event for the jump hides the button.
    scrollTo(window.scrollY);
    nextFrame();
    expect(button()).toBeNull();
    expect(document.activeElement).toBe(h1);
  });

  it('jumps again when a smooth scroll still under way moves the page after the jump', () => {
    render(<main><h1>Tobacco</h1><BackToTop /></main>);
    scrollTo(2000);
    nextFrame();
    fireEvent.click(button());
    expect(window.scrollY).toBe(0);
    // The last frame of the smooth scroll Tab started.
    window.scrollY = 450;
    nextFrame();
    expect(window.scrollY).toBe(0);
  });

  it('never covers the footer: it rides on the footer’s top edge, and goes when the footer fills the screen', () => {
    render(<><main><h1>Tobacco</h1><BackToTop /></main><footer><p>WARNING: This product contains nicotine.</p></footer></>);
    const footer = document.querySelector('footer');
    let top = window.innerHeight + 500;
    vi.spyOn(footer, 'getBoundingClientRect').mockImplementation(() => ({ top, bottom: top + 900, left: 0, right: 0, width: 0, height: 900 }));
    const lift = () => button().style.getPropertyValue('--back-to-top-lift');
    scrollTo(2000);
    nextFrame();
    expect(lift()).toBe('0px');
    // The footer's top edge 200px up the screen: the button rises 200px.
    top = window.innerHeight - 200;
    scrollTo(2200);
    nextFrame();
    expect(lift()).toBe('200px');
    // A filter shortens the page without a scroll: the resize is checked too.
    top = window.innerHeight - 300;
    act(() => window.dispatchEvent(new Event('resize')));
    nextFrame();
    expect(lift()).toBe('300px');
    // The footer reaches the top of the screen: no room left above it.
    top = 30;
    scrollTo(3000);
    nextFrame();
    expect(button()).toBeNull();
    top = window.innerHeight - 100;
    scrollTo(2100);
    nextFrame();
    expect(lift()).toBe('100px');
  });

  it('stops listening when it unmounts', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<BackToTop />);
    unmount();
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});
