import { describe, expect, it } from 'vitest';
import { backendEnvError } from './build-env.mjs';

const ok = { VITE_SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon-key' };

describe('backendEnvError (AW-053)', () => {
  it('passes with a Supabase project URL and an anon key', () => {
    expect(backendEnvError(ok)).toBeNull();
    expect(backendEnvError({ ...ok, VITE_SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co/' })).toBeNull();
  });

  it('fails when either variable is missing or empty', () => {
    expect(backendEnvError({})).toMatch(/VITE_SUPABASE_URL[\s\S]*VITE_SUPABASE_ANON_KEY/);
    expect(backendEnvError({ ...ok, VITE_SUPABASE_ANON_KEY: '' })).toMatch(/VITE_SUPABASE_ANON_KEY/);
    expect(backendEnvError({ ...ok, VITE_SUPABASE_URL: '' })).toMatch(/VITE_SUPABASE_URL/);
  });

  it('fails when the URL is not an https supabase.co project URL', () => {
    for (const url of ['http://abc.supabase.co', 'https://example.com', 'https://abc.supabase.co/rest/v1', ' https://abc.supabase.co']) {
      expect(backendEnvError({ ...ok, VITE_SUPABASE_URL: url })).toMatch(/VITE_SUPABASE_URL/);
    }
  });

  it('allows a static-only build only when ALLOW_NO_BACKEND is exactly 1', () => {
    expect(backendEnvError({ ALLOW_NO_BACKEND: '1' })).toBeNull();
    expect(backendEnvError({ ALLOW_NO_BACKEND: 'true' })).not.toBeNull();
  });
});
