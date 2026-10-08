import assert from 'node:assert/strict';
import {
  AGE_VERIFIED_TTL_MS,
  isAgeVerifiedValue,
} from '../src/lib/ageGate.js';
import {
  cartNeedsTobaccoLicense,
  showsNicotineWarning,
} from '../src/lib/regulated.js';

const now = 1_800_000_000_000;

assert.equal(isAgeVerifiedValue('yes', now), false);
assert.equal(isAgeVerifiedValue(null, now), false);
assert.equal(isAgeVerifiedValue('{', now), false);
assert.equal(isAgeVerifiedValue(JSON.stringify({ ok: true, at: now - 1000 }), now), true);
assert.equal(isAgeVerifiedValue(JSON.stringify({ ok: true, at: now - AGE_VERIFIED_TTL_MS }), now), false);
assert.equal(isAgeVerifiedValue(JSON.stringify({ ok: false, at: now }), now), false);

assert.equal(showsNicotineWarning({ name: 'Geek Bar Pulse X 25K', brand: 'Geek Bar', sub: 'Disposable Vapes' }), true);
assert.equal(showsNicotineWarning({ name: 'ZYN nicotine pouches 6mg', brand: 'ZYN', sub: 'Pouches & ZYN' }), true);
assert.equal(showsNicotineWarning({ name: 'Black & Mild cigars 5-pack', brand: 'Black & Mild', sub: 'Cigars & Cigarillos' }), true);
assert.equal(showsNicotineWarning({ name: 'Al Fakher shisha 50 g', brand: 'Al Fakher', sub: 'Hookah & Shisha' }), true);
assert.equal(showsNicotineWarning({ name: 'High Hemp organic wraps', brand: 'High Hemp', sub: 'Wraps & Leafs' }), false);
assert.equal(showsNicotineWarning({ name: 'RAW rolling papers', brand: 'RAW', sub: 'Papers & Cones' }), false);
assert.equal(showsNicotineWarning({ name: 'Wava kava', brand: 'Wava', sub: 'Kratom & Kava' }), false);
assert.equal(showsNicotineWarning({ name: 'Snickers', brand: 'Snickers', sub: 'Chocolate Bars' }), false);

assert.equal(cartNeedsTobaccoLicense([{ cat: 'TOBACCO', sub: 'Papers & Cones' }]), true);
assert.equal(cartNeedsTobaccoLicense([{ cat: 'NOVELTIES', sub: 'Disposable Vapes' }]), true);
assert.equal(cartNeedsTobaccoLicense([{ cat: 'NOVELTIES', sub: 'Kratom & Kava' }]), false);
assert.equal(cartNeedsTobaccoLicense([{ cat: 'CANDIES', sub: 'Chocolate Bars' }]), false);

console.log('part1 checks ok');
