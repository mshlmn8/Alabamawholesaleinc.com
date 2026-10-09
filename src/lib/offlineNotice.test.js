// The offline notice (AW-344): only while offline, a warning, no close button.
import { describe, expect, it } from 'vitest';
import { OFFLINE_NOTICE, offlineNotices } from './offlineNotice.js';

describe('offlineNotices', () => {
  it('is empty while online', () => {
    expect(offlineNotices({ online: true })).toEqual([]);
    expect(offlineNotices()).toEqual([]);
  });

  it('says what still works while offline, and goes away on its own', () => {
    const [notice, ...rest] = offlineNotices({ online: false });
    expect(rest).toEqual([]);
    expect(notice).toBe(OFFLINE_NOTICE);
    expect(notice).toEqual({
      id: 'offline',
      tone: 'warn',
      title: 'You’re offline',
      text: 'You can keep browsing and adding to your cart. Sending a quote or order, signing in and uploads wait until you’re back online.',
    });
    expect(notice).not.toHaveProperty('onDismiss');
    expect(notice).not.toHaveProperty('actions');
  });
});
