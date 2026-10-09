// Header search: an ARIA 1.2 combobox over the catalog search (AW-171), with
// the matching rules of src/lib/search.js (AW-063, AW-064).
//
// - Typing lists the best 8 matches and then "See all N results for “q”" (a
//   link to /search?q=, AW-007) as the options of a listbox. Focus stays in
//   the box: ArrowDown opens the list or moves to the next option, ArrowUp
//   to the previous one (both wrap), Home/End jump to the first/last option
//   while one is active (otherwise they move the caret). Only the keys make
//   an option active: the pointer gets a hover style, so a list that opens or
//   scrolls under a resting pointer never arms Enter. Enter follows the
//   active option, or with none active opens /search?q= and keeps the text
//   (AW-007); a query under MIN_QUERY_LENGTH says so instead. Escape closes
//   the list and keeps the text; Escape on a closed list clears the box.
// - The options are real links (role=option is allowed on a[href]), so a
//   middle click or "Open in new tab" still works. They are not Tab stops:
//   Tab goes to the Search button and then on, and the list closes as soon
//   as focus leaves the form (AW-165). A blur without a relatedTarget never
//   closes it: Safari does not focus a link or button on click, so a click
//   on an option blurs the box with relatedTarget null. Clicks outside close
//   it through the document listener, and a mousedown in the list is
//   cancelled so focus stays in the box.
// - The count is read out by one always-present status element, about
//   300 ms after typing stops; the visible heading is plain text.
// - Picking a product clears the box; /search keeps the text, and on /search
//   the box shows that page's query.
// - In the compact layout, focusing the box scrolls the bar to the top of
//   the screen, so the list has the height below it (AW-307). Where the
//   masthead sticks and is stuck already, the box is as high as it goes and
//   the page stays put (AW-153).
// It never changes the page title (AW-338).
// - A result's department, line and SKU wrap between them, and a SKU longer
//   than the row ends in an ellipsis instead of breaking at its hyphens
//   (TextParts, AW-304).

import { useEffect, useMemo, useRef, useState } from 'react';
import { MIN_QUERY_LENGTH, searchProducts } from '../lib/search.js';
import { catLabel } from '../lib/format.js';
import { Link, navigate, parseUrl, useLocation } from '../lib/router.js';
import { Icon } from './Icon.jsx';
import { TextParts } from './TextParts.jsx';
import { Thumb } from './Thumb.jsx';

// Products listed in the dropdown.
export const SEARCH_PREVIEW = 8;
// The count is announced once typing has paused this long.
export const STATUS_DELAY_MS = 300;
const LIST_ID = 'aw-search-listbox';
const optionId = (i) => `aw-search-option-${i}`;
const queryOf = (location) => {
  const route = parseUrl(location);
  return route.page === 'search' ? route.q : null;
};
// A mousedown on an option or the clear button would move focus out of the
// box (in Safari, to nowhere); cancelling it keeps focus, and the phone
// keyboard, where they are. The click still follows the link.
const keepFocus = (e) => e.preventDefault();

// Whether the sticky header (App's .site-header) is stuck with its trade bar
// scrolled away (src/lib/stickyHeader.js).
export function headerStuck(el) {
  const header = el?.closest?.('.site-header');
  if (!header || window.getComputedStyle(header).position !== 'sticky') return false;
  const bar = header.querySelector('.trade-bar');
  return header.getBoundingClientRect().top <= -(bar ? bar.getBoundingClientRect().height : 0) + 1;
}

