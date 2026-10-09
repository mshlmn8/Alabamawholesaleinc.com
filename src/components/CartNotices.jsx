// Notices about the cart itself, at the top of the cart drawer and of the
// checkout page:
//   SavedLinesNotice   products from an older cart that need a variant before
//                      they can be ordered (AW-354), each with its saved
//                      quantity and a link to its page, where that quantity
//                      is filled in. Dismissing it forgets the list.
//   UnavailableNotice  lines that can no longer be ordered (AW-083), with a
//                      way to remove them all.

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

// items: the cart's unavailable lines. noun: 'quote' or 'order', what the
// page calls the basket (basketTerms in src/data/terms.js, AW-132).
export function UnavailableNotice({ items, onRemoveAll, noun = 'quote' }) {
  if (!items.length) return null;
  const remove = (event) => {
    keepFocusNear(event.currentTarget);
    onRemoveAll(items.map((item) => item.lineKey));
    announce(items.length === 1 ? 'Removed 1 item that is no longer available.' : `Removed ${items.length} items that are no longer available.`);
  };
  return (
    <div className="cart-notice is-warn" data-notice="unavailable">
      <p className="cart-notice-title">{items.length === 1 ? `1 item in your ${noun} is no longer available.` : `${items.length} items in your ${noun} are no longer available.`}</p>
      <p>Remove them to continue, or choose another variant where the product is still offered.</p>
      <button className="text-link" type="button" onClick={remove}>Remove unavailable items</button>
    </div>
  );
}
