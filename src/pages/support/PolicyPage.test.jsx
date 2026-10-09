// A policy page ends with its date, not a second "call or email" sentence:
// the contact strip right below has the phone and email (AW-276).
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { COMPANY, POLICIES_UPDATED } from '../../data/content.js';
import { PolicyPage } from './PolicyPage.jsx';

const endNotes = () => [...document.querySelectorAll('.policy-body > .support-note')];

describe('PolicyPage ending (AW-276)', () => {
  it.each(['shipping', 'privacy', 'terms'])('has no "Questions about this policy?" on %s, and the contact strip follows', (kind) => {
    const { container } = render(<PolicyPage kind={kind} />);
    expect(container.textContent).not.toMatch(/Questions about this policy\?/);
    const strip = container.querySelector('.contact-strip');
    expect(strip.querySelector(`a[href="tel:${COMPANY.phoneRaw}"]`)).toBeTruthy();
    expect(strip.querySelector(`a[href="mailto:${COMPANY.email}"]`)).toBeTruthy();
  });

  it.each(['privacy', 'terms'])('ends %s with the date it was last updated, alone in its note', (kind) => {
    render(<PolicyPage kind={kind} />);
    const notes = endNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0].textContent).toBe(`Last updated ${POLICIES_UPDATED}.`);
    expect(notes[0].children).toHaveLength(0);
  });

  it('prints no date on the delivery policy, which has none', () => {
    render(<PolicyPage kind="shipping" />);
    expect(endNotes()).toHaveLength(0);
    expect(screen.queryByText(/^Last updated/)).toBeNull();
  });

  it('keeps the privacy policy\'s own "Contact the trade desk" section as published', () => {
    render(<PolicyPage kind="privacy" />);
    const heading = screen.getByRole('heading', { level: 2, name: 'Contact the trade desk' });
    expect(heading.parentElement.textContent).toBe(`Contact the trade deskQuestions about what we collect: call ${COMPANY.phone} or email ${COMPANY.email}.`);
  });
});
