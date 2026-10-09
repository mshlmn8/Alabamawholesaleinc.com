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

  // AW-249: Menu -> Help -> 'Apply for an account' -> Escape. The menu and
  // the Help dialog close as the next layer opens, so their buttons are gone
  // by the time the last layer closes.
  function Chain({ dropMenuButton = false, keepMenu = false }) {
    const [menu, setMenu] = useState(false);
    const [help, setHelp] = useState(false);
    const [apply, setApply] = useState(false);
    const [menuButton, setMenuButton] = useState(true);
    const [helpUsed, setHelpUsed] = useState(false);
    return (
      <>
        <main><h1>Page title</h1></main>
        {menuButton && <button type="button" onClick={() => setMenu(true)}>Menu</button>}
        {menu && (
          <ModalLayer onClose={() => setMenu(false)}>
            <div role="dialog" aria-label="Menu">
              {/* keepMenu: Help opens over the menu, which stays open
                  without its Help button. */}
              {!helpUsed && <button type="button" onClick={() => { if (keepMenu) setHelpUsed(true); else setMenu(false); setHelp(true); }}>Help</button>}
              <a href="#top">Menu link</a>
            </div>
          </ModalLayer>
        )}
        {help && (
          <ModalLayer onClose={() => setHelp(false)}>
            <div role="dialog" aria-label="Help">
              <button type="button" onClick={() => { setHelp(false); setApply(true); if (dropMenuButton) setMenuButton(false); }}>Apply</button>
            </div>
          </ModalLayer>
        )}
        {apply && (
          <ModalLayer onClose={() => setApply(false)}>
            <div role="dialog" aria-label="Apply"><input aria-label="Email" data-autofocus /></div>
          </ModalLayer>
        )}
      </>
    );
  }
  // jsdom does not focus a clicked button, so focus it first as a browser would.
  const press = (name) => {
    const button = screen.getByRole('button', { name });
    button.focus();
    fireEvent.click(button);
  };
  const openChain = () => {
    press('Menu');
    press('Help');
    press('Apply');
    expect(document.activeElement).toBe(screen.getByLabelText('Email'));
    expect(screen.queryByRole('button', { name: 'Help' })).toBeNull();
  };

  it('hands focus back along the chain of openers to the first one still on the page (AW-249)', () => {
    render(<Chain />);
    openChain();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Menu' }));
  });

  it('focuses the page heading when no opener is left, not <body> (AW-249)', () => {
    render(<Chain dropMenuButton />);
    openChain();
    expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Page title' }));
  });

  it('prefers the phone menu button when it shows and no opener is left (AW-249)', () => {
    const toggle = document.createElement('button');
    toggle.className = 'aw-menu-toggle';
    document.body.appendChild(toggle);
    // jsdom has no layout: report a box, as a shown button has.
    toggle.getClientRects = () => [{ width: 44, height: 44 }];
    render(<Chain dropMenuButton />);
    openChain();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(toggle);
    toggle.remove();
  });

  it('keeps focus inside a layer that stays open when its openers are gone', () => {
    render(<Chain keepMenu dropMenuButton />);
    openChain();
    // The Help dialog closed on Apply; the menu under it is still open.
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Apply' })).toBeNull();
    const menuLayer = screen.getByRole('dialog', { name: 'Menu' }).closest('.aw-layer');
    expect(menuLayer.contains(document.activeElement)).toBe(true);
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
