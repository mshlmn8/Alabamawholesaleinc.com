// Photo loading, failure and retry (AW-192, AW-343, AW-345): Picture and the
// useImageStatus hook behind it, Thumb and ProductPhoto.
import { act, fireEvent, render, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useImageStatus } from '../lib/useImageStatus.js';
import { Picture } from './Picture.jsx';
import { Thumb } from './Thumb.jsx';
import { ProductPhoto } from './ProductPhoto.jsx';

const JPEG = { src: '/a--640x640.jpg', srcSet: '/a--320x320.jpg 320w, /a--640x640.jpg 640w', webpSrcSet: '', width: 640, height: 640 };
const WEBP = { ...JPEG, webpSrcSet: '/a--320x320.webp 320w, /a--640x640.webp 640w' };
const img = () => document.querySelector('img');
const online = () => act(() => { window.dispatchEvent(new Event('online')); });
const Fallback = () => <span className="test-fallback">No photo</span>;

describe('useImageStatus', () => {
  it('starts loading, and counts an image that was already complete when attached as loaded', () => {
    const { result } = renderHook(() => useImageStatus());
    expect(result.current).toMatchObject({ status: 'loading', attempt: 0 });
    // Still on its way: no change.
    act(() => result.current.ref({ complete: false, naturalWidth: 0 }));
    expect(result.current.status).toBe('loading');
    // Complete but broken (naturalWidth 0) is left to the error event.
    act(() => result.current.ref({ complete: true, naturalWidth: 0 }));
    expect(result.current.status).toBe('loading');
    act(() => result.current.ref({ complete: true, naturalWidth: 320 }));
    expect(result.current.status).toBe('loaded');
    act(() => result.current.ref(null));
    expect(result.current.status).toBe('loaded');
  });

  it('retries a failed image when the connection comes back, up to `retries` times', () => {
    const { result } = renderHook(() => useImageStatus({ retries: 1 }));
    // Online before a failure does nothing.
    online();
    expect(result.current).toMatchObject({ status: 'loading', attempt: 0 });
    act(() => result.current.onError());
    expect(result.current.status).toBe('failed');
    online();
    expect(result.current).toMatchObject({ status: 'loading', attempt: 1 });
    act(() => result.current.onError());
    online();
    expect(result.current).toMatchObject({ status: 'failed', attempt: 1 });
  });
});

