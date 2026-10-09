// Notices about the cart itself, at the top of the cart drawer and of the
// checkout page:
//   SavedLinesNotice   products from an older cart that need a variant before
//                      they can be ordered (AW-354), each with its saved
//                      quantity and a link to its page, where that quantity
//                      is filled in. Dismissing it forgets the list.
//   UnavailableNotice  lines that can no longer be ordered (AW-083), with a
//                      way to remove them all. Its words follow how many
//                      there are, and offer another variant only when a
//                      line's product is still offered (NEW-021).

import { useId } from 'react';
import { Link } from '../lib/router.js';
import { announce } from '../lib/announce.js';
// A notice's button is about to disappear: keepFocusNear keeps focus in the
// drawer (on its heading) or on the page.
import { keepFocusNear } from '../lib/focus.js';

// items: [{ productId, qty, name }]. onChoose runs when a Choose link is
// followed (the drawer closes itself).
export function SavedLinesNotice({ items, onDismiss, onChoose }) {
  const titleId = useId();
  if (!items.length) return null;
  const products = items.length === 1 ? '1 product' : `${items.length} products`;
  return (
    <section className="cart-notice" aria-labelledby={titleId} data-notice="saved-lines">
      <p id={titleId} className="cart-notice-title">{`Our catalog was updated. Choose a variant for ${products} from your last visit.`}</p>
      <ul className="cart-notice-list">
        {items.map((item) => (
          <li key={item.productId}>
            <span className="cart-notice-name">{item.name}</span>
            <span className="cart-notice-qty">{`Quantity ${item.qty}`}</span>
            <Link className="text-link" to={{ page: 'product', productId: item.productId }} onClick={onChoose}
                  aria-label={`Choose a variant for ${item.name}`}>Choose</Link>
          </li>
        ))}
      </ul>
      <button className="text-link" type="button" onClick={(event) => { keepFocusNear(event.currentTarget); onDismiss(); }}>
        Dismiss this list
      </button>
    </section>
  );
}

// What UnavailableNotice says under its title (NEW-021): "it" or "them",
// and the other-variant advice only when some line's product is still
// offered with other variants (item.unavailable 'variant', src/lib/lines.js);
// a product that left the catalog has none to offer.
export function unavailableAdvice(items) {
  const remove = items.length === 1 ? 'Remove it to continue' : 'Remove them to continue';
  const variants = items.some((item) => item.unavailable === 'variant');
  return variants ? `${remove}, or choose another variant where the product is still offered.` : `${remove}.`;
}

// items: the cart's unavailable lines. noun: 'quote' or 'order', what the
// page calls the basket (basketTerms in src/data/terms.js, AW-132).
export function UnavailableNotice({ items, onRemoveAll, noun = 'quote' }) {
  if (!items.length) return null;
  const one = items.length === 1;
  const remove = (event) => {
    keepFocusNear(event.currentTarget);
    onRemoveAll(items.map((item) => item.lineKey));
    announce(one ? 'Removed 1 item that is no longer available.' : `Removed ${items.length} items that are no longer available.`);
  };
  return (
    <div className="cart-notice is-warn" data-notice="unavailable">
      <p className="cart-notice-title">{one ? `1 item in your ${noun} is no longer available.` : `${items.length} items in your ${noun} are no longer available.`}</p>
      <p>{unavailableAdvice(items)}</p>
      <button className="text-link" type="button" onClick={remove}>{one ? 'Remove unavailable item' : 'Remove unavailable items'}</button>
    </div>
  );
}
