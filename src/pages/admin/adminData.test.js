// adminErrorMessage and checkedWrite (AW-202): staff wording for every way
// an admin call fails, and a write that reached no row counts as refused.
import { describe, expect, it } from 'vitest';
import { NEEDS_UPDATE, NO_ROWS, SESSION_ENDED, adminErrorMessage, checkedWrite, withStatus } from './adminData.js';
import { createFakeSupabase } from './fakeSupabase.js';
import { orderActionError } from './OrdersSection.jsx';
import { profileSaveError } from './AccountsSection.jsx';

const SAVE = 'The change wasn’t saved';

describe('adminErrorMessage', () => {
  it('says a lost connection is a connection problem', () => {
    expect(adminErrorMessage({ message: 'TypeError: Failed to fetch' }, 'The orders didn’t load'))
      .toBe('The orders didn’t load: the database couldn’t be reached. Check the connection and try again.');
  });

  it('says an ended session is one', () => {
    for (const error of [{ status: 401, message: 'Unauthorized' }, { code: 'PGRST301', message: 'JWT invalid' }, { code: 'PGRST303', message: 'x' }, { message: 'JWT expired' }]) {
      expect(adminErrorMessage(error, SAVE)).toBe(SESSION_ENDED);
    }
    expect(SESSION_ENDED).toBe('Your session ended. Sign in again.');
  });

  it('names the guard that refused a change, or says it is not allowed', () => {
    expect(adminErrorMessage({ code: '42501', hint: 'own_role_status' }, SAVE)).toBe('You can’t change your own status or role.');
    expect(adminErrorMessage({ code: '42501', hint: 'profile_record' }, SAVE)).toBe('Consent and approval records can’t be edited.');
    expect(adminErrorMessage({ code: '42501', hint: 'profile_email' }, SAVE)).toBe('A profile’s email follows its sign-in email.');
    expect(adminErrorMessage({ code: '42501', hint: 'admin_only' }, SAVE)).toBe('Only an approved admin can change this.');
    expect(adminErrorMessage({ code: '42501', message: 'permission denied for table products' }, SAVE)).toBe('The change wasn’t saved: your account isn’t allowed to do that.');
    expect(adminErrorMessage({ status: 403, message: 'new row violates row-level security policy' }, SAVE)).toBe('The change wasn’t saved: your account isn’t allowed to do that.');
  });

  it('points a missing function, column or table at the October 2026 update', () => {
    for (const code of ['PGRST202', '42883', 'PGRST204', '42703', 'PGRST205', '42P01']) expect(adminErrorMessage({ code }, SAVE)).toBe(NEEDS_UPDATE);
    expect(NEEDS_UPDATE).toBe('This needs the October 2026 database update (see BACKEND.md).');
  });

  it('puts constraint failures in plain words, and anything else with its message', () => {
    expect(adminErrorMessage({ code: '23505' }, SAVE)).toBe('The change wasn’t saved: another record already uses that value.');
    expect(adminErrorMessage({ code: '23514' }, SAVE)).toBe('The change wasn’t saved: a value is outside what the database accepts.');
    expect(adminErrorMessage({ code: '23503' }, SAVE)).toBe('The change wasn’t saved: it refers to something that no longer exists.');
    expect(adminErrorMessage({ code: '23502' }, SAVE)).toBe('The change wasn’t saved: a required value is missing.');
    expect(adminErrorMessage({ code: 'XX000', message: 'boom' }, SAVE)).toBe('The change wasn’t saved (boom). Try again.');
    expect(adminErrorMessage({ code: NO_ROWS, message: '' }, SAVE)).toBe('The change wasn’t saved. Try again.');
    expect(adminErrorMessage(null, SAVE)).toBeNull();
  });

  it('keeps the Orders and Accounts wording', () => {
    expect(orderActionError({ code: '23514' })).toBe('That status needs the October 2026 database update (see BACKEND.md).');
    expect(orderActionError({ code: '42501', hint: 'admin_only' })).toBe('Only an approved admin can change orders.');
    expect(orderActionError({ message: 'boom' })).toBe('The change wasn’t saved (boom). Try again.');
    expect(orderActionError({ code: NO_ROWS })).toBe('The change wasn’t saved. Try again.');
    expect(profileSaveError({ code: '42501' }, 'Test Market')).toBe('That change to Test Market isn’t allowed.');
    expect(profileSaveError({ code: '42501', hint: 'own_role_status' }, 'Test Market')).toBe('You can’t change your own status or role.');
    expect(profileSaveError({ code: 'PGRST204', message: 'Could not find the column' }, 'Test Market')).toBe('Saving this needs the October 2026 database update (see BACKEND.md).');
    expect(profileSaveError({ code: NO_ROWS }, 'Test Market')).toBe('The change to Test Market wasn’t saved. Try again.');
  });
});

describe('withStatus', () => {
  it('carries the HTTP status onto the error, message included', () => {
    const error = Object.defineProperty({ code: 'PGRST301' }, 'message', { value: 'JWT expired', enumerable: false });
    expect(withStatus({ error, status: 401 })).toMatchObject({ code: 'PGRST301', message: 'JWT expired', status: 401 });
    expect(withStatus({ data: [], error: null, status: 200 })).toBeNull();
  });
});

describe('checkedWrite', () => {
  it('reads the changed row back, and calls no row a refusal', async () => {
    const fake = createFakeSupabase();
    expect(await checkedWrite(fake.client.from('orders').update({ status: 'picking' }).eq('id', 'o1'))).toEqual({ data: [{ id: 'o1' }], error: null });
    expect(fake.calls[0]).toMatchObject({ table: 'orders', op: 'update', patch: { status: 'picking' }, returning: 'id' });
    fake.respond = () => ({ data: [], error: null, status: 200 });
    expect((await checkedWrite(fake.client.from('orders').update({ status: 'picking' }).eq('id', 'o1'))).error).toMatchObject({ code: NO_ROWS });
    fake.respond = () => ({ data: null, error: { code: '42501', message: 'denied' }, status: 403 });
    expect((await checkedWrite(fake.client.from('orders').update({ status: 'picking' }).eq('id', 'o1'))).error).toMatchObject({ code: '42501', status: 403 });
  });
});
