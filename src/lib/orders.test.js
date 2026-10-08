// submitOrder against a fake Supabase client (no network). Covers Cursor's
// PR #12 fallback: until 20261008190000_quote_tobacco_license.sql is applied,
// the live submit_quote has no licence parameters, so the answers go in the
// notes instead of being lost (AW-014).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('./supabase.js', () => ({ supabase: { rpc } }));

const { submitOrder } = await import('./orders.js');

const FORM = {
  business: 'Test Market', contact: 'Test Buyer', email: 'buyer@example.test', phone: '205-000-0000',
  delivery: 'delivery', preferredDate: '', notes: 'Dock B',
  shipStreet: '1 Test Way', shipCity: 'Birmingham', shipState: 'AL', shipZip: '35203',
  licenseNo: 'TL-123', resaleCert: 'RC-456', purchasers21: true,
};
const ITEMS = [{ productId: 14, variant: null, qty: 2 }];
const MISSING = { code: 'PGRST202', message: 'Could not find the function public.submit_quote(p_business, …) in the schema cache' };

beforeEach(() => rpc.mockReset());

describe('submitOrder', () => {
  it('sends the licence answers to the new submit_quote', async () => {
    rpc.mockResolvedValueOnce({ data: { id: 'o1', ref_num: 'ALW-Q-1' }, error: null });
    const result = await submitOrder({ refNum: 'ALW-Q-1', formData: FORM, items: ITEMS });
    expect(result).toMatchObject({ ok: true, order: { id: 'o1' } });
    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0];
    expect(name).toBe('submit_quote');
    expect(args).toMatchObject({
      p_license_no: 'TL-123', p_resale_cert: 'RC-456', p_purchasers_21: true, p_notes: 'Dock B',
      p_items: [{ product_id: 14, variant: null, qty: 2 }],
    });
  });

  it('keeps the answers in the notes when the live database has the old submit_quote', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: MISSING });
    rpc.mockResolvedValueOnce({ data: { id: 'o2', ref_num: 'ALW-Q-2' }, error: null });
    await submitOrder({ refNum: 'ALW-Q-2', formData: FORM, items: ITEMS });
    expect(rpc).toHaveBeenCalledTimes(2);
    const [, args] = rpc.mock.calls[1];
    expect(args).not.toHaveProperty('p_license_no');
    expect(args).not.toHaveProperty('p_purchasers_21');
    expect(args.p_notes).toBe([
      'Dock B',
      'State tobacco/retail license #: TL-123',
      'Sales-tax / resale certificate #: RC-456',
      'Confirmed: valid tobacco retail license and purchasers are 21+.',
    ].join('\n'));
  });

  it('adds nothing to the notes for a quote without licence answers', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: MISSING });
    rpc.mockResolvedValueOnce({ data: { id: 'o3' }, error: null });
    await submitOrder({ refNum: 'ALW-Q-3', formData: { ...FORM, notes: '', licenseNo: '', resaleCert: '', purchasers21: false }, items: ITEMS });
    expect(rpc.mock.calls[1][1].p_notes).toBeNull();
  });

  it('does not retry other errors, such as the new rule refusing a quote', async () => {
    const refused = { code: 'P0001', message: 'A tobacco license, resale certificate, and 21+ confirmation are required' };
    rpc.mockResolvedValueOnce({ data: null, error: refused });
    await expect(submitOrder({ refNum: 'ALW-Q-4', formData: FORM, items: ITEMS })).rejects.toBe(refused);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
