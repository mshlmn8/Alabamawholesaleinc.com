// Sign-in (email + password), sign-up (business onboarding), pending-approval
// and password-reset screens on the 2A dialog shell. On sign-up a profile row
// is created as a pending customer. Owner access is a separate admin step, not
// part of public signup.

import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/useAuth.js';
import { useDialogFocus } from '../lib/useDialogFocus.js';
import { COMPANY } from '../data/content.js';
import { APPLICATION_CHECKLIST } from '../data/onboarding.js';
import { ServiceUnavailable } from './ServiceUnavailable.jsx';

const STATES = ['AL','GA','MS','TN','FL','LA','SC','NC','KY','Other'];
const BUSINESS_TYPES = ['Convenience Store','Smoke Shop','Vape Shop','Liquor Store','Grocery / Bodega','Auto Parts','Hookah Lounge','Other'];
const VOLUMES = ['Under $5K','$5K — $15K','$15K — $50K','$50K — $100K','$100K+'];

const EMPTY_SIGNUP = {
  email: '', password: '', name: '', business: '', phone: '',
  ein: '', license_no: '', resale_cert_no: '',
  business_type: 'Convenience Store', state: 'AL', expected_volume: '$5K — $15K',
};

function Field({ id, label, hint, full = false, children }) {
  return (
    <div className={full ? 'full' : undefined}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <small className="field-hint" id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}

function TradeDesk() {
  return <>Call <a href={`tel:${COMPANY.phoneRaw}`}>{COMPANY.phone}</a> or email <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></>;
}

export function AuthModal({ open, initialMode = 'signin', onClose, onNavigate }) {
  const { signIn, signUp, resetPassword, session, profile, profileReady, loading, isBackendConfigured } = useAuth();
  // signin | checklist | signup | sent | status | checking | reset | reset-sent
  // initialMode 'signup' starts at the checklist; 'application' skips straight to the form.
  const [mode, setMode] = useState(initialMode === 'signup' ? 'checklist' : initialMode === 'application' ? 'signup' : initialMode);
  const [afterSignup, setAfterSignup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [signin, setSignin] = useState({ email: '', password: '' });
  const [resetEmail, setResetEmail] = useState('');
  const [signup, setSignup] = useState(EMPTY_SIGNUP);
  const dialogRef = useRef(null);
  const titleRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useDialogFocus(dialogRef, { active: open });

  // Each step swaps the dialog content, so move focus to the new heading.
  const initialModeRef = useRef(mode);
  useEffect(() => {
    if (mode === initialModeRef.current) return;
    titleRef.current?.focus({ preventScroll: true });
  }, [mode]);

  // After sign-in, wait for the profile so a pending account sees its status
  // instead of the dialog silently closing.
  useEffect(() => {
    if (mode !== 'checking' || loading || !session || !profileReady) return undefined;
    if (profile && profile.status !== 'approved') { setMode('status'); return undefined; }
    onCloseRef.current();
    return undefined;
  }, [mode, loading, session, profileReady, profile]);
  useEffect(() => {
    if (mode !== 'checking') return undefined;
    const id = window.setTimeout(() => onCloseRef.current(), 10000);
    return () => window.clearTimeout(id);
  }, [mode]);

  if (!open) return null;

  const setS = (k) => (e) => setSignin({ ...signin, [k]: e.target.value });
  const setU = (k) => (e) => setSignup({ ...signup, [k]: e.target.value });
  const switchMode = (next) => { setError(null); setMode(next); };
  const go = (page) => { onClose(); onNavigate?.({ page }); };

  const handleSignin = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try { await signIn(signin); setMode('checking'); }
    catch (err) { setError(err.message || 'Sign-in failed'); }
    finally { setSubmitting(false); }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      const data = await signUp(signup);
      setAfterSignup(true);
      // With email confirmation on there is no session yet; otherwise the new
      // account is signed in and already pending review.
      setMode(data?.session ? 'status' : 'sent');
    }
    catch (err) { setError(err.message || 'Sign-up failed'); }
    finally { setSubmitting(false); }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try { await resetPassword(resetEmail); setMode('reset-sent'); }
    catch (err) { setError(err.message || 'We couldn’t send the reset link'); }
    finally { setSubmitting(false); }
  };

  const status = profile?.status || 'pending';
  const kicker = {
    signin: 'EXISTING ACCOUNTS',
    checklist: 'NEW ACCOUNTS · LICENSED RETAILERS ONLY',
    signup: 'NEW ACCOUNTS · LICENSED RETAILERS ONLY',
    sent: 'CONFIRM YOUR EMAIL',
    status: status === 'suspended' ? 'ACCOUNT ON HOLD' : 'APPLICATION UNDER REVIEW',
    checking: 'EXISTING ACCOUNTS',
    reset: 'PASSWORD HELP',
    'reset-sent': 'PASSWORD HELP',
  }[mode];
  const title = {
    signin: 'Sign in',
    checklist: 'Apply for an account',
    signup: 'Apply for an account',
    sent: 'Check your inbox',
    status: status === 'suspended' ? 'Your account needs attention' : 'Your account is pending approval',
    checking: 'Signing you in…',
    reset: 'Reset your password',
    'reset-sent': 'Check your inbox',
  }[mode];
  const unavailableWhat = { signin: 'Account sign-in', checking: 'Account sign-in', checklist: 'The online application', signup: 'The online application', reset: 'Password reset' }[mode];

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog scale-in" role="dialog" aria-modal="true" aria-labelledby="auth-title" tabIndex={-1} ref={dialogRef} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-top">
          <p className="eyebrow">TRADE ACCOUNT</p>
          <button className="dialog-close" type="button" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p className="kicker">{kicker}</p>
        <h2 id="auth-title" ref={titleRef} tabIndex={-1}>{title}</h2>

        {mode === 'signin' && <p className="desc">Sign in to view wholesale pricing, build orders and see your order history.</p>}
        {mode === 'checklist' && <p className="desc">Alabama Wholesale sells exclusively to licensed retail businesses. Have these on hand before you start — the application takes a few minutes.</p>}
        {mode === 'signup' && <p className="desc">Alabama Wholesale sells exclusively to licensed retail businesses. Most applications are approved within one business day. Net-30 terms available with credit verification.</p>}
        {mode === 'sent' && <p className="desc">We sent a confirmation link to {signup.email}. Click it to activate your account — a trade rep will verify your license within one business day.</p>}
        {mode === 'checking' && <p className="desc" aria-live="polite">One moment while we load your account.</p>}
        {mode === 'reset' && <p className="desc">Enter the business email on your account and we’ll send a link to choose a new password.</p>}
        {mode === 'reset-sent' && <p className="desc">If an account exists for {resetEmail}, a password reset link is on its way. The link works once — if it doesn’t arrive within a few minutes, check your spam folder or call us.</p>}
        {mode === 'status' && (
          status === 'suspended'
            ? <p className="desc">Ordering is paused on this account. <TradeDesk /> and a trade rep will help you sort it out.</p>
            : <p className="desc">
                {afterSignup ? 'Thanks' : 'Welcome back'}{profile?.name || signup.name ? `, ${profile?.name || signup.name}` : ''}.
                {' '}{(profile?.business || signup.business) ? `We have the application for ${profile?.business || signup.business}. ` : ''}
                A trade rep is reviewing your license information and will contact you at {profile?.email || signup.email} when your account is approved. Wholesale pricing and ordering unlock at that point.
              </p>
        )}

        {unavailableWhat && !isBackendConfigured && <ServiceUnavailable what={unavailableWhat} />}

        {mode === 'signin' && (
          <form onSubmit={handleSignin}>
            <div className="form-grid">
              <Field id="aw-email" label="Business email" full>
                <input id="aw-email" type="email" name="email" value={signin.email} onChange={setS('email')} required autoComplete="email" inputMode="email" data-autofocus />
              </Field>
              <Field id="aw-pass" label="Password" full>
                <input id="aw-pass" type="password" name="password" value={signin.password} onChange={setS('password')} required autoComplete="current-password" />
              </Field>
            </div>
            <p className="form-error" role="alert">{error}</p>
            <div className="dialog-actions">
              <button className="button" type="submit" disabled={submitting || !isBackendConfigured}>{submitting ? 'Signing in…' : 'Sign in'} <span aria-hidden="true">↗</span></button>
              <button className="text-link" type="button" onClick={() => { setResetEmail(signin.email); switchMode('reset'); }}>Forgot password?</button>
              <button className="text-link" type="button" onClick={() => switchMode('checklist')}>No account? Apply instead</button>
            </div>
          </form>
        )}

        {mode === 'checking' && (
          <div className="dialog-actions">
            <button className="text-link" type="button" onClick={onClose}>Continue browsing</button>
          </div>
        )}

        {mode === 'checklist' && (
          <>
            <h3 className="checklist-heading">What you’ll need</h3>
            <ul className="checklist">
              {APPLICATION_CHECKLIST.map(item => (
                <li key={item.title}><b>{item.title}</b><span>{item.detail}</span></li>
              ))}
            </ul>
            <p className="checklist-note">Missing one of these? <TradeDesk /> and a trade rep can talk you through the application.</p>
            <div className="dialog-actions">
              <button className="button" type="button" onClick={() => switchMode('signup')} data-autofocus>Continue to the application <span aria-hidden="true">↗</span></button>
              <button className="text-link" type="button" onClick={() => switchMode('signin')}>Already approved? Sign in</button>
            </div>
          </>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignup}>
            <div className="form-grid">
              <Field id="aw-su-name" label="Your name">
                <input id="aw-su-name" name="name" value={signup.name} onChange={setU('name')} required autoComplete="name" data-autofocus />
              </Field>
              <Field id="aw-su-business" label="Business name">
                <input id="aw-su-business" name="organization" value={signup.business} onChange={setU('business')} required autoComplete="organization" />
              </Field>
              <Field id="aw-su-email" label="Business email">
                <input id="aw-su-email" type="email" name="email" value={signup.email} onChange={setU('email')} required autoComplete="email" inputMode="email" />
              </Field>
              <Field id="aw-su-phone" label="Phone">
                <input id="aw-su-phone" type="tel" name="tel" value={signup.phone} onChange={setU('phone')} required autoComplete="tel" inputMode="tel" />
              </Field>
              <Field id="aw-su-pass" label="Password" hint="At least 8 characters.">
                <input id="aw-su-pass" type="password" name="new-password" value={signup.password} onChange={setU('password')} required minLength={8} autoComplete="new-password" aria-describedby="aw-su-pass-hint" />
              </Field>
              <Field id="aw-su-type" label="Business type">
                <select id="aw-su-type" name="business_type" value={signup.business_type} onChange={setU('business_type')} autoComplete="off">{BUSINESS_TYPES.map(o => <option key={o}>{o}</option>)}</select>
              </Field>
              <Field id="aw-su-ein" label="Federal EIN" hint="9 digits, for example 12-3456789.">
                <input id="aw-su-ein" name="ein" value={signup.ein} onChange={setU('ein')} required inputMode="numeric" pattern="[0-9]{2}-?[0-9]{7}" title="Enter the 9-digit EIN, for example 12-3456789" placeholder="12-3456789" autoComplete="off" aria-describedby="aw-su-ein-hint" />
              </Field>
              <Field id="aw-su-state" label="Store state">
                <select id="aw-su-state" name="state" value={signup.state} onChange={setU('state')} autoComplete="address-level1">{STATES.map(o => <option key={o}>{o}</option>)}</select>
              </Field>
              <Field id="aw-su-license" label="State retail tobacco license #" hint="From the state where the store is licensed.">
                <input id="aw-su-license" name="license_no" value={signup.license_no} onChange={setU('license_no')} required autoComplete="off" aria-describedby="aw-su-license-hint" />
              </Field>
              <Field id="aw-su-resale" label="Resale certificate #" hint="Sales tax resale or exemption certificate.">
                <input id="aw-su-resale" name="resale_cert_no" value={signup.resale_cert_no} onChange={setU('resale_cert_no')} required autoComplete="off" aria-describedby="aw-su-resale-hint" />
              </Field>
              <Field id="aw-su-volume" label="Expected monthly volume" full>
                <select id="aw-su-volume" name="expected_volume" value={signup.expected_volume} onChange={setU('expected_volume')} autoComplete="off">{VOLUMES.map(o => <option key={o}>{o}</option>)}</select>
              </Field>
            </div>
            <p className="form-error" role="alert">{error}</p>
            <div className="dialog-actions">
              <button className="button" type="submit" disabled={submitting || !isBackendConfigured}>{submitting ? 'Creating…' : 'Submit application'} <span aria-hidden="true">↗</span></button>
              <button className="text-link" type="button" onClick={() => switchMode('checklist')}>Back to the checklist</button>
              <button className="text-link" type="button" onClick={() => switchMode('signin')}>Already approved? Sign in</button>
            </div>
          </form>
        )}

        {mode === 'sent' && (
          <>
            <h3 className="checklist-heading">What happens next</h3>
            <ol className="next-steps">
              <li><b>Confirm your email.</b><span>Open the link we sent to {signup.email}. If it doesn’t arrive within a few minutes, check your spam folder. Already have an account with this email? Sign in instead.</span></li>
              <li><b>We review your application.</b><span>A trade rep checks your EIN, state retail tobacco license and resale certificate.</span></li>
              <li><b>You hear from us.</b><span>We’ll contact you at {signup.email} or {signup.phone} when your account is approved. Wholesale pricing and ordering unlock then.</span></li>
            </ol>
            <div className="dialog-actions">
              <button className="button" type="button" onClick={onClose} data-autofocus>Done <span aria-hidden="true">↗</span></button>
              <button className="text-link" type="button" onClick={() => switchMode('signin')}>Sign in</button>
            </div>
          </>
        )}

        {mode === 'status' && (
          <>
            {status !== 'suspended' && (
              <>
                <h3 className="checklist-heading">While you wait</h3>
                <ul className="checklist">
                  <li><b>Browse the catalog.</b><span>You can look through every department and build a quote request now.</span></li>
                  <li><b>Pricing unlocks on approval.</b><span>Wholesale prices and checkout appear as soon as a trade rep approves the account.</span></li>
                  <li><b>Questions?</b><span><TradeDesk />.</span></li>
                </ul>
              </>
            )}
            <div className="dialog-actions">
              <button className="button" type="button" onClick={() => go('account')} data-autofocus>View account status <span aria-hidden="true">↗</span></button>
              <button className="text-link" type="button" onClick={() => go('catalog')}>Browse the catalog</button>
              <button className="text-link" type="button" onClick={onClose}>Close</button>
            </div>
          </>
        )}

        {mode === 'reset' && (
          <form onSubmit={handleReset}>
            <div className="form-grid">
              <Field id="aw-reset-email" label="Business email" full>
                <input id="aw-reset-email" type="email" name="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required autoComplete="email" inputMode="email" data-autofocus />
              </Field>
            </div>
            <p className="form-error" role="alert">{error}</p>
            <div className="dialog-actions">
              <button className="button" type="submit" disabled={submitting || !isBackendConfigured}>{submitting ? 'Sending…' : 'Send reset link'} <span aria-hidden="true">↗</span></button>
              <button className="text-link" type="button" onClick={() => switchMode('signin')}>Back to sign in</button>
            </div>
          </form>
        )}

        {mode === 'reset-sent' && (
          <div className="dialog-actions">
            <button className="button" type="button" onClick={onClose} data-autofocus>Done <span aria-hidden="true">↗</span></button>
            <button className="text-link" type="button" onClick={() => switchMode('signin')}>Back to sign in</button>
          </div>
        )}

        <p className="fine">21+ licensed businesses only. By applying you confirm all store staff handling tobacco products meet federal and state age requirements.</p>
      </div>
    </div>
  );
}
