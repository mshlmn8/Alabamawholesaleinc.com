// A policy page ends with its date, not a second "call or email" sentence:
// the contact strip right below has the phone and email (AW-276).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  COMPANY, DELIVERY_POLICY_UPDATED_ON, POLICIES_UPDATED, POLICIES_UPDATED_ON, STORAGE, policyDateLabel,
} from '../../data/content.js';
import { AUTH_STORAGE_KEY } from '../../lib/supabase.js';
import { SCROLL_STORE } from '../../lib/router.js';
import { CHUNK_RELOAD_KEY } from '../../lib/chunks.js';
import { AGE_CONFIRMATION_DAYS } from '../../lib/ageGate.js';
import { resetSiteSettingsForTests, showSiteSettings } from '../../lib/siteSettings.js';
import { parseCsp, readNetlifyHeaders } from '../../../scripts/netlify-headers.mjs';
import { POLICY_INTROS, PolicyPage } from './PolicyPage.jsx';

const endNotes = () => [...document.querySelectorAll('.policy-body > .support-note')];
const section = (name) => screen.getByRole('heading', { level: 2, name }).parentElement;
const plain = (text) => text.replace(/\s+/g, ' ').trim();

beforeEach(() => resetSiteSettingsForTests({ client: null }));
afterEach(() => resetSiteSettingsForTests({ client: null }));

describe('PolicyPage ending (AW-276, AW-277)', () => {
  it.each(['shipping', 'privacy', 'terms'])('has no "Questions about this policy?" on %s, and the contact strip follows', (kind) => {
    const { container } = render(<PolicyPage kind={kind} />);
    expect(container.textContent).not.toMatch(/Questions about this policy\?/);
    const strip = container.querySelector('.contact-strip');
    expect(strip.querySelector(`a[href="tel:${COMPANY.phoneRaw}"]`)).toBeTruthy();
    expect(strip.querySelector(`a[href="mailto:${COMPANY.email}"]`)).toBeTruthy();
  });

  // The Privacy policy and Trade terms print the day they last changed, the
  // version an application records (TERMS_VERSION); the Delivery policy
  // keeps its own month (AW-130). Each date is a <time> with its ISO value.
  it.each([
    ['privacy', POLICIES_UPDATED_ON],
    ['terms', POLICIES_UPDATED_ON],
    ['shipping', DELIVERY_POLICY_UPDATED_ON],
  ])('ends %s with the date it was last updated, alone in its note', (kind, on) => {
    render(<PolicyPage kind={kind} />);
    const notes = endNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0].textContent).toBe(`Last updated ${policyDateLabel(on)}.`);
    const time = notes[0].querySelector('time');
    expect(notes[0].children).toHaveLength(1);
    expect(time.getAttribute('datetime')).toBe(on);
    expect(time.textContent).toBe(policyDateLabel(on));
  });

  it('dates the Privacy policy and Trade terms by the day, and the Delivery policy September 2026 as before', () => {
    expect(POLICIES_UPDATED).toMatch(/^[A-Z][a-z]+ \d{1,2}, \d{4}$/);
    expect(policyDateLabel(DELIVERY_POLICY_UPDATED_ON)).toBe('September 2026');
  });
});

