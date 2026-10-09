// The loading state of one photo (AW-192, AW-343, AW-345): 'loading' until
// the browser has it, then 'loaded', or 'failed' when the request fails.
//
//   const image = useImageStatus();
//   if (image.status === 'failed') return <Fallback />;
//   return <img key={image.attempt} ref={image.ref} onLoad={image.onLoad} onError={image.onError} … />;
//
// - A failed photo is tried again when the connection comes back (the window
//   'online' event), up to `retries` times. The caller renders the image with
//   key={attempt}, so React makes a new element and the browser asks again.
// - `ref` counts an image that had already loaded before React attached its
//   handlers (a cached photo) as loaded.
// - The state belongs to one photo. A component whose src can change renders
//   the image in an inner component keyed by the src, so a new photo starts
//   at 'loading' (see Picture and Thumb).
// Picture, Thumb, ProductPhoto, the header logo and the hero use it; a new
// photo should go through one of them.

import { useCallback, useEffect, useState } from 'react';

export function useImageStatus({ retries = 3 } = {}) {
  const [state, setState] = useState({ status: 'loading', attempt: 0 });
  const { status, attempt } = state;

  const onLoad = useCallback(() => {
    setState((s) => (s.status === 'loaded' ? s : { ...s, status: 'loaded' }));
  }, []);
  const onError = useCallback(() => {
    setState((s) => (s.status === 'failed' ? s : { ...s, status: 'failed' }));
  }, []);
  const ref = useCallback((el) => {
    if (el && el.complete && el.naturalWidth > 0) {
      setState((s) => (s.status === 'loading' ? { ...s, status: 'loaded' } : s));
    }
  }, []);

  useEffect(() => {
    if (status !== 'failed' || attempt >= retries) return undefined;
    const retry = () => setState((s) => (s.status === 'failed' ? { status: 'loading', attempt: s.attempt + 1 } : s));
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [status, attempt, retries]);

  return { status, attempt, onLoad, onError, ref };
}
