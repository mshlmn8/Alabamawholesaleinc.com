// Responsive <picture> for an images.js picture object: WebP sources with a
// JPEG fallback, real width/height, lazy by default. `priority` marks the
// likely largest visible image (hero, product photo) as eager/high priority.
//
// Loading and failure (AW-192, AW-343, AW-345; src/lib/useImageStatus.js):
// - The img gets the class `is-loaded` once the photo is in. index.css fades
//   lazy tile photos in on it and shows a sheen on the tile until then.
// - A failed photo renders `fallback` (nothing by default) and calls
//   `onFail`. A caller's own onLoad and onError still run.
// - A failed photo is requested again when the connection comes back.
import { useImageStatus } from '../lib/useImageStatus.js';

export function Picture(props) {
  if (!props.picture?.src) return null;
  // Keyed by the photo, so a new src starts again at 'loading'.
  return <PictureImage key={props.picture.src} {...props} />;
}

function PictureImage({
  picture, alt = '', sizes, loading = 'lazy', priority = false, decoding = 'async', className,
  fallback = null, onFail, onLoad, onError, ...rest
}) {
  const { status, attempt, ref, onLoad: loaded, onError: failed } = useImageStatus();
  if (status === 'failed') return fallback;
  const responsive = Boolean(picture.srcSet);
  const img = (
    <img
      key={attempt}
      src={picture.src}
      srcSet={responsive ? picture.srcSet : undefined}
      sizes={responsive ? sizes : undefined}
      width={picture.width || undefined}
      height={picture.height || undefined}
      alt={alt}
      loading={priority ? 'eager' : loading}
      decoding={decoding}
      className={[className, status === 'loaded' && 'is-loaded'].filter(Boolean).join(' ') || undefined}
      {...(priority ? { fetchpriority: 'high' } : null)}
      {...rest}
      ref={ref}
      onLoad={(e) => {
        loaded();
        onLoad?.(e);
      }}
      onError={(e) => {
        failed();
        onFail?.();
        onError?.(e);
      }}
    />
  );
  if (!picture.webpSrcSet) return img;
  // A new attempt is a new element, so the browser requests the photo again.
  return (
    <picture key={attempt}>
      <source type="image/webp" srcSet={picture.webpSrcSet} sizes={sizes} />
      {img}
    </picture>
  );
}
