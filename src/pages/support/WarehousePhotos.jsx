// The contact page's warehouse photos (AW-006, owner answer 2026-10): the 29
// of the owner's 37 photos that the home page's reel doesn't show
// (WAREHOUSE_GALLERY in src/data/warehousePhotos.js), so none is left out.
//
// - A grid of tiles, three across on a wide screen and two on a phone
//   (index.css, SIZES.warehouse in src/lib/images.js). Each tile is one
//   button: the photo in a 16:9 frame (the photos' own shape, so nothing
//   moves as they arrive) and its description under it, which is also the
//   button's name. The photos load lazily, from the 480 or 740 rendition.
// - The photos of tobacco, vapes and nicotine pouches are a group of their
//   own under the FDA statement, as a nicotine product card carries it
//   (AW-026; where the statement goes on photos is the counsel question in
//   docs/OWNER-TODO.md).
// - A tile opens the photo larger in the product page's zoom dialog
//   (ModalLayer: Escape, Back and Close close it, focus returns to the
//   tile), with Previous and Next (and the arrow keys) through the tile's
//   group, so the statement stays with the photos it belongs to. The
//   dialog's frame has the photos' shape and a fixed size, so it doesn't
//   change size from one photo to the next or while one loads.
// - Shelf stickers in the photos are not prices; a note under the grid says
//   so (owner, 2026-09-28).

import { useId, useState } from 'react';
import { WAREHOUSE_GALLERY } from '../../data/warehousePhotos.js';
import { SIZES, heroImage, zoomSizes } from '../../lib/images.js';
import { Icon } from '../../components/Icon.jsx';
import { ModalLayer } from '../../components/ModalLayer.jsx';
import { NicotineWarning } from '../../components/NicotineWarning.jsx';
import { Picture } from '../../components/Picture.jsx';

// The photos' width over their height: every warehouse photo is 1600 × 900.
export const WAREHOUSE_ASPECT = 16 / 9;

const withPicture = ({ file, alt, nicotine }) => ({ file, alt, nicotine, ...heroImage(file) });
export const GENERAL_PHOTOS = WAREHOUSE_GALLERY.filter((photo) => !photo.nicotine).map(withPicture);
export const NICOTINE_PHOTOS = WAREHOUSE_GALLERY.filter((photo) => photo.nicotine).map(withPicture);

export const PRICE_NOTE = 'Shelf stickers and labels in these photos aren’t our prices.';

function PhotoGrid({ photos, label, onOpen }) {
  return (
    <ul className="warehouse-grid" aria-label={label}>
      {photos.map((photo, index) => (
        <li key={photo.file}>
          <button type="button" className="warehouse-tile" aria-haspopup="dialog" onClick={() => onOpen(index)}>
            <span className="warehouse-frame">
              <Picture picture={photo.picture} alt="" sizes={SIZES.warehouse} />
            </span>
            <span className="warehouse-caption">{photo.alt}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// The enlarged photo, with Previous and Next through `photos`.
function PhotoViewer({ photos, index, nicotine, onIndex, onClose }) {
  const count = photos.length;
  const photo = photos[index];
  const step = (delta) => onIndex((index + delta + count) % count);
  const onKeyDown = (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft') step(-1);
    else if (event.key === 'ArrowRight') step(1);
    else return;
    event.preventDefault();
  };
  return (
    <ModalLayer onClose={onClose}>
      {/* Backdrop click is a mouse shortcut; Escape, Back (ModalLayer) and the Close button are the other ways out. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="overlay pd-zoom-overlay" onClick={onClose}>
        {/* Keeps clicks inside the dialog from reaching the backdrop; the arrow keys step through the photos. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <div className="dialog pd-zoom-dialog warehouse-viewer scale-in" role="dialog" aria-modal="true" aria-label="Warehouse photos"
             onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
          {nicotine && <NicotineWarning compact />}
          <span className="warehouse-viewer-frame">
            <Picture picture={photo.picture} alt={photo.alt} sizes={zoomSizes(photo.picture?.width, WAREHOUSE_ASPECT)} loading="eager" />
          </span>
          <div className="warehouse-viewer-bar">
            {/* The description and place are read out as the photo changes;
                the place shows between Previous and Next. */}
            <p className="warehouse-viewer-caption" aria-live="polite" aria-atomic="true">
              <span>{photo.alt}</span>
              <span className="sr-only">{`, photo ${index + 1} of ${count}`}</span>
            </p>
            <div className="warehouse-viewer-nav">
              <button className="icon-btn" type="button" aria-label="Previous photo" onClick={() => step(-1)}><Icon name="chevron-left" /></button>
              <span className="warehouse-viewer-count" aria-hidden="true">{`${index + 1} of ${count}`}</span>
              <button className="icon-btn" type="button" aria-label="Next photo" onClick={() => step(1)}><Icon name="chevron-right" /></button>
            </div>
          </div>
        </div>
      </div>
    </ModalLayer>
  );
}

export function WarehousePhotos() {
  // { group: 'general' | 'nicotine', index } while a photo is open.
  const [open, setOpen] = useState(null);
  const id = useId();
  const titleId = `${id}-title`;
  const groupId = `${id}-nicotine`;
  const photos = open?.group === 'nicotine' ? NICOTINE_PHOTOS : GENERAL_PHOTOS;
  return (
    <section className="warehouse-photos" aria-labelledby={titleId}>
      <p className="eyebrow">THE WAREHOUSE</p>
      <h2 id={titleId}>A look around the warehouse</h2>
      <p>The building, the floor and the stock on the shelves. Select a photo to see it larger.</p>
      <PhotoGrid photos={GENERAL_PHOTOS} label="Warehouse photos" onOpen={(index) => setOpen({ group: 'general', index })} />
      <section className="warehouse-group" aria-labelledby={groupId}>
        <h3 id={groupId}>Tobacco, vapes and nicotine pouches</h3>
        {/* TODO(owner): Do the warehouse photos count as advertisements under 21 CFR 1143.3 (warning in the upper portion of the ad, at least 20% of its area)? The group shows the verbatim warning above its photos until counsel answers. (AW-026) */}
        <NicotineWarning />
        <PhotoGrid photos={NICOTINE_PHOTOS} label="Tobacco, vapes and nicotine pouches" onOpen={(index) => setOpen({ group: 'nicotine', index })} />
      </section>
      <p className="support-note">{PRICE_NOTE}</p>
      {open && (
        <PhotoViewer photos={photos} index={open.index} nicotine={open.group === 'nicotine'}
                     onIndex={(index) => setOpen((current) => ({ ...current, index }))} onClose={() => setOpen(null)} />
      )}
    </section>
  );
}
