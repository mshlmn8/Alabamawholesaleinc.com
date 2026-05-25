// Replaces the toy LoginModal. Two modes: sign-in (email + password) and
// sign-up (business onboarding form). On sign-up a profile row is created
// automatically via the handle_new_user trigger; the very first signup is
// auto-promoted to admin/approved (see initial_schema.sql).

import React, { useState } from 'react';
import { X, ArrowRight, Users } from 'lucide-react';
import { C, body, display, mono } from '../data/theme.js';
import { IMG } from '../data/theme.js';
import { COMPANY } from '../data/content.js';
import { useAuth } from '../lib/useAuth.js';

const STATES = ['AL','GA','MS','TN','FL','LA','SC','NC','KY','Other'];
const BUSINESS_TYPES = ['Convenience Store','Smoke Shop','Vape Shop','Liquor Store','Grocery / Bodega','Auto Parts','Hookah Lounge','Other'];
const VOLUMES = ['Under $5K','$5K — $15K','$15K — $50K','$50K — $100K','$100K+'];

export function AuthModal({ open, onClose }) {
  const { signIn, signUp, isBackendConfigured } = useAuth();
  const [mode, setMode] = useState('signin'); // signin | signup | sent
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [signin, setSignin] = useState({ email: '', password: '' });
  const [signup, setSignup] = useState({
    email: '', password: '', name: '', business: '', phone: '',
    license_no: '', business_type: 'Convenience Store', state: 'AL', expected_volume: '$5K — $15K',
  });

  if (!open) return null;

  const setS = (k) => (e) => setSignin({ ...signin, [k]: e.target.value });
  const setU = (k) => (e) => setSignup({ ...signup, [k]: e.target.value });

  const handleSignin = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      await signIn(signin);
      onClose();
    } catch (err) {
      setError(err.message || 'Sign-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      await signUp(signup);
      setMode('sent');
    } catch (err) {
      setError(err.message || 'Sign-up failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6"
         style={{ background: 'rgba(15, 12, 50, 0.75)', backdropFilter: 'blur(6px)' }}>
      <div onClick={(e) => e.stopPropagation()}
           className="relative w-full max-w-md max-h-[92vh] overflow-y-auto scale-in"
           style={{ background: 'white', boxShadow: '0 20px 80px rgba(0,0,0,0.4)' }}>
        <button onClick={onClose} aria-label="Close"
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center transition-colors hover:bg-gray-100"
                style={{ color: C.muted }}>
          <X size={18} />
        </button>

        <div className="px-6 md:px-8 pt-8 pb-4 text-center">
          <img src={IMG.logo} alt={COMPANY.name} className="mx-auto mb-4"
               style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 8 }} />
          <div style={{ ...mono, fontWeight: 700, letterSpacing: '0.3em', color: C.orange }} className="text-[10px] uppercase mb-2">
            ★ TRADE ACCOUNT
          </div>
          <h2 style={{ ...display, fontWeight: 800, color: C.navy }} className="text-2xl md:text-3xl leading-tight mb-2">
            {mode === 'sent' ? 'Check your inbox' : mode === 'signup' ? 'Create a wholesale account' : 'Sign in'}
          </h2>
          <p className="text-xs md:text-sm" style={{ color: C.muted, maxWidth: '36ch', margin: '0 auto' }}>
            {mode === 'sent'
              ? `We sent a confirmation link to ${signup.email}. Click it to activate your account. A trade rep will verify your license within one business day.`
              : mode === 'signup'
              ? 'Approved within one business day. Net-30 terms available with credit verification.'
              : 'Sign in to view wholesale pricing and your order history.'}
          </p>
        </div>

        {!isBackendConfigured && (
          <div className="mx-6 md:mx-8 mb-4 px-3 py-2 text-[11px]"
               style={{ background: '#FFF5EC', border: `1px solid ${C.orange}`, color: C.navy }}>
            Backend not configured. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in your <code>.env</code>.
          </div>
        )}

        {mode === 'signin' && (
          <form onSubmit={handleSignin} className="px-6 md:px-8 pb-6 md:pb-8 space-y-4">
            <Field label="Email" type="email" value={signin.email} onChange={setS('email')} required autoFocus />
            <Field label="Password" type="password" value={signin.password} onChange={setS('password')} required />
            {error && <div className="text-xs" style={{ color: '#B84F23' }}>{error}</div>}
            <button type="submit" disabled={submitting || !isBackendConfigured}
                    className="w-full py-3.5 text-xs uppercase font-bold inline-flex items-center justify-center gap-2 transition-transform hover:scale-[1.01] disabled:opacity-60 disabled:hover:scale-100"
                    style={{ ...mono, letterSpacing: '0.22em', background: C.orange, color: 'white' }}>
              {submitting ? 'Signing in…' : <>Sign In <ArrowRight size={14} /></>}
            </button>
            <p className="text-[11px] text-center" style={{ ...mono, color: C.muted }}>
              New here? <button type="button" onClick={() => { setError(null); setMode('signup'); }}
                                className="font-bold transition-colors hover:text-[#DB6433]" style={{ color: C.orange }}>
                Open a trade account →
              </button>
            </p>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignup} className="px-6 md:px-8 pb-6 md:pb-8 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Your Name" value={signup.name} onChange={setU('name')} required />
              <Field label="Business" value={signup.business} onChange={setU('business')} required />
              <Field label="Email" type="email" value={signup.email} onChange={setU('email')} required />
              <Field label="Phone" type="tel" value={signup.phone} onChange={setU('phone')} required />
              <Field label="Password" type="password" value={signup.password} onChange={setU('password')} required hint="8+ characters" />
              <Field label="Retail License #" value={signup.license_no} onChange={setU('license_no')} required />
              <Select label="Business Type" value={signup.business_type} onChange={setU('business_type')} options={BUSINESS_TYPES} />
              <Select label="State" value={signup.state} onChange={setU('state')} options={STATES} />
            </div>
            <Select label="Expected Monthly Volume" value={signup.expected_volume} onChange={setU('expected_volume')} options={VOLUMES} />
            {error && <div className="text-xs" style={{ color: '#B84F23' }}>{error}</div>}
            <button type="submit" disabled={submitting || !isBackendConfigured}
                    className="w-full py-3.5 text-xs uppercase font-bold inline-flex items-center justify-center gap-2 transition-transform hover:scale-[1.01] disabled:opacity-60 disabled:hover:scale-100"
                    style={{ ...mono, letterSpacing: '0.22em', background: C.orange, color: 'white' }}>
              {submitting ? 'Creating…' : <>Submit Application <ArrowRight size={14} /></>}
            </button>
            <p className="text-[11px] text-center" style={{ ...mono, color: C.muted }}>
              Already have an account? <button type="button" onClick={() => { setError(null); setMode('signin'); }}
                                                className="font-bold transition-colors hover:text-[#DB6433]" style={{ color: C.orange }}>
                Sign in →
              </button>
            </p>
          </form>
        )}

        {mode === 'sent' && (
          <div className="px-6 md:px-8 pb-8 text-center">
            <button onClick={onClose}
                    className="w-full py-3 text-xs uppercase font-bold"
                    style={{ ...mono, letterSpacing: '0.22em', background: C.navy, color: 'white' }}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required, autoFocus, hint }) {
  return (
    <div className="col-span-1">
      <label className="text-[10px] uppercase mb-1.5 block" style={{ ...mono, letterSpacing: '0.22em', fontWeight: 600, color: C.muted }}>
        {label} {required && <span style={{ color: C.orange }}>*</span>}
      </label>
      <input type={type} value={value} onChange={onChange} required={required} autoFocus={autoFocus}
             minLength={type === 'password' ? 8 : undefined}
             className="w-full bg-transparent outline-none text-sm pb-1.5 transition-colors focus:border-[#DB6433]"
             style={{ color: C.text, borderBottom: `1px solid ${C.border}` }} />
      {hint && <div className="text-[10px] mt-0.5" style={{ color: C.mutedSoft }}>{hint}</div>}
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div className="col-span-2">
      <label className="text-[10px] uppercase mb-1.5 block" style={{ ...mono, letterSpacing: '0.22em', fontWeight: 600, color: C.muted }}>{label}</label>
      <select value={value} onChange={onChange}
              className="w-full bg-transparent outline-none text-sm pb-1.5 cursor-pointer"
              style={{ color: C.text, borderBottom: `1px solid ${C.border}` }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
