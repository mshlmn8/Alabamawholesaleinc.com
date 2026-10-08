// 21+ confirmation lifetime.
// TODO(owner): For tobacco age-gate compliance, how long should a visitor's 21+ confirmation stay valid (for example 30 days, or the browser session), and should it clear on sign-out? (AW-340)
export const AGE_VERIFIED_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const AGE_DECLINED_KEY = 'aw-age-declined';

// A legacy bare "yes" is treated as expired so the next visit sees the gate.
export function isAgeVerifiedValue(raw, now = Date.now()) {
  if (raw == null || raw === '' || raw === 'yes') return false;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Boolean(
      parsed
      && parsed.ok === true
      && typeof parsed.at === 'number'
      && Number.isFinite(parsed.at)
      && parsed.at > now - AGE_VERIFIED_TTL_MS
    );
  } catch {
    return false;
  }
}

export function readAgeVerified(storage = window.localStorage, now = Date.now()) {
  try {
    return isAgeVerifiedValue(storage.getItem('aw-age-verified'), now);
  } catch {
    return false;
  }
}

export function writeAgeVerified(storage = window.localStorage, now = Date.now()) {
  try {
    storage.setItem('aw-age-verified', JSON.stringify({ ok: true, at: now }));
  } catch {
    // Private mode and blocked storage still let this visit continue.
  }
}

export function clearAgeVerified(storage = window.localStorage) {
  try {
    storage.removeItem('aw-age-verified');
  } catch {
    // Ignore storage failures.
  }
}

export function readAgeDeclined(storage = window.sessionStorage) {
  try {
    return storage.getItem(AGE_DECLINED_KEY) === 'yes';
  } catch {
    return false;
  }
}

export function writeAgeDeclined(storage = window.sessionStorage) {
  try {
    storage.setItem(AGE_DECLINED_KEY, 'yes');
  } catch {
    // The exit screen still shows for this render.
  }
}

export function clearAgeDeclined(storage = window.sessionStorage) {
  try {
    storage.removeItem(AGE_DECLINED_KEY);
  } catch {
    // Ignore storage failures.
  }
}
