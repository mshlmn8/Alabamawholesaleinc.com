import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ModalLayer } from './ModalLayer.jsx';

function Harness({ onClose }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('first');
  const close = () => { onClose(label); setOpen(false); };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open</button>
      {open && (
        <ModalLayer onClose={close}>
          <div role="dialog" aria-label="Test dialog">
            <input aria-label="Field" data-autofocus />
            <button type="button" onClick={() => setLabel('second')}>Rename</button>
          </div>
        </ModalLayer>
      )}
    </>
  );
}

describe('ModalLayer', () => {
  it('focuses the data-autofocus field and makes the page root inert while open', () => {
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
    render(<Harness onClose={() => {}} />, { container: root });
    fireEvent.click(screen.getByText('Open'));
    expect(document.activeElement).toBe(screen.getByLabelText('Field'));
    expect(root.hasAttribute('inert')).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(root.hasAttribute('inert')).toBe(false);
    expect(document.body.style.overflow).toBe('');
    root.remove();
  });

  it('Escape calls the latest onClose and focus returns to the opener', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByText('Open');
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(screen.getByText('Rename'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledWith('second');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