// AW-027 (owner answer 2026-10): a plain-language privacy policy that says
// what this site does, with no owner questions left in it.
describe('Privacy policy (AW-027)', () => {
  it('has these sections, in this order', () => {
    render(<PolicyPage kind="privacy" />);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent).slice(0, 9)).toEqual([
      'What we collect', 'Why we collect it', 'Who handles it for us', 'Who can see it', 'In your browser',
      'How long we keep it', 'How we protect it', 'Get a copy, a correction or deletion', 'Changes to this policy',
    ]);
  });

  it('says in its intro what the page covers, short enough for the meta description', () => {
    expect(POLICY_INTROS.privacy).toMatch(/copy, a correction or deletion\.$/);
    expect(POLICY_INTROS.privacy.length).toBeLessThanOrEqual(155);
  });

  it('names what an application, the license files, the account and an order collect', () => {
    render(<PolicyPage kind="privacy" />);
    const text = plain(section('What we collect').textContent);
    for (const item of [
      'business email address and a password', 'federal EIN', 'state retail tobacco license number',
      'resale certificate number', 'store’s street address', 'resale certificate files you upload',
      'which version', '21 or older', 'pending approval, approved or on hold', 'notes our staff add',
      'delivery address', 'the items and quantities', 'saved with your account', 'No prices',
    ]) expect(text).toContain(item);
  });

  it('keeps records for as long as the owner said, in the owner’s words', () => {
    render(<PolicyPage kind="privacy" />);
    expect(plain(section('How long we keep it').textContent))
      .toContain('while your account is active and as long as needed for tax and licensing records');
  });

  it('says license documents are seen only by the account holder and the trade desk', () => {
    render(<PolicyPage kind="privacy" />);
    const text = plain(section('Who can see it').textContent);
    expect(text).toContain('You, when you are signed in: your account, license documents and order history.');
    expect(text).toContain('the owner and staff accounts in our admin area see applications, license documents');
    expect(text).toContain('private storage, never at a public web address');
  });

  it('names the services that handle the information: Supabase, Netlify and the Gmail inbox', () => {
    render(<PolicyPage kind="privacy" />);
    const items = [...section('Who handles it for us').querySelectorAll('li')].map((li) => li.textContent.split(':')[0]);
    expect(items).toEqual(['Supabase', 'Netlify', 'Gmail (Google)']);
    expect(section('Who handles it for us').textContent).toContain('no ads, analytics or tracking tools');
  });

  // A host added to the Content-Security-Policy (a script, an API, an image
  // CDN) is a new service handling visitors' information: the policy has to
  // name it in the same change (AW-210, netlify.toml).
  it('names the service behind every off-site host the Content-Security-Policy allows', () => {
    const toml = readFileSync(resolve(process.cwd(), 'netlify.toml'), 'utf8');
    const csp = parseCsp(readNetlifyHeaders(toml).find((r) => r.for === '/*').values['Content-Security-Policy']);
    const hosts = new Set([...csp.values()].flat().filter((s) => /^(https?|wss?):/i.test(s)).map((s) => s.replace(/^\w+:\/\//, '')));
    const SERVICE_OF = { '*.supabase.co': 'Supabase' };
    expect([...hosts].filter((h) => !SERVICE_OF[h])).toEqual([]);
    render(<PolicyPage kind="privacy" />);
    const handlers = section('Who handles it for us').textContent;
    for (const host of hosts) expect(handlers).toContain(`${SERVICE_OF[host]}:`);
  });

  it('names every key the site keeps in the browser, and how long the 21+ answer lasts', () => {
    render(<PolicyPage kind="privacy" />);
    const keys = [...section('In your browser').querySelectorAll('code')].map((c) => c.textContent);
    for (const key of [AUTH_STORAGE_KEY, `${AUTH_STORAGE_KEY}-`, STORAGE.age, STORAGE.ageDeclined, `${STORAGE.cart}:…`,
      `${STORAGE.cartLegacy}:…`, STORAGE.receipt, STORAGE.quoteDraft, SCROLL_STORE, CHUNK_RELOAD_KEY]) {
      expect(keys).toContain(key);
    }
    expect(Object.values(STORAGE).every((key) => keys.some((k) => k.startsWith(key)))).toBe(true);
    expect(section('In your browser').textContent).toContain(`It lasts ${AGE_CONFIRMATION_DAYS} days, and signing out removes it.`);
  });

  it('asks for a copy, a correction or deletion by the phone and email staff set in Site settings', () => {
    render(<PolicyPage kind="privacy" />);
    const ask = section('Get a copy, a correction or deletion');
    expect(plain(ask.querySelector('p').textContent))
      .toBe(`To get a copy of the information we hold about you, have it corrected, or have it deleted, call ${COMPANY.phone} or email ${COMPANY.email}.`);
    act(() => showSiteSettings({ phone: '(205) 555-0129', email: 'desk@example.test' }));
    expect(within(ask).getByRole('link', { name: '(205) 555-0129' }).getAttribute('href')).toBe('tel:+12055550129');
    expect(within(ask).getByRole('link', { name: 'desk@example.test' }).getAttribute('href')).toBe('mailto:desk@example.test');
    expect(within(ask).getByRole('link', { name: 'My account' }).getAttribute('href')).toBe('/account');
  });

  it('carries no owner questions, quotes or Net-30 wording', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/pages/support/PolicyPage.jsx'), 'utf8');
    const privacy = source.slice(source.indexOf('  privacy: {'), source.indexOf('  terms: {'));
    expect(privacy).not.toMatch(/TODO\(owner\)/);
    const { container } = render(<PolicyPage kind="privacy" />);
    // The words, not the storage keys ('aw-quote-draft' keeps its old name).
    const words = container.querySelector('.policy-body').cloneNode(true);
    words.querySelectorAll('code').forEach((code) => code.remove());
    expect(words.textContent).not.toMatch(/\bquotes?\b|net[- ]?30|counsel/i);
  });
});

// AW-025 (owner answer 2026-10): no Net-30 and no volume discounts; the
// Payment section says how to ask for volume pricing.
describe('Trade terms payment (AW-025)', () => {
  it('names the payment methods and how to ask for volume pricing, and no credit terms or discounts', () => {
    const { container } = render(<PolicyPage kind="terms" />);
    const payment = section('Payment');
    expect([...payment.querySelectorAll('p')].map((p) => p.textContent)).toEqual([
      'Payment methods are cash, checks, and electronic wiring and transfers.',
      `For volume pricing, email us or call ${COMPANY.phone}.`,
    ]);
    expect(payment.querySelector(`a[href="mailto:${COMPANY.email}"]`).textContent).toBe('email us');
    expect(payment.querySelector(`a[href="tel:${COMPANY.phoneRaw}"]`).textContent).toBe(COMPANY.phone);
    expect(container.textContent).not.toMatch(/net[- ]?30|credit terms|volume discount|up to \d+%/i);
  });
});