export function HeaderSearch({ products, isMobile = false, onOpen }) {
  const location = useLocation();
  const [query, setQuery] = useState(() => queryOf(location) ?? '');
  const [open, setOpen] = useState(false);
  // Enter on a query shorter than MIN_QUERY_LENGTH says so in the panel.
  const [tooShort, setTooShort] = useState(false);
  // The highlighted option's index, -1 for none.
  const [active, setActive] = useState(-1);
  const [announced, setAnnounced] = useState('');
  const formRef = useRef(null);
  const inputRef = useRef(null);
  // Set by the keys (not the pointer), so the option they reach scrolls into view.
  const revealActive = useRef(false);

  // A new page (a followed option, Back/Forward) closes the list; /search
  // shows its query in the box.
  const [seenLocation, setSeenLocation] = useState(location);
  if (seenLocation !== location) {
    setSeenLocation(location);
    setOpen(false);
    setActive(-1);
    setTooShort(false);
    const q = queryOf(location);
    if (q !== null) setQuery(q);
  }

  const search = useMemo(() => searchProducts(products, query), [products, query]);
  const searchText = query.trim();
  const searching = searchText.length >= MIN_QUERY_LENGTH;
  const hits = searching ? search.items.slice(0, SEARCH_PREVIEW) : [];
  const seeAll = searching && search.total > 0;
  const optionCount = hits.length + (seeAll ? 1 : 0);
  const shown = open && (searching || tooShort);
  const expanded = shown && searching && optionCount > 0;
  const current = expanded && active < optionCount ? active : -1;

  let status = 'No matches';
  if (!searching) status = `Type at least ${MIN_QUERY_LENGTH} characters`;
  else if (search.related) status = 'No exact matches — related products';
  else if (search.total > SEARCH_PREVIEW) status = `Showing ${SEARCH_PREVIEW} of ${search.total} results`;
  else if (search.total) status = `${search.total} result${search.total > 1 ? 's' : ''}`;

  // The status element is always in the page, so screen readers announce
  // its first text too. It follows the panel once typing pauses, and empties
  // at once when the panel closes, so reopening announces the count again.
  const liveText = shown ? status : '';
  if (!liveText && announced) setAnnounced('');
  useEffect(() => {
    if (!liveText) return undefined;
    const timer = setTimeout(() => setAnnounced(liveText), STATUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [liveText]);

  const close = () => {
    setOpen(false);
    setActive(-1);
  };
  const openList = () => {
    if (!open) onOpen?.();
    setOpen(true);
  };

  // While open: a click outside, or Escape pressed elsewhere, closes it.
  useEffect(() => {
    if (!open) return undefined;
    const inside = (target) => target instanceof Node && !!formRef.current?.contains(target);
    const shut = () => {
      setOpen(false);
      setActive(-1);
    };
    const onClick = (e) => { if (!inside(e.target)) shut(); };
    const onKey = (e) => { if (e.key === 'Escape' && !inside(e.target)) shut(); };
    document.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!revealActive.current || current < 0) return;
    revealActive.current = false;
    document.getElementById(optionId(current))?.scrollIntoView?.({ block: 'nearest' });
  }, [current]);

  const moveTo = (index) => {
    revealActive.current = true;
    setActive(index);
  };

  const onKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (expanded) moveTo((current + 1) % optionCount);
        else if (searching) openList();
        break;
      case 'ArrowUp':
        if (!expanded) break;
        e.preventDefault();
        moveTo(current <= 0 ? optionCount - 1 : current - 1);
        break;
      case 'Home':
      case 'End':
        if (current < 0) break;
        e.preventDefault();
        moveTo(e.key === 'Home' ? 0 : optionCount - 1);
        break;
      case 'Enter':
        // With no option active the form submits (submit below).
        if (current < 0) break;
        e.preventDefault();
        document.getElementById(optionId(current))?.click();
        break;
      case 'Escape':
        // Also stops the browser's own clearing of a search box.
        e.preventDefault();
        if (shown) close();
        else {
          setQuery('');
          setTooShort(false);
        }
        break;
      default:
    }
  };

  // Focus moving to another control outside the form closes the list.
  const onBlur = (e) => {
    const next = e.relatedTarget;
    if (next && !formRef.current?.contains(next)) close();
  };

  // Enter with no option active, or the magnifier: every result, text kept.
  const submit = (e) => {
    e.preventDefault();
    if (!searching) {
      setTooShort(true);
      openList();
      return;
    }
    close();
    navigate({ page: 'search', q: searchText });
  };
  const pickProduct = () => {
    setQuery('');
    close();
  };
  const clear = () => {
    setQuery('');
    setTooShort(false);
    close();
    inputRef.current?.focus();
  };

  return (
    <form className="aw-search" role="search" ref={formRef} onSubmit={submit} onBlur={onBlur}>
      <input ref={inputRef} type="search" value={query} placeholder="Search products, brands or SKUs"
             autoComplete="off" role="combobox" aria-label="Search products" aria-autocomplete="list"
             aria-expanded={expanded} aria-controls={expanded ? LIST_ID : undefined}
             aria-activedescendant={current >= 0 ? optionId(current) : undefined}
             onChange={(e) => { setQuery(e.target.value); setTooShort(false); setActive(-1); openList(); }}
             onFocus={() => {
               if (isMobile && !headerStuck(formRef.current)) formRef.current?.scrollIntoView?.({ block: 'start' });
               if (searching) openList();
             }}
             onKeyDown={onKeyDown} />
      <button type="submit" aria-label="Search"><Icon name="search" /></button>
      <p className="sr-only" role="status">{announced}</p>
      {shown && (
        <div className="aw-search-results">
          <div className="aw-search-heading">
            <p>{status}</p>
            <button className="icon-btn" type="button" tabIndex={-1} aria-label="Clear search" onMouseDown={keepFocus} onClick={clear}><Icon name="close" /></button>
          </div>
          {searching && (optionCount > 0 ? (
            <div className="aw-search-list" role="listbox" id={LIST_ID} aria-label="Products">
              {hits.map((p, i) => (
                <Link key={p.id} to={{ page: 'product', productId: p.id }} role="option" id={optionId(i)} aria-selected={i === current} tabIndex={-1}
                      onMouseDown={keepFocus} onClick={pickProduct}>
                  <span className="sr-thumb"><Thumb src={p.img} /></span>
                  <span><strong>{p.name}</strong><small><TextParts parts={[catLabel(p.cat), p.sub, p.sku]} code={p.sku} /></small></span>
                </Link>
              ))}
              {seeAll && (
                <Link className="aw-search-all" to={{ page: 'search', q: searchText }} role="option" id={optionId(hits.length)}
                      aria-selected={hits.length === current} tabIndex={-1}
                      onMouseDown={keepFocus} onClick={close}>
                  {search.total === 1 ? `See 1 result for “${searchText}”` : `See all ${search.total} results for “${searchText}”`}
                </Link>
              )}
            </div>
          ) : (
            <div className="aw-search-list">
              <p>Try a brand (Geek Bar, Backwoods, BIC) or a line (&quot;energy drinks&quot;, &quot;wraps&quot;).</p>
            </div>
          ))}
        </div>
      )}
    </form>
  );
}
