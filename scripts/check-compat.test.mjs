// @vitest-environment node
// The post-build check for built-in functions the target browsers lack
// (NEW-019): the site's own files fail the build, React's and Supabase's
// are only reported.
import { describe, expect, it } from 'vitest';
import { compatProblems, isLibraryFile, NEWER_CALLS } from './check-compat.mjs';

describe('check-compat', () => {
  it('finds each newer call in the site’s own files and in library files', () => {
    const problems = compatProblems({
      'AuthModal-abc.js': 'const t=`${a.slice(0,-1).join(", ")} and ${a.at(-1)}`;',
      'accountLabels-x.js': 'e=>Object.hasOwn(n,String(e??""))?n[e]:c(e)',
      'supabase-y.js': 'const c=structuredClone(o);',
      'index-z.js': 'const s=a.slice(),l=a[a.length-1];',
    });
    expect(problems).toEqual([
      { file: 'AuthModal-abc.js', call: '.at(-', library: false },
      { file: 'accountLabels-x.js', call: 'Object.hasOwn(', library: false },
      { file: 'supabase-y.js', call: 'structuredClone(', library: true },
    ]);
  });

  it('knows the vendor and Supabase files by name', () => {
    expect(isLibraryFile('vendor-D3j9xVti.js')).toBe(true);
    expect(isLibraryFile('/x/dist/assets/supabase-CR30SAh-.js')).toBe(true);
    // Storage and Realtime, split from the client every page loads (AW-179).
    expect(isLibraryFile('storage-Ab12.js')).toBe(true);
    expect(isLibraryFile('realtime-Cd34.js')).toBe(true);
    expect(isLibraryFile('index-CWML2A4j.js')).toBe(false);
    expect(isLibraryFile('AdminPage-vendorish.js')).toBe(false);
  });

  it('covers the calls the ESLint rules refuse', () => {
    for (const call of ['Object.hasOwn(', 'structuredClone(', '.findLast(', 'AbortSignal.timeout(']) expect(NEWER_CALLS).toContain(call);
  });
});
