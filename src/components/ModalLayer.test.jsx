import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

// AW-333: a classic scrollbar disappears while a layer holds the page still,
// so the body takes its width as padding, and gives it back on close.
describe('ModalLayer scrollbar compensation (AW-333)', () => {
  const html = document.documentElement;
  const stubWidths = (inner, client) => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(inner);
    vi.spyOn(html, 'clientWidth', 'get').mockReturnValue(client);
  };
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.style.paddingRight = '';
  });

  function Stacked() {
    const [first, setFirst] = useState(false);
    const [second, setSecond] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setFirst(true)}>Open first</button>
        {first && (
          <ModalLayer onClose={() => setFirst(false)}>
            <div role="dialog" aria-label="First">
              <button type="button" onClick={() => setSecond(true)}>Open second</button>
              <button type="button" onClick={() => setFirst(false)}>Close first</button>
            </div>
          </ModalLayer>
        )}
        {second && (
          <ModalLayer onClose={() => setSecond(false)}>
            <div role="dialog" aria-label="Second"><button type="button" onClick={() => setSecond(false)}>Close second</button></div>
          </ModalLayer>
        )}
      </>
    );
  }

  it('pads the body by the scrollbar’s width while open, measured once, and puts the old padding back', () => {
    document.body.style.paddingRight = '3px';
    stubWidths(1440, 1425);
    render(<Stacked />);
    fireEvent.click(screen.getByText('Open first'));
    expect(document.body.style.paddingRight).toBe('15px');
    expect(document.body.style.overflow).toBe('hidden');
    // The page has no scrollbar any more: a stacked layer must not re-measure.
    stubWidths(1440, 1440);
    fireEvent.click(screen.getByText('Open second'));
    expect(document.body.style.paddingRight).toBe('15px');
    fireEvent.click(screen.getByText('Close second'));
    expect(document.body.style.paddingRight).toBe('15px');
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(screen.getByText('Close first'));
    expect(document.body.style.paddingRight).toBe('3px');
    expect(document.body.style.overflow).toBe('');
  });

  it('adds no padding for overlay scrollbars, or where nothing is laid out (jsdom’s clientWidth 0)', () => {
    stubWidths(1440, 1440);
    const { unmount } = render(<Stacked />);
    fireEvent.click(screen.getByText('Open first'));
    expect(document.body.style.paddingRight).toBe('');
    fireEvent.click(screen.getByText('Close first'));
    unmount();
    stubWidths(1024, 0);
    render(<Stacked />);
    fireEvent.click(screen.getByText('Open first'));
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.paddingRight).toBe('');
    fireEvent.click(screen.getByText('Close first'));
    expect(document.body.style.overflow).toBe('');
  });
});