describe('Picture', () => {
  it('keeps the responsive markup: sizes, real width and height, lazy by default', () => {
    render(<Picture picture={JPEG} alt="Kite" sizes="300px" className="bg" aria-hidden="true" />);
    expect(img().getAttribute('src')).toBe(JPEG.src);
    expect(img().getAttribute('srcset')).toBe(JPEG.srcSet);
    expect(img().getAttribute('sizes')).toBe('300px');
    expect([img().getAttribute('width'), img().getAttribute('height')]).toEqual(['640', '640']);
    expect(img().getAttribute('loading')).toBe('lazy');
    expect(img().getAttribute('decoding')).toBe('async');
    expect(img().getAttribute('fetchpriority')).toBeNull();
    expect(img().getAttribute('aria-hidden')).toBe('true');
    expect(img().className).toBe('bg');
  });

  it('loads a priority photo eagerly at high priority, inside <picture> with the WebP sources', () => {
    render(<Picture picture={WEBP} alt="Kite" sizes="300px" priority />);
    expect(img().getAttribute('loading')).toBe('eager');
    expect(img().getAttribute('fetchpriority')).toBe('high');
    const source = document.querySelector('picture > source');
    expect(source.getAttribute('type')).toBe('image/webp');
    expect(source.getAttribute('srcset')).toBe(WEBP.webpSrcSet);
    expect(img().parentElement.tagName).toBe('PICTURE');
  });

  it('renders nothing without a src', () => {
    const { container } = render(<Picture picture={{ src: '' }} alt="" fallback={<Fallback />} />);
    expect(container.innerHTML).toBe('');
  });

  it('adds is-loaded when the photo has loaded, and still calls the caller\'s onLoad', () => {
    const onLoad = vi.fn();
    render(<Picture picture={JPEG} alt="Kite" className="bg" onLoad={onLoad} />);
    expect(img().className).toBe('bg');
    fireEvent.load(img());
    expect(img().className).toBe('bg is-loaded');
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it('shows the fallback when the photo fails, and calls onFail once and the caller\'s onError', () => {
    const onFail = vi.fn();
    const onError = vi.fn();
    render(<Picture picture={JPEG} alt="Kite" fallback={<Fallback />} onFail={onFail} onError={onError} />);
    fireEvent.error(img());
    expect(img()).toBeNull();
    expect(document.querySelector('.test-fallback').textContent).toBe('No photo');
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('renders nothing for a failed photo without a fallback', () => {
    const { container } = render(<Picture picture={JPEG} alt="" />);
    fireEvent.error(img());
    expect(container.innerHTML).toBe('');
  });

  it('requests the photo again with a new element when the connection comes back', () => {
    render(<Picture picture={WEBP} alt="Kite" fallback={<Fallback />} />);
    const first = img();
    const firstPicture = first.parentElement;
    fireEvent.error(first);
    expect(img()).toBeNull();
    online();
    expect(img()).not.toBeNull();
    expect(img()).not.toBe(first);
    expect(img().parentElement).not.toBe(firstPicture);
    expect(img().className).toBe('');
    expect(document.querySelector('.test-fallback')).toBeNull();
    fireEvent.load(img());
    expect(img().className).toBe('is-loaded');
  });

  it('stops retrying after three attempts', () => {
    const onFail = vi.fn();
    render(<Picture picture={JPEG} alt="Kite" fallback={<Fallback />} onFail={onFail} />);
    for (let attempt = 0; attempt < 3; attempt++) {
      fireEvent.error(img());
      online();
      expect(img(), `retry ${attempt + 1}`).not.toBeNull();
    }
    fireEvent.error(img());
    online();
    expect(img()).toBeNull();
    expect(document.querySelector('.test-fallback')).not.toBeNull();
    expect(onFail).toHaveBeenCalledTimes(4);
  });

  it('starts again for a new photo', () => {
    const view = render(<Picture picture={JPEG} alt="Kite" fallback={<Fallback />} />);
    fireEvent.load(img());
    expect(img().className).toBe('is-loaded');
    // A new src is a new photo: loading again, and a failure is its own.
    const next = { ...JPEG, src: '/b--640x640.jpg', srcSet: '' };
    view.rerender(<Picture picture={next} alt="Kite" fallback={<Fallback />} />);
    expect(img().getAttribute('src')).toBe(next.src);
    expect(img().className).toBe('');
    fireEvent.error(img());
    expect(document.querySelector('.test-fallback')).not.toBeNull();
    view.rerender(<Picture picture={JPEG} alt="Kite" fallback={<Fallback />} />);
    expect(img().getAttribute('src')).toBe(JPEG.src);
    expect(document.querySelector('.test-fallback')).toBeNull();
  });
});

describe('Thumb', () => {
  it('shows the compact placeholder without a photo', () => {
    render(<Thumb src={null} />);
    expect(img()).toBeNull();
    expect(document.querySelector('.photo-soon.is-compact')).not.toBeNull();
  });

  it('is a decorative, lazy 52px image that falls back to the placeholder and retries online', () => {
    render(<Thumb src="/kite--320x320.jpg" />);
    expect(img().getAttribute('alt')).toBe('');
    expect([img().getAttribute('width'), img().getAttribute('height')]).toEqual(['52', '52']);
    expect(img().getAttribute('loading')).toBe('lazy');
    expect(img().getAttribute('decoding')).toBe('async');
    fireEvent.load(img());
    expect(img().className).toBe('is-loaded');
    fireEvent.error(img());
    expect(img()).toBeNull();
    expect(document.querySelector('.photo-soon.is-compact')).not.toBeNull();
    online();
    expect(img().getAttribute('src')).toBe('/kite--320x320.jpg');
    expect(document.querySelector('.photo-soon')).toBeNull();
  });
});

describe('ProductPhoto', () => {
  const product = { id: 14, name: 'Kite cigarette tobacco', picture: JPEG };

  it('shows "Photo coming soon" without a photo', () => {
    render(<ProductPhoto product={{ ...product, picture: null }} sizes="300px" />);
    expect(img()).toBeNull();
    expect(document.querySelector('.photo-soon-label').textContent).toBe('Photo coming soon');
    expect(document.querySelector('.photo-soon-name').textContent).toBe(product.name);
  });

  it('shows the photo named by the product, and the placeholder when it fails', () => {
    render(<ProductPhoto product={product} sizes="300px" priority />);
    expect(img().getAttribute('alt')).toBe(product.name);
    expect(img().getAttribute('sizes')).toBe('300px');
    expect(img().getAttribute('loading')).toBe('eager');
    fireEvent.error(img());
    expect(img()).toBeNull();
    expect(document.querySelector('.photo-soon-name').textContent).toBe(product.name);
  });
});
