// The shared quantity control (AW-013): a typed whole number from 1 to
// 100,000 between − and +.
import { createRef, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuantityInput } from './QuantityInput.jsx';

// The shared live region writes its text a moment after it is asked to.
const spoken = () => {
  act(() => vi.advanceTimersByTime(200));
  return document.getElementById('aw-announcer')?.textContent ?? '';
};

// A parent that keeps the quantity, like the product page.
function Holder({ start = 1, onChange = () => {}, ...props }) {
  const [qty, setQty] = useState(start);
  return <QuantityInput value={qty} onChange={(n) => { setQty(n); onChange(n); }} label="Quantity" groupLabel="Quantity to add" {...props} />;
}

const box = () => screen.getByRole('textbox', { name: 'Quantity' });
const minus = () => screen.getByRole('button', { name: /Decrease quantity|Remove/ });
const plus = () => screen.getByRole('button', { name: 'Increase quantity' });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('QuantityInput', () => {
  it('is a labelled group of −, a numeric text box and +, with drawn icons', () => {
    render(<Holder className="card-stepper" />);
    const group = screen.getByRole('group', { name: 'Quantity to add' });
    expect(group.tagName).toBe('SPAN');
    expect(group.className).toBe('stepper card-stepper');
    const input = box();
    expect(input).toMatchObject({ type: 'text', inputMode: 'numeric', autocomplete: 'off', maxLength: 6, value: '1' });
    expect(input.getAttribute('pattern')).toBe('[0-9]*');
    expect(input.getAttribute('enterkeyhint')).toBe('done');
    expect(group.querySelectorAll('button > svg.icon')).toHaveLength(2);
    expect(group.querySelector('b')).toBeNull();
    expect(group.querySelector('[aria-live]')).toBeNull();
  });

  it('takes a typed quantity at once', () => {
    const onChange = vi.fn();
    render(<Holder onChange={onChange} />);
    fireEvent.focus(box());
    fireEvent.change(box(), { target: { value: '4' } });
    fireEvent.change(box(), { target: { value: '48' } });
    expect(onChange.mock.calls).toEqual([[4], [48]]);
    fireEvent.blur(box());
    expect(box().value).toBe('48');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('puts back the quantity after an empty or invalid entry, and says what it takes', () => {
    const onChange = vi.fn();
    render(<Holder start={12} onChange={onChange} />);
    for (const typed of ['', '0', '2.5', '1e3', '-1', 'abc']) {
      fireEvent.focus(box());
      fireEvent.change(box(), { target: { value: typed } });
      expect(box().value).toBe(typed);
      fireEvent.blur(box());
      expect(box().value, typed).toBe('12');
      expect(spoken()).toBe('Enter a whole number from 1 to 100,000.');
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  it('brings a number over 100,000 down to 100,000 on Enter, and says so', () => {
    const onChange = vi.fn();
    render(<Holder start={3} onChange={onChange} />);
    fireEvent.focus(box());
    fireEvent.change(box(), { target: { value: '150000' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(100000);
    expect(box().value).toBe('100000');
    expect(spoken()).toBe('The most per line is 100,000.');
    expect(plus().disabled).toBe(true);
  });

  it('steps by one, announces the new quantity, and stops at the ends', () => {
    const onChange = vi.fn();
    render(<Holder start={1} onChange={onChange} />);
    expect(minus().disabled).toBe(true);
    fireEvent.click(plus());
    expect(box().value).toBe('2');
    expect(spoken()).toBe('Quantity 2');
    fireEvent.click(minus());
    expect(box().value).toBe('1');
    expect(spoken()).toBe('Quantity 1');
    expect(onChange.mock.calls).toEqual([[2], [1]]);
    expect(minus().disabled).toBe(true);
  });

  it('removes the line from 1 when it can, under its own name', () => {
    const onRemove = vi.fn();
    const onChange = vi.fn();
    const view = render(<QuantityInput value={1} onChange={onChange} onRemove={onRemove} removeLabel="Remove Kite" label="Quantity" groupLabel="Kite quantity" />);
    const remove = screen.getByRole('button', { name: 'Remove Kite' });
    expect(remove.disabled).toBe(false);
    fireEvent.click(remove);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
    view.rerender(<QuantityInput value={2} onChange={onChange} onRemove={onRemove} removeLabel="Remove Kite" label="Quantity" groupLabel="Kite quantity" />);
    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity' }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('keeps focus when − reaches 1 or + reaches the most: it moves to the box (AW-042)', () => {
    const onChange = vi.fn();
    render(<Holder start={2} max={3} onChange={onChange} />);
    minus().focus();
    fireEvent.click(minus());
    expect(minus().disabled).toBe(true);
    expect(document.activeElement).toBe(box());
    // The box shows the new quantity, and leaving it changes nothing more.
    expect(box().value).toBe('1');
    fireEvent.blur(box());
    expect(onChange.mock.calls).toEqual([[1]]);
    expect(spoken()).toBe('Quantity 1');

    plus().focus();
    fireEvent.click(plus());
    expect(plus().disabled).toBe(false);
    expect(document.activeElement).toBe(plus());
    fireEvent.click(plus());
    expect(plus().disabled).toBe(true);
    expect(document.activeElement).toBe(box());
    expect(box().value).toBe('3');
    expect(onChange.mock.calls).toEqual([[1], [2], [3]]);
  });

  it('after a tap, keeps focus on the other button instead, so a phone’s keyboard stays shut', () => {
    render(<Holder start={2} />);
    minus().focus();
    fireEvent.pointerDown(minus(), { pointerType: 'touch' });
    fireEvent.click(minus(), { detail: 1 });
    expect(box().value).toBe('1');
    expect(document.activeElement).toBe(plus());
  });

  it('leaves focus alone when the button didn’t have it (Safari doesn’t focus a clicked button)', () => {
    render(<Holder start={2} />);
    fireEvent.click(minus(), { detail: 1 });
    expect(box().value).toBe('1');
    expect(document.activeElement).toBe(document.body);
  });

  it('names − and + after the line when given its name (NEW-086)', () => {
    const view = render(<QuantityInput value={2} onChange={() => {}} onRemove={() => {}} removeLabel="Remove Kite" label="Quantity of Kite" groupLabel="Kite quantity" itemName="Kite" />);
    const group = screen.getByRole('group', { name: 'Kite quantity' });
    expect([...group.querySelectorAll('button')].map((b) => b.getAttribute('aria-label')))
      .toEqual(['Decrease quantity of Kite', 'Increase quantity of Kite']);
    // At 1, − is the line's Remove, as before.
    view.rerender(<QuantityInput value={1} onChange={() => {}} onRemove={() => {}} removeLabel="Remove Kite" label="Quantity of Kite" groupLabel="Kite quantity" itemName="Kite" />);
    expect(screen.getByRole('button', { name: 'Remove Kite' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Increase quantity of Kite' })).toBeTruthy();
  });

  it('follows the quantity it is given while it doesn’t have focus', () => {
    const view = render(<QuantityInput value={3} onChange={() => {}} label="Quantity" groupLabel="Q" />);
    view.rerender(<QuantityInput value={7} onChange={() => {}} label="Quantity" groupLabel="Q" />);
    expect(box().value).toBe('7');
  });

  it('can be disabled, and hands its ref to the input', () => {
    const ref = createRef();
    render(<QuantityInput ref={ref} value={5} onChange={() => {}} label="Quantity" groupLabel="Q" disabled />);
    expect(ref.current).toBe(box());
    expect([box(), minus(), plus()].every((el) => el.disabled)).toBe(true);
  });
});
