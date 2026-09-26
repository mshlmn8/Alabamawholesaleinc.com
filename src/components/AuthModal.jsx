// Sign-in (email + password) and sign-up (business onboarding) on the 2A
// dialog shell. On sign-up a profile row is created as a pending customer.
// Owner access is a separate admin step, not part of public signup.

import React, { useState } from 'react';
import { useAuth } from '../lib/useAuth.js';
import { COMPANY } from '../data/content.js';

const STATES = ['AL','GA','MS','TN','FL','LA','SC','NC','KY','Other'];
const BUSINESS_TYPES = ['Convenience Store','Smoke Shop','Vape Shop','Liquor Store','Grocery / Bodega','Auto Parts','Hookah Lounge','Other'];
const VOLUMES = ['Under $5K','$5K — $15K','$15K — $50K','$50K — $100K','$100K+'];

export function AuthModal({ open, initialMode = 'signin', onClose }) {
  const { signIn, signUp, isBackendConfigured } = useAuth();
  const [mode, setMode] = useState(initialMode); // signin | signup | sent
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
    try { await signIn(signin); onClose(); }
    catch (err) { setError(err.message || 'Sign-in failed'); }
    finally { setSubmitting(false); }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try { await signUp(signup); setMode('sent'); }
    catch (err) { setError(err.message || 'Sign-up failed'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog scale-in" role="dialog" aria-modal="true" aria-labelledby="auth-title" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-top">
          <p className="eyebrow">TRADE ACCOUNT</p>
          <button className="dialog-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p className="kicker">{mode === 'signup' ? 'NEW ACCOUNTS · LICENSED RETAILERS ONLY' : mode === 'sent' ? 'CONFIRM YOUR EMAIL' : 'EXISTING ACCOUNTS'}</p>
        <h2 id="auth-title">{mode === 'sent' ? 'Check your inbox' : mode === 'signup' ? 'Apply for an account' : 'Sign in'}</h2>
        <p className="desc">
          {mode === 'sent'
            ? `We sent a confirmation link to ${signup.email}. Click it to activate your account — a trade rep will verify your license within one business day.`
            : mode === 'signup'
            ? 'Alabama Wholesale sells exclusively to licensed retail businesses. Most applications are approved within one business day. Net-30 terms available with credit verification.'
            : 'Sign in to view wholesale pricing, build orders and see your order history.'}
        </p>

        {!isBackendConfigured && (
          <p className="form-error">Account sign-in is unavailable right now. Call {COMPANY.phone} or email {COMPANY.email} and a trade rep will help you.</p>
        )}

        {mode === 'signin' && (
          <form onSubmit={handleSignin}>
            <div className="form-grid">
              <div className="full"><label htmlFor="aw-email">Business email</label><input id="aw-email" type="email" value={signin.email} onChange={setS('email')} required autoFocus /></div>
              <div className="full"><label htmlFor="aw-pass">Password</label><input id="aw-pass" type="password" value={signin.password} onChange={setS('password')} required /></div>
            </div>
            {error && <p className="form-error">{error}</p>}
            <div className="dialog-actions">
              <button className="button" type="submit" disabled={submitting || !isBackendConfigured}>{submitting ? 'Signing in…' : 'Sign in'} <span aria-hidden="true">↗</span></button>
              <button className="text-link" type="button" onClick={() => { setError(null); setMode('signup'); }}>No account? Apply instead</button>
            </div>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignup}>
            <div className="form-grid">
              <div><label>Your name</label><input value={signup.name} onChange={setU('name')} required /></div>
              <div><label>Business</label><input value={signup.business} onChange={setU('business')} required /></div>
              <div><label>Email</label><input type="email" value={signup.email} onChange={setU('email')} required /></div>
              <div><label>Phone</label><input type="tel" value={signup.phone} onChange={setU('phone')} required /></div>
              <div><label>Password</label><input type="password" value={signup.password} onChange={setU('password')} required minLength={8} /></div>
              <div><label>Retail license #</label><input value={signup.license_no} onChange={setU('license_no')} required /></div>
              <div><label>Business type</label>
                <select value={signup.business_type} onChange={setU('business_type')}>{BUSINESS_TYPES.map(o => <option key={o}>{o}</option>)}</select></div>
              <div><label>Store state</label>
                <select value={signup.state} onChange={setU('state')}>{STATES.map(o => <option key={o}>{o}</option>)}</select></div>
              <div className="full"><label>Expected monthly volume</label>
                <select value={signup.expected_volume} onChange={setU('expected_volume')}>{VOLUMES.map(o => <option key={o}>{o}</option>)}</select></div>
            </div>
            {error && <p className="form-error">{error}</p>}
            <div className="dialog-actions">
              <button className="button" type="submit" disabled={submitting || !isBackendConfigured}>{submitting ? 'Creating…' : 'Submit application'} <span aria-hidden="true">↗</span></button>
              <button className="text-link" type="button" onClick={() => { setError(null); setMode('signin'); }}>Already approved? Sign in</button>
            </div>
          </form>
        )}

        {mode === 'sent' && (
          <div className="dialog-actions">
            <button className="button" onClick={onClose}>Done <span aria-hidden="true">↗</span></button>
          </div>
        )}

        <p className="fine">21+ licensed businesses only. By applying you confirm all store staff handling tobacco products meet federal and state age requirements.</p>
      </div>
    </div>
  );
}
