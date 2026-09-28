// Responsive <picture> for an images.js picture object: WebP sources with a
// JPEG fallback, real width/height, lazy by default. `priority` marks the
// likely largest visible image (hero, product photo) as eager/high priority.
export function Picture({ picture, alt = '', sizes, loading = 'lazy', priority = false, decoding = 'async', className, ...rest }) {
  if (!picture?.src) return null;
  const responsive = Boolean(picture.srcSet);
  const img = (
    <img
      src={picture.src}
      srcSet={responsive ? picture.srcSet : undefined}
      sizes={responsive ? sizes : undefined}
      width={picture.width || undefined}
      height={picture.height || undefined}
      alt={alt}
      loading={priority ? 'eager' : loading}
      decoding={decoding}
      className={className}
      {...(priority ? { fetchpriority: 'high' } : null)}
      {...rest}
    />
  );
  if (!picture.webpSrcSet) return img;
  return (
    <picture>
      <source type="image/webp" srcSet={picture.webpSrcSet} sizes={sizes} />
      {img}
    </picture>
  );
}
