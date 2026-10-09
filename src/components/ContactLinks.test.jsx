// EmailText offers one line break, after the '@' (AW-120).
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { COMPANY } from '../data/content.js';
import { EmailText } from './ContactLinks.jsx';

const parts = (container) => [...container.firstElementChild.childNodes].map((n) => (n.nodeName === 'WBR' ? '<wbr>' : n.textContent));

describe('EmailText', () => {
  it('splits the trade desk email after the @, with nothing added to the text', () => {
    const { container } = render(<EmailText />);
    expect(container.textContent).toBe(COMPANY.email);
    const at = COMPANY.email.indexOf('@');
    expect(parts(container)).toEqual([COMPANY.email.slice(0, at + 1), '<wbr>', COMPANY.email.slice(at + 1)]);
  });

  it('takes another address, and leaves one without an @ whole', () => {
    expect(parts(render(<EmailText address="orders@example.test" />).container)).toEqual(['orders@', '<wbr>', 'example.test']);
    const { container } = render(<EmailText address="trade desk" />);
    expect(container.innerHTML).toBe('<span>trade desk</span>');
  });
});
