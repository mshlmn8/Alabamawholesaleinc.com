// The inline SVG icon set (AW-293).
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon, ICON_NAMES } from './Icon.jsx';

describe('Icon', () => {
  it('is hidden from assistive technology and never takes focus', () => {
    const { container } = render(<Icon name="close" />);
    const svg = container.querySelector('svg');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.getAttribute('class')).toBe('icon');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    // Sized by the text around it, drawn in its colour.
    expect(svg.getAttribute('width')).toBe('1em');
    expect(svg.getAttribute('height')).toBe('1em');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.getAttribute('fill')).toBe('none');
  });

  it('draws a path for every known name', () => {
    expect(ICON_NAMES).toEqual(expect.arrayContaining(['external', 'chevron-down', 'chevron-left', 'chevron-right', 'close', 'minus', 'plus', 'check', 'search', 'menu', 'filter', 'grid', 'help', 'alert', 'pause', 'play', 'truck', 'calendar', 'shield', 'arrow-up']));
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} />);
      const d = container.querySelector('svg > path')?.getAttribute('d');
      expect(d, name).toMatch(/^M[\d.]/);
      unmount();
    }
  });

  it('adds its own class to the icon class', () => {
    const { container } = render(<Icon name="chevron-down" className="aw-chevron" />);
    expect(container.querySelector('svg').getAttribute('class')).toBe('icon aw-chevron');
  });

  it('renders nothing for an unknown name', () => {
    const { container } = render(<Icon name="nope" />);
    expect(container.innerHTML).toBe('');
  });

  it('contains no text, so no font draws it', () => {
    const { container } = render(<><Icon name="external" /><Icon name="check" /></>);
    expect(container.textContent).toBe('');
  });
});
