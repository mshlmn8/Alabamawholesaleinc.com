// The one quantity control (AW-013): − [typed number] +, used on the product
// page, the product cards and every cart line. Quantities are whole numbers
// from `min` to `max` (src/lib/quantity.js: 1 to 100,000, the database's
// limit), so a buyer ordering 48 cases types 48 instead of pressing + 47
// times.
//
// - Typing a valid number takes effect at once (onChange(n)). Anything else
//   waits: on blur or Enter an empty or invalid entry goes back to the
//   current quantity, a number over `max` becomes `max`, and either is
//   announced through the shared live region.
// - − stops at `min`, unless onRemove is given: then at `min` it removes
//   the line and is named removeLabel. + stops at `max`.
// - A step is announced ("Quantity 12"); the count itself is a plain input,
//   not a live region.
// - A button that reaches its end of the range is disabled (the design
//   system's :disabled), and a disabled button loses focus to <body>
//   (AW-042: the product page, the checkout lines, and out of the cart
//   drawer's dialog). So when the step that reaches `min` (with no
//   onRemove) or `max` is made from the focused button, focus moves to the
//   quantity box first, in the same click. After a tap (touch or pen) it
//   moves to the other button instead: focusing the box would open the
//   phone's keyboard.
// - itemName (NEW-086) names the buttons after the line, "Decrease quantity
//   of Kite cigarette tobacco", so a list of buttons tells the lines apart.
//   Without it (the product page, which has one stepper) they are
//   "Decrease quantity" and "Increase quantity".
//
// The ref goes to the input, so a caller can move focus to it (a cart line
// that was re-keyed, src/lib/focus.js).

import { forwardRef, useCallback, useRef, useState } from 'react';
import { announce } from '../lib/announce.js';
import { MAX_QTY, MIN_QTY, maxPerLineText, qtyRangeText, readQty } from '../lib/quantity.js';
import { Icon } from './Icon.jsx';

export const QuantityInput = forwardRef(function QuantityInput({
  value, onChange, min = MIN_QTY, max = MAX_QTY, label, groupLabel, className = '', onRemove, removeLabel, disabled = false, id, itemName = '',
}, ref) {
  const current = Number(value) || 0;
  // The input, for the focus move below, and for the caller's ref.
  const inputRef = useRef(null);
  const setInput = useCallback((node) => {
    inputRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }, [ref]);
  // What is in the box while it has focus; otherwise it shows `value`.
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const shown = focused ? draft : String(current);

  const type = (event) => {
    const text = event.target.value;
    setDraft(text);
    const { qty } = readQty(text);
    if (qty != null && qty >= min && qty <= max && qty !== current) onChange(qty);
  };

  // Blur or Enter: settle what was typed.
  const commit = () => {
    const { qty, problem } = readQty(draft);
    if (problem === 'too-large' || (qty != null && qty > max)) {
      setDraft(String(max));
      if (max !== current) onChange(max);
      announce(maxPerLineText(max));
      return;
    }
    if (qty == null || qty < min) {
      setDraft(String(current));
      announce(`Enter ${qtyRangeText(min, max)}.`);
      return;
    }
    setDraft(String(qty));
    if (qty !== current) onChange(qty);
  };

  // How a button was last pressed: a pointer type, or '' (a key press is a
  // click with detail 0).
  const pressedWith = useRef('');
  const pressed = (event) => { pressedWith.current = event.pointerType || ''; };
  const removable = typeof onRemove === 'function';
  const step = (delta, event) => {
    const n = Math.min(max, Math.max(min, current + delta));
    if (n === current) return;
    // This button is about to be disabled (AW-042): focus goes to the box,
    // showing the new quantity, before it would drop to <body>.
    const button = event?.currentTarget;
    const lastStep = n >= max || (n <= min && !removable);
    if (lastStep && button && document.activeElement === button) {
      const tapped = event.detail > 0 && (pressedWith.current === 'touch' || pressedWith.current === 'pen');
      const other = [...button.parentElement.querySelectorAll('button')].find((b) => b !== button && !b.disabled);
      if (tapped && other) {
        other.focus();
      } else if (inputRef.current) {
        inputRef.current.focus();
        setDraft(String(n));
      }
    }
    onChange(n);
    announce(`Quantity ${n}`);
  };

  const atMin = current <= min;
  const removes = atMin && removable;
  const named = (action) => (itemName ? `${action} of ${itemName}` : action);
  return (
    <span className={['stepper', className].filter(Boolean).join(' ')} role="group" aria-label={groupLabel}>
      <button type="button" onClick={removes ? onRemove : (event) => step(-1, event)} onPointerDown={pressed} disabled={disabled || (atMin && !removes)}
              aria-label={removes ? removeLabel : named('Decrease quantity')}><Icon name="minus" /></button>
      <input ref={setInput} id={id} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" enterKeyHint="done" maxLength={6}
             aria-label={label} value={shown} disabled={disabled}
             onFocus={() => { setDraft(String(current)); setFocused(true); }}
             onChange={type}
             onBlur={() => { commit(); setFocused(false); }}
             onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit(); } }} />
      <button type="button" onClick={(event) => step(1, event)} onPointerDown={pressed} disabled={disabled || current >= max}
              aria-label={named('Increase quantity')}><Icon name="plus" /></button>
    </span>
  );
});
