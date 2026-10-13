// The printed letterhead (AW-148): the company's name, phone and email from
// COMPANY, each value in its own element (translate-safe). The print
// stylesheet shows it; on screen it is display: none (styles.test.js).
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { COMPANY } from '../data/content.js';
import { PrintLetterhead } from './PrintLetterhead.jsx';

describe('PrintLetterhead', () => {
  it('names the company with its phone and email, and holds no link or control', () => {
    const { container } = render(<PrintLetterhead />);
    const head = container.firstElementChild;
    expect(head.className).toBe('print-letterhead container');
    expect(head.querySelector('strong').textContent).toBe(COMPANY.name);
    expect(head.querySelector('span').textContent).toBe(`${COMPANY.phone} · ${COMPANY.email}`);
    expect(head.querySelector('a, button, input')).toBeNull();
  });
});
