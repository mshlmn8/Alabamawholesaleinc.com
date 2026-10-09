// The small product thumbnail in the header search results (40px) and on
// cart and checkout lines (52px). No photo, or a photo that failed to load,
// shows the compact "photo coming soon" mark (AW-192); a failed photo is
// requested again when the connection comes back (AW-343). The product name
// is printed beside it, so the image is decorative.
import { useImageStatus } from '../lib/useImageStatus.js';
import { MissingPhoto } from './MissingPhoto.jsx';

export function Thumb({ src }) {
  if (!src) return <MissingPhoto compact />;
  // Keyed by the photo, so a new src starts again at 'loading'.
  return <ThumbImage key={src} src={src} />;
}

function ThumbImage({ src }) {
  const { status, attempt, ref, onLoad, onError } = useImageStatus();
  if (status === 'failed') return <MissingPhoto compact />;
  return (
    <img
      key={attempt}
      ref={ref}
      src={src}
      alt=""
      width="52"
      height="52"
      loading="lazy"
      decoding="async"
      className={status === 'loaded' ? 'is-loaded' : undefined}
      onLoad={onLoad}
      onError={onError}
    />
  );
}
