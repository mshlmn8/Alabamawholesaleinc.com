import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STORAGE } from '../data/content.js';
import { clearAgeConfirmation, confirmAge, declineAge, reconsiderAge, useAgeGate } from '../lib/ageGate.js';
import { AgeGate } from './AgeGate.jsx';
import { ModalLayer } from './ModalLayer.jsx';

// The same wiring as App: the page stays rendered and the gate is a layer
// over it with no onClose and no history entry. (jsdom has no layout, so
// the Tab trap is covered by the Playwright smoke test instead.)
function Site() {
  const age = useAgeGate();
  return (
    <>
      <main><h1>Tobacco</h1><a href="/category/tobacco/cigarettes">Cigarettes</a></main>
      {!age.confirmed && (
        <ModalLayer className="age-gate-layer" historyEntry={false}>
          <AgeGate declined={age.declined} onYes={confirmAge} onNo={declineAge} onBack={reconsiderAge} />
        </ModalLayer>
      )}
    </>
  );
}

let root;
function newRoot() {
  root = document.createElement('div');
  root.id = 'root';
  document.body.appendChild(root);
}
beforeEach(() => {
  clearAgeConfirmation();
  reconsiderAge();
  window.localStorage.clear();
  window.sessionStorage.clear();
  newRoot();
});
afterEach(() => {
  root.remove();
});

const renderSite = () => render(<Site />, { container: root });

describe('AgeGate', () => {
  it('covers the page without replacing it, with focus on "Yes" (AW-044, AW-176)', () => {
    renderSite();
    const gate = screen.getByRole('dialog', { name: 'Are you 21 or older?' });
    expect(gate.getAttribute('aria-modal')).toBe('true');
    expect(gate.getAttribute('aria-describedby')).toBe('age-gate-text');
    expect(document.getElementById('age-gate-text').textContent).toMatch(/licensed retail businesses only/);
    // The page is still in the document, but inert and hidden from assistive technology.
    expect(root.querySelector('main h1').textContent).toBe('Tobacco');
    expect(root.hasAttribute('inert')).toBe(true);
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Yes, I am 21\+/ }));
  });

  it('stays open on Escape', () => {
    renderSite();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Are you 21 or older?' })).toBeTruthy();
  });

  it('"Yes" stores the confirmation and reveals the page', () => {
    renderSite();
    fireEvent.click(screen.getByRole('button', { name: /Yes, I am 21\+/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(root.hasAttribute('inert')).toBe(false);
    expect(JSON.parse(window.localStorage.getItem(STORAGE.age))).toMatchObject({ ok: true });
  });

  it('"No, exit" shows a labelled exit screen that can be taken back', () => {
    const { unmount } = renderSite();
    fireEvent.click(screen.getByRole('button', { name: 'No, exit' }));
    const heading = screen.getByRole('heading', { name: 'Sorry, you must be 21 or older to enter' });
    expect(screen.getByRole('dialog', { name: 'Sorry, you must be 21 or older to enter' })).toBeTruthy();
    expect(document.activeElement).toBe(heading);
    expect(document.getElementById('age-gate-text').textContent).toMatch(/only open to visitors 21 or older/);
    expect(heading.textContent).not.toMatch(/—\s*$/);

    // A reload in the same session keeps the exit screen.
    unmount();
    root.remove();
    newRoot();
    renderSite();
    expect(screen.getByRole('dialog', { name: 'Sorry, you must be 21 or older to enter' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Answered by mistake? Go back' }));
    expect(screen.getByRole('dialog', { name: 'Are you 21 or older?' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Yes, I am 21\+/ }));
    expect(window.sessionStorage.getItem(STORAGE.ageDeclined)).toBeNull();
  });

  it('opens nothing for a visitor who already confirmed', () => {
    confirmAge();
    renderSite();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(root.hasAttribute('inert')).toBe(false);
  });
});
