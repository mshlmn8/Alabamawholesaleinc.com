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
//
// The ref goes to the input, so a caller can move focus to it (a cart line
// that was re-keyed, src/lib/focus.js).

import { forwardRef, useState } from 'react';
import { announce } from '../lib/announce.js';
import { MAX_QTY, MIN_QTY, maxPerLineText, qtyRangeText, readQty } from '../lib/quantity.js';
import { Icon } from './Icon.jsx';

export const QuantityInput = forwardRef(function QuantityInput({
  value, onChange, min = MIN_QTY, max = MAX_QTY, label, groupLabel, className = '', onRemove, removeLabel, disabled = false, id,
}, ref) {
  const current = Number(value) || 0;
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

  const step = (delta) => {
    const n = Math.min(max, Math.max(min, current + delta));
    if (n === current) return;
    onChange(n);
    announce(`Quantity ${n}`);
  };

  const atMin = current <= min;
  const removes = atMin && typeof onRemove === 'function';
  return (
    <span className={['stepper', className].filter(Boolean).join(' ')} role="group" aria-label={groupLabel}>
      <button type="button" onClick={removes ? onRemove : () => step(-1)} disabled={disabled || (atMin && !removes)}
              aria-label={removes ? removeLabel : 'Decrease quantity'}><Icon name="minus" /></button>
      <input ref={ref} id={id} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" enterKeyHint="done" maxLength={6}
             aria-label={label} value={shown} disabled={disabled}
             onFocus={() => { setDraft(String(current)); setFocused(true); }}
             onChange={type}
             onBlur={() => { commit(); setFocused(false); }}
             onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit(); } }} />
      <button type="button" onClick={() => step(1)} disabled={disabled || current >= max}
              aria-label="Increase quantity"><Icon name="plus" /></button>
    </span>
  );
});
