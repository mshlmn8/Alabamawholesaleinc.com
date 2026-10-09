// ConfirmDialog: focus starts on cancel, Escape cancels, focus goes back to
// the opener, and a required reason is checked before onConfirm.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog.jsx';

afterEach(() => vi.restoreAllMocks());

function Opener({ onConfirm, reason = false }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Cancel order</button>
      {open && (
        <ConfirmDialog
          title="Cancel this order?" body="The customer is not told automatically." confirmLabel="Cancel order" cancelLabel="Keep order"
          reasonLabel={reason ? 'Reason' : null} reasonHint={reason ? 'Staff see this in the order history.' : null}
          onConfirm={(text) => { onConfirm(text); setOpen(false); }} onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}

describe('ConfirmDialog', () => {
  it('starts on the cancel button, cancels on Escape and hands focus back', () => {
    vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const onConfirm = vi.fn();
    render(<Opener onConfirm={onConfirm} />);
    const opener = screen.getByRole('button', { name: 'Cancel order' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('alertdialog', { name: 'Cancel this order?' });
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.getElementById(dialog.getAttribute('aria-describedby')).textContent).toBe('The customer is not told automatically.');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Keep order' }));
    act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);
  });

  it('requires the reason when it asks for one', () => {
    vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const onConfirm = vi.fn();
    render(<Opener onConfirm={onConfirm} reason />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel order' }));
    const dialog = screen.getByRole('alertdialog');
    const box = screen.getByLabelText('Reason');
    fireEvent.click(dialog.querySelector('.button:not(.ghost)'));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(box.getAttribute('aria-invalid')).toBe('true');
    const described = box.getAttribute('aria-describedby').split(' ').map((id) => document.getElementById(id).textContent);
    expect(described).toEqual(['Staff see this in the order history.', 'Enter a reason to continue.']);
    expect(document.activeElement).toBe(box);
    fireEvent.change(box, { target: { value: '  Duplicate order  ' } });
    expect(box.getAttribute('aria-invalid')).toBeNull();
    fireEvent.click(dialog.querySelector('.button:not(.ghost)'));
    expect(onConfirm).toHaveBeenCalledWith('Duplicate order');
  });
});
