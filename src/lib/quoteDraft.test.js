// The quote form's draft (AW-080): one sessionStorage record per tab, read
// back only for the same cart owner, never with the license answers.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORAGE } from '../data/content.js';
import { clearQuoteDraft, draftFields, readQuoteDraft, writeQuoteDraft } from './quoteDraft.js';

const KEY = 'aw-quote-draft';
const stored = () => JSON.parse(window.sessionStorage.getItem(KEY));
// What a draft keeps of the form, and the form with the license answers too.
const KEPT = {
  business: 'Test Market', contact: 'Test Buyer', email: 'buyer@example.test', phone: '205-555-0100',
  delivery: 'willcall', shipStreet: '1 Test Way', shipCity: 'Birmingham', shipState: 'AL', shipZip: '35203',
  preferredDate: '2030-01-15', notes: 'Dock B\nBefore 10',
};
const FORM = { ...KEPT, licenseNo: 'TL-SECRET', resaleCert: 'RS-SECRET', purchasers21: true };

afterEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('quoteDraft store (AW-080)', () => {
  it('uses the sessionStorage key content.js names, and never localStorage', () => {
    expect(STORAGE.quoteDraft).toBe(KEY);
    writeQuoteDraft('guest', FORM);
    expect(window.sessionStorage.getItem(KEY)).toBeTruthy();
    expect(Object.keys(window.localStorage)).toEqual([]);
  });

  it('round-trips the contact, address, delivery, date and notes for the same owner', () => {
    writeQuoteDraft('user-1', FORM);
    expect(readQuoteDraft('user-1')).toEqual(KEPT);
    const record = stored();
    expect(record).toEqual({ owner: 'user-1', data: KEPT, savedAt: record.savedAt });
    expect(record.savedAt).toBeTypeOf('number');
  });

  it('never stores the tobacco license answers', () => {
    writeQuoteDraft('guest', FORM);
    const raw = window.sessionStorage.getItem(KEY);
    expect(raw).not.toMatch(/TL-SECRET|RS-SECRET|licenseNo|resaleCert|purchasers21/);
    expect(readQuoteDraft('guest')).not.toHaveProperty('purchasers21');
  });

  it('reads nothing for another owner, or without an owner', () => {
    writeQuoteDraft('user-1', FORM);
    expect(readQuoteDraft('user-2')).toBeNull();
    expect(readQuoteDraft('guest')).toBeNull();
    expect(readQuoteDraft(null)).toBeNull();
    expect(readQuoteDraft('')).toBeNull();
    // No owner: nothing is written either.
    writeQuoteDraft(null, { contact: 'Nobody' });
    expect(stored().owner).toBe('user-1');
  });

  it('keeps one record: a save for another owner replaces it', () => {
    writeQuoteDraft('guest', FORM);
    writeQuoteDraft('user-1', { ...FORM, contact: 'Signed In' });
    expect(readQuoteDraft('guest')).toBeNull();
    expect(readQuoteDraft('user-1').contact).toBe('Signed In');
  });

  it('reads a damaged or foreign value as no draft', () => {
    for (const raw of ['{broken', 'null', '[]', '"text"', '{"owner":"guest"}', '{"owner":"guest","data":[]}', '{"owner":7,"data":{}}']) {
      window.sessionStorage.setItem(KEY, raw);
      expect(readQuoteDraft('guest'), raw).toBeNull();
    }
  });

  it('cuts text to the form’s limits and drops values the form can’t show', () => {
    const fields = draftFields({
      business: 'B'.repeat(500), notes: 'N'.repeat(5000), shipZip: '35203-12345678', phone: 42, contact: null,
      delivery: 'drone', shipState: 'tn', preferredDate: 'next Tuesday', extra: 'x', licenseNo: 'TL-1',
    });
    expect(fields.business).toHaveLength(200);
    expect(fields.notes).toHaveLength(2000);
    expect(fields.shipZip).toHaveLength(10);
    expect(fields).not.toHaveProperty('phone');
    expect(fields).not.toHaveProperty('contact');
    expect(fields).not.toHaveProperty('delivery');
    expect(fields).not.toHaveProperty('preferredDate');
    expect(fields).not.toHaveProperty('extra');
    expect(fields).not.toHaveProperty('licenseNo');
    // A state the select doesn't offer is no state; a route state is upper-case.
    expect(fields.shipState).toBe('');
    expect(draftFields({ shipState: 'ga' }).shipState).toBe('GA');
    expect(draftFields({ preferredDate: '' })).toEqual({ preferredDate: '' });
    expect(draftFields(null)).toEqual({});
    // A stored draft goes through the same checks on the way out.
    window.sessionStorage.setItem(KEY, JSON.stringify({ owner: 'guest', data: { notes: 'N'.repeat(3000), shipState: 'Texas', purchasers21: true }, savedAt: 1 }));
    expect(readQuoteDraft('guest')).toEqual({ notes: 'N'.repeat(2000), shipState: '' });
  });

  it('clears the draft', () => {
    writeQuoteDraft('guest', FORM);
    clearQuoteDraft();
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
    expect(readQuoteDraft('guest')).toBeNull();
  });

  it('treats blocked or full storage as no draft, without throwing', () => {
    const blocked = () => { throw new DOMException('blocked', 'SecurityError'); };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked);
    expect(() => writeQuoteDraft('guest', FORM)).not.toThrow();
    expect(readQuoteDraft('guest')).toBeNull();
    expect(() => clearQuoteDraft()).not.toThrow();
  });

  it('works without sessionStorage at all', () => {
    const area = vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });
    expect(() => writeQuoteDraft('guest', FORM)).not.toThrow();
    expect(readQuoteDraft('guest')).toBeNull();
    expect(() => clearQuoteDraft()).not.toThrow();
    area.mockRestore();
  });
});
