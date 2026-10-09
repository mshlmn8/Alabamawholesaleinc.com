// Sign-in (email + password), sign-up (business onboarding), pending-approval
// and password-reset screens on the 2A dialog shell. On sign-up a profile row
// is created as a pending customer. Owner access is a separate admin step, not
// part of public signup.
//
// After a sign-in the dialog waits for the account's profile: a pending or
// suspended account sees its status, an approved one closes the dialog, and a
// profile that does not load gets a message with Try again and Sign out
// instead of a silent close (AW-089). A sign-in finished in another tab
// closes the password form here too (AW-335).
//
// The dialog owns its ModalLayer. Every way out (×, Escape, Back, the
// backdrop, Done) goes through requestClose, which asks before a half-typed
// application is thrown away (AW-018); the backdrop is ignored while there
// are typed answers. The answers are not kept between openings on purpose:
// an EIN and licence numbers held in memory or sessionStorage would show to
// the next person on a shared store computer.
//
// 'Check your inbox' and 'Confirm your email first' can send the
// confirmation email again, once a minute (AW-016).

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { COMPANY, TERMS_VERSION } from '../data/content.js';
import { isRateLimitError } from '../lib/errors.js';
import { friendlyAuthError } from '../lib/authErrors.js';
import { Link, restoreOverlayEntry } from '../lib/router.js';
import { APPLICATION_CHECKLIST } from '../data/onboarding.js';
import { DOCUMENT_TYPES, documentErrorMessage, uploadSelectedProof } from '../lib/documents.js';
import { ServiceUnavailable } from './ServiceUnavailable.jsx';
import { CallOrEmail } from './ContactLinks.jsx';
import { DocumentUploads } from './DocumentUploads.jsx';
import { Icon } from './Icon.jsx';
import { ModalLayer } from './ModalLayer.jsx';

const STATES = ['AL','GA','MS','TN','FL','LA','SC','NC','KY','Other'];
const BUSINESS_TYPES = ['Convenience Store','Smoke Shop','Vape Shop','Liquor Store','Grocery / Bodega','Auto Parts','Hookah Lounge','Other'];
const VOLUMES = ['Under $5K','$5K — $15K','$15K — $50K','$50K — $100K','$100K+'];

// How long "Signing you in…" waits for the account before saying so.
export const CHECKING_TIMEOUT_MS = 10000;
// How long Resend waits before it can send the confirmation email again
// (AW-016). Supabase limits these emails too; see RESEND_RATE_LIMITED.
export const RESEND_COOLDOWN_MS = 60000;
export const RESEND_RATE_LIMITED = 'We just sent one. Wait a minute, then try again.';
// Screens that ask a signed-out visitor for something. When a session appears
// while one is open (a sign-in in another tab), the dialog moves on. The
// application form and checklist are left alone, so typed answers stay.
const SIGNED_OUT_MODES = ['signin', 'reset', 'reset-sent', 'unconfirmed'];
// Screens after a sign-in here (or in another tab): that account is the one
// in use, so typed application answers no longer need guarding.
const SIGNED_IN_MODES = ['checking', 'status', 'profile-error'];

const isUnconfirmedEmail = (err) => err?.code === 'email_not_confirmed' || /email not confirmed/i.test(err?.message || '');

// TODO(owner): Approve the consent checkbox wording. The Trade terms / Privacy
// version it records is TERMS_VERSION in ../data/content.js. (AW-019)

const EMPTY_SIGNUP = {
  email: '', password: '', name: '', business: '', phone: '',
  ein: '', license_no: '', resale_cert_no: '',
  business_type: 'Convenience Store', state: 'AL', expected_volume: '$5K — $15K',
  // The store's address (AW-092) and the two required boxes (AW-019).
  store_street: '', store_city: '', store_zip: '',
  agreeTerms: false, ageConfirmed: false,
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

export function AuthModal({ open, initialMode = 'signin', onClose, onSignOut, signingOut = false }) {
  const {
    signIn, signUp, resetPassword, resendConfirmation, refreshProfile,
    session, profile, profileReady, profileRefreshing, loading, isBackendConfigured,
  } = useAuth();
  // signin | checklist | signup | sent | status | checking | profile-error
  // | reset | reset-sent | unconfirmed
  // initialMode 'signup' starts at the checklist; 'application' skips straight to the form.
  const [mode, setMode] = useState(initialMode === 'signup' ? 'checklist' : initialMode === 'application' ? 'signup' : initialMode);
  const [afterSignup, setAfterSignup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [signin, setSignin] = useState({ email: '', password: '' });
  const [resetEmail, setResetEmail] = useState('');
  const [signup, setSignup] = useState(EMPTY_SIGNUP);
  const [proof, setProof] = useState({});
  const [proofErrors, setProofErrors] = useState({});
  const [proofWaiting, setProofWaiting] = useState(false);
  const [resent, setResent] = useState(false);
  // A confirmation email sent again: to whom, and whether the minute before
  // the next one is still running (AW-016).
  const [resentTo, setResentTo] = useState('');
  const [cooling, setCooling] = useState(false);
  // The 'Discard your application?' bar (AW-018).
  const [confirming, setConfirming] = useState(false);
  const titleRef = useRef(null);
  const dialogRef = useRef(null);
  const keepEditingRef = useRef(null);
  const resendRef = useRef(null);
  // Where focus was when the discard bar opened, for Keep editing.
  const focusBeforeConfirm = useRef(null);
  // A resend is running; see the focus effect below.
  const resending = useRef(false);
  const onCloseRef = useRef(onClose);
  // Keep the latest onClose for the timers and effects below.
  useLayoutEffect(() => { onCloseRef.current = onClose; });
  // Focus trap, inert background, Escape and focus restore come from the
  // ModalLayer this dialog is rendered in; data-autofocus marks the first field.

  // Each step swaps the dialog content, so the new step starts at the top
  // (AW-096) and its heading takes focus, also on a return to the first step
  // (AW-090). The step shown last is compared, not a first-run flag: under
  // StrictMode the effect runs twice on open, and the opening step's own
  // data-autofocus field keeps focus.
  const shownMode = useRef(mode);
  useEffect(() => {
    if (shownMode.current === mode) return;
    shownMode.current = mode;
    if (dialogRef.current) dialogRef.current.scrollTop = 0;
    titleRef.current?.focus({ preventScroll: true });
  }, [mode]);

  // The session the dialog was opened with, once auth has loaded (AW-335).
  const userId = session?.user?.id ?? null;
  const [openedWith, setOpenedWith] = useState(loading ? undefined : userId);
  if (openedWith === undefined && !loading) setOpenedWith(userId);
  const signedInMeanwhile = openedWith === null && userId !== null && SIGNED_OUT_MODES.includes(mode);

  // After a sign-in (here or in another tab), wait for the account's profile.
  const waiting = mode === 'checking' || signedInMeanwhile;
  const settled = waiting && !loading && !!session && profileReady && !profileRefreshing;
  if (settled && profile && profile.status !== 'approved') setMode('status');
  else if (settled && !profile) setMode('profile-error');
  else if (mode === 'profile-error' && !loading && !session) setMode('signin');
  const approved = settled && profile?.status === 'approved';
  useEffect(() => {
    if (approved) onCloseRef.current();
  }, [approved]);
  // A profile that takes too long gets the same message as one that failed,
  // instead of the dialog closing on its own.
  useEffect(() => {
    if (mode !== 'checking') return undefined;
    const id = window.setTimeout(() => setMode('profile-error'), CHECKING_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [mode]);

  // Resend can be used again a minute after it sent (AW-016).
  useEffect(() => {
    if (!cooling) return undefined;
    const id = window.setTimeout(() => setCooling(false), RESEND_COOLDOWN_MS);
    return () => window.clearTimeout(id);
  }, [cooling]);
  // A Resend button disabled (or hidden) while it had focus drops focus to
  // <body> (Chrome) or leaves it on a dead control. When the send has
  // finished, focus goes back to it if it can be used again (it failed),
  // else to the dialog's heading.
  useEffect(() => {
    if (!resending.current || submitting) return;
    resending.current = false;
    const active = document.activeElement;
    if (active && active !== document.body && !active.disabled && dialogRef.current?.contains(active)) return;
    const button = resendRef.current;
    (button && !button.disabled ? button : titleRef.current)?.focus({ preventScroll: true });
  }, [submitting, cooling]);

  // Typed application answers (AW-018). Guarded in every mode, so they stay
  // guarded after 'Back to the checklist' or 'Already approved? Sign in',
  // until the application is sent or a sign-in here makes it moot.
  const touched = Object.keys(EMPTY_SIGNUP).some((k) => signup[k] !== EMPTY_SIGNUP[k]) || Object.values(proof).some(Boolean);
  const dirty = touched && !afterSignup && !SIGNED_IN_MODES.includes(mode);
  if (confirming && !dirty) setConfirming(false);
  // The bar's first button takes focus, which also scrolls the bar into view.
  useEffect(() => {
    if (confirming) keepEditingRef.current?.focus();
  }, [confirming]);

  if (!open) return null;

  const keepEditing = () => {
    setConfirming(false);
    const back = focusBeforeConfirm.current;
    focusBeforeConfirm.current = null;
    const target = back && back !== document.body && back.isConnected && dialogRef.current?.contains(back) ? back : titleRef.current;
    // Scrolls the field back into view if the bar's focus scrolled it away.
    target?.focus();
  };
  // ×, Escape, Back, Done: close, unless that would throw away typed
  // answers. Then the bar asks first, and a second Escape or Back answers
  // Keep editing. restoreOverlayEntry() puts back the history entry Back
  // took, so the next Back still belongs to the dialog (AW-065).
  const requestClose = () => {
    if (confirming) {
      keepEditing();
      restoreOverlayEntry();
    } else if (dirty) {
      focusBeforeConfirm.current = document.activeElement;
      setConfirming(true);
      restoreOverlayEntry();
    } else {
      onClose();
    }
  };

  const setS = (k) => (e) => setSignin({ ...signin, [k]: e.target.value });
  const setU = (k) => (e) => setSignup({ ...signup, [k]: e.target.value });
  const switchMode = (next) => { setError(null); setMode(next); };

  const handleSignin = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try { await signIn(signin); setMode('checking'); }
    catch (err) {
      // An account whose confirmation link expired (AW-015) can ask for a new one.
      if (isUnconfirmedEmail(err)) { setResent(false); setMode('unconfirmed'); }
      // Supabase's own text is never shown (AW-084).
      else setError(friendlyAuthError(err, { what: 'Account sign-in', fallback: 'We couldn’t sign you in. Try again in a moment.' }));
    }
    finally { setSubmitting(false); }
  };

  // Sends the sign-up confirmation email to `email` again (AW-015, AW-016).
  const handleResend = async (email) => {
    resending.current = true;
    setSubmitting(true); setError(null);
    try {
      await resendConfirmation(email);
      setResent(true);
      setResentTo(email);
      setCooling(true);
    } catch (err) {
      setError(isRateLimitError(err)
        ? RESEND_RATE_LIMITED
        : friendlyAuthError(err, { what: 'Email confirmation', fallback: 'We couldn’t send a new confirmation link. Try again in a moment.' }));
    } finally { setSubmitting(false); }
  };

  const retryProfile = () => {
    setError(null);
    setMode('checking');
    refreshProfile();
  };

  const onProof = (type, file, problem) => {
    setProofErrors(prev => ({ ...prev, [type]: problem }));
    setProof(prev => ({ ...prev, [type]: file }));
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      const data = await signUp({
        ...signup,
        terms_accepted: signup.agreeTerms,
        terms_version: TERMS_VERSION,
        age_confirmed: signup.ageConfirmed,
      });
      const chosen = DOCUMENT_TYPES.some(doc => proof[doc.id]);
      let uploadError = null;
      // Email confirmation leaves no session. Hold the files and do not call storage.
      if (data?.session && chosen) {
        try { await uploadSelectedProof(data.session, proof); }
        catch (err) { uploadError = documentErrorMessage(err); }
      }
      setProofWaiting(chosen && !data?.session);
      setAfterSignup(true);
      setMode(data?.session ? 'status' : 'sent');
      if (uploadError) setError(uploadError);
    }
    catch (err) { setError(friendlyAuthError(err, { what: 'The online application', fallback: 'We couldn’t send your application. Try again in a moment.' })); }
    finally { setSubmitting(false); }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try { await resetPassword(resetEmail); setMode('reset-sent'); }
    catch (err) { setError(friendlyAuthError(err, { what: 'Password reset', fallback: 'We couldn’t send the reset link. Try again in a moment.' })); }
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
    'profile-error': 'EXISTING ACCOUNTS',
    reset: 'PASSWORD HELP',
    'reset-sent': 'PASSWORD HELP',
    unconfirmed: 'CONFIRM YOUR EMAIL',
  }[mode];
  const title = {
    signin: 'Sign in',
    checklist: 'Apply for an account',
    signup: 'Apply for an account',
    sent: 'Check your inbox',
    status: status === 'suspended' ? 'Your account needs attention' : 'Your account is pending approval',
    checking: 'Signing you in…',
    'profile-error': 'We couldn’t load your account',
    reset: 'Reset your password',
    'reset-sent': 'Check your inbox',
    unconfirmed: 'Confirm your email first',
  }[mode];
  // One string, so Google Translate cannot strand a piece of it (AW-039).
  const applicantName = profile?.name || signup.name;
  const applicantBusiness = profile?.business || signup.business;
  const statusMessage = `${afterSignup ? 'Thanks' : 'Welcome back'}${applicantName ? `, ${applicantName}` : ''}. `
    + `${applicantBusiness ? `We have the application for ${applicantBusiness}. ` : ''}`
    + `A trade rep is reviewing your license information and will contact you at ${profile?.email || signup.email} when your account is approved. Wholesale pricing and ordering unlock at that point.`;
  const unavailableWhat = { signin: 'Account sign-in', checking: 'Account sign-in', checklist: 'The online application', signup: 'The online application', reset: 'Password reset', unconfirmed: 'Email confirmation' }[mode];
  // Said once a confirmation email has gone again, until Resend can be used again.
  const resendStatus = cooling
    ? `Sent again to ${resentTo}. It can take a few minutes; check your spam folder too. You can ask for another in a minute.`
    : '';

  const dialog = (
    // Backdrop click is a mouse shortcut; Escape (ModalLayer) and the Close button are the keyboard paths.
    // With typed answers it does nothing: a stray click must not end the application (AW-018).
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <div className="overlay" onClick={dirty ? undefined : onClose}>
      {/* Keeps clicks inside the dialog from reaching the backdrop. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <div className="dialog scale-in" role="dialog" aria-modal="true" aria-labelledby="auth-title" ref={dialogRef} onClick={(e) => e.stopPropagation()}>
        {/* One header row: the step's kicker beside the ×, so the first
            field and the submit button fit a landscape phone (AW-245). */}
        <div className="dialog-top">
          <p className="kicker">{kicker}</p>
          <button className="icon-btn" type="button" onClick={requestClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        {confirming && (
          <div className="notice discard-confirm" role="group" aria-labelledby="aw-discard-title">
            <p id="aw-discard-title">Discard your application? What you’ve typed will be lost.</p>
            <div className="discard-actions">
              <button ref={keepEditingRef} className="button ghost sm" type="button" aria-describedby="aw-discard-title" onClick={keepEditing}>Keep editing</button>
              <button className="button sm" type="button" onClick={onClose}>Discard</button>
            </div>
          </div>
        )}
        <h2 id="auth-title" ref={titleRef} tabIndex={-1}>{title}</h2>

        {mode === 'signin' && <p className="desc">Sign in to view wholesale pricing, build orders and see your order history.</p>}
        {mode === 'checklist' && <p className="desc">Alabama Wholesale sells exclusively to licensed retail businesses. Have these on hand before you start — the application takes a few minutes.</p>}
        {/* TODO(owner): How long does approval actually take, what should the application promise, and is Net-30 offered (with credit verification)? Kept as published. (AW-246, AW-272, AW-025) */}
        {/* TODO(owner): A Cloudflare Turnstile site key, so Supabase can require a CAPTCHA on sign-up. (AW-206) */}
        {mode === 'signup' && <p className="desc">Alabama Wholesale sells exclusively to licensed retail businesses. Most applications are approved within one business day. Net-30 terms available with credit verification.</p>}
        {mode === 'sent' && <p className="desc">{`We sent a confirmation link to ${signup.email}. Click it to activate your account — a trade rep will verify your license within one business day.`}</p>}
        {mode === 'checking' && <p className="desc" aria-live="polite">One moment while we load your account.</p>}
        {mode === 'profile-error' && <p className="desc">We signed you in but couldn’t load your account. <CallOrEmail before="Try again, or call" after=" and a trade rep will help you." /></p>}
        {mode === 'unconfirmed' && (
          <p className="desc">{resent
            ? `We sent a new confirmation link to ${signin.email}. Open it on this device, then sign in.`
            : `${signin.email} isn’t confirmed yet. Open the confirmation link we emailed when you applied, or send a new one. Links work once and expire after a while.`}</p>
        )}
        {mode === 'reset' && <p className="desc">Enter the business email on your account and we’ll send a link to choose a new password.</p>}
        {mode === 'reset-sent' && <p className="desc">{`If an account exists for ${resetEmail}, a password reset link is on its way. The link works once — if it doesn’t arrive within a few minutes, check your spam folder or call us.`}</p>}
        {mode === 'status' && (
          status === 'suspended'
            ? <p className="desc">Ordering is paused on this account. <CallOrEmail after=" and a trade rep will help you sort it out." /></p>
            : <p className="desc">{statusMessage}</p>
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
              <button className="button" type="submit" disabled={submitting || !isBackendConfigured}><span>{submitting ? 'Signing in…' : 'Sign in'}</span></button>
              <button className="text-link" type="button" onClick={() => { setResetEmail(signin.email); switchMode('reset'); }}>Forgot password?</button>
              <button className="text-link" type="button" onClick={() => switchMode('checklist')}>No account? Apply instead</button>
            </div>
          </form>
        )}

        {mode === 'checking' && (
          <div className="dialog-actions">
            <button className="text-link" type="button" onClick={requestClose}>Continue browsing</button>
          </div>
        )}

        {mode === 'profile-error' && (
          <div className="dialog-actions">
            <button className="button" type="button" onClick={retryProfile} data-autofocus>Try again</button>
            {onSignOut && (
              <button className="text-link" type="button" onClick={onSignOut} disabled={signingOut}><span>{signingOut ? 'Signing out…' : 'Sign out'}</span></button>
            )}
            <button className="text-link" type="button" onClick={requestClose}>Continue browsing</button>
          </div>
        )}

        {mode === 'unconfirmed' && (
          <>
            <p className="form-error" role="alert">{error}</p>
            <div className="dialog-actions">
              {/* Back once the minute after a send is over (AW-016). */}
              {!cooling && (
                <button ref={resendRef} className="button" type="button" onClick={() => handleResend(signin.email)} disabled={submitting || !isBackendConfigured} data-autofocus>
                  <span>{submitting ? 'Sending…' : 'Send a new confirmation link'}</span>
                </button>
              )}
              <button className="text-link" type="button" onClick={() => switchMode('signin')}>Back to sign in</button>
            </div>
            <p className="checklist-note" role="status">{resendStatus}</p>
          </>
        )}

        {mode === 'checklist' && (
          <>
            <h3 className="checklist-heading">What you’ll need</h3>
            <ul className="checklist">
              {APPLICATION_CHECKLIST.map(item => (
                <li key={item.title}><b>{item.title}</b><span>{item.detail}</span></li>
              ))}
            </ul>
            <p className="checklist-note">Missing one of these? <CallOrEmail after=" and a trade rep can talk you through the application." /></p>
            <div className="dialog-actions">
              <button className="button" type="button" onClick={() => switchMode('signup')} data-autofocus>Continue to the application</button>
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
              <Field id="aw-su-street" label="Store street address" full>
                <input id="aw-su-street" name="address-line1" value={signup.store_street} onChange={setU('store_street')} required maxLength={200} autoComplete="address-line1" />
              </Field>
              <Field id="aw-su-city" label="City">
                <input id="aw-su-city" name="address-level2" value={signup.store_city} onChange={setU('store_city')} required maxLength={100} autoComplete="address-level2" />
              </Field>
              <Field id="aw-su-zip" label="ZIP">
                <input id="aw-su-zip" name="postal-code" value={signup.store_zip} onChange={setU('store_zip')} required maxLength={5} inputMode="numeric" pattern="[0-9]{5}" autoComplete="postal-code" title="Enter a 5-digit ZIP code" />
              </Field>
              {/* TODO(owner): Is a tobacco license required for every trade account, or only for tobacco, vapor, and nicotine? This field stays required for every application until you decide. (AW-129) */}
              <Field id="aw-su-license" label="State retail tobacco license #" hint="From the state where the store is licensed.">
                <input id="aw-su-license" name="license_no" value={signup.license_no} onChange={setU('license_no')} required autoComplete="off" aria-describedby="aw-su-license-hint" />
              </Field>
              <Field id="aw-su-resale" label="Resale certificate #" hint="Sales tax resale or exemption certificate.">
                <input id="aw-su-resale" name="resale_cert_no" value={signup.resale_cert_no} onChange={setU('resale_cert_no')} required autoComplete="off" aria-describedby="aw-su-resale-hint" />
              </Field>
              <DocumentUploads
                disabled={submitting || !isBackendConfigured}
                files={proof}
                errors={proofErrors}
                onPick={onProof}
              />
              <Field id="aw-su-volume" label="Expected monthly volume" full>
                <select id="aw-su-volume" name="expected_volume" value={signup.expected_volume} onChange={setU('expected_volume')} autoComplete="off">{VOLUMES.map(o => <option key={o}>{o}</option>)}</select>
              </Field>
            </div>
            {/* Consent and 21+ (AW-019). The policies open in a new tab so the
                answers typed here stay put. */}
            <div className="consent-block">
              <div className="consent">
                <input id="aw-su-terms" name="agreeTerms" type="checkbox" checked={signup.agreeTerms} onChange={e => setSignup({ ...signup, agreeTerms: e.target.checked })} required />
                <label htmlFor="aw-su-terms">
                  I agree to the <Link to={{ page: 'terms' }} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>Trade terms<span className="sr-only"> (opens in a new tab)</span></Link>
                  {' '}and <Link to={{ page: 'privacy' }} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>Privacy policy<span className="sr-only"> (opens in a new tab)</span></Link>
                </label>
              </div>
              <div className="consent">
                <input id="aw-su-age" name="ageConfirmed" type="checkbox" checked={signup.ageConfirmed} onChange={e => setSignup({ ...signup, ageConfirmed: e.target.checked })} required />
                <label htmlFor="aw-su-age">I am 21 or older</label>
              </div>
            </div>
            <p className="form-error" role="alert">{error}</p>
            <div className="dialog-actions">
              <button className="button" type="submit" disabled={submitting || !isBackendConfigured}><span>{submitting ? 'Creating…' : 'Submit application'}</span></button>
              <button className="text-link" type="button" onClick={() => switchMode('checklist')}>Back to the checklist</button>
              <button className="text-link" type="button" onClick={() => switchMode('signin')}>Already approved? Sign in</button>
            </div>
          </form>
        )}

        {mode === 'sent' && (
          <>
            <h3 className="checklist-heading">What happens next</h3>
            <ol className="next-steps">
              <li><b>Confirm your email.</b><span>{`Open the link we sent to ${signup.email}. If it doesn’t arrive within a few minutes, check your spam folder. Already have an account with this email? Sign in instead.`}</span></li>
              <li><b>We review your application.</b><span>A trade rep checks your EIN, state retail tobacco license and resale certificate.</span></li>
              <li><b>You hear from us.</b><span>{`We’ll contact you at ${signup.email} or ${signup.phone} when your account is approved. Wholesale pricing and ordering unlock then.`}</span></li>
            </ol>
            {proofWaiting && (
              <p className="checklist-note">Your files stay on this device until you are signed in. After you confirm your email, upload them from your application status, or send proof later to <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.</p>
            )}
            {/* No email? Send it again, once a minute (AW-016). */}
            <div className="resend">
              <button ref={resendRef} className="text-link" type="button" onClick={() => handleResend(signup.email)} disabled={submitting || cooling || !isBackendConfigured}>
                <span>{submitting ? 'Sending…' : 'Resend confirmation email'}</span>
              </button>
              <p className="checklist-note" role="status">{resendStatus}</p>
            </div>
            <p className="form-error" role="alert">{error}</p>
            <div className="dialog-actions">
              <button className="button" type="button" onClick={requestClose} data-autofocus>Done</button>
              <button className="text-link" type="button" onClick={() => switchMode('signin')}>Sign in</button>
            </div>
          </>
        )}

        {mode === 'status' && (
          <>
            {error && <p className="form-error" role="alert">{error}</p>}
            {status !== 'suspended' && (
              <>
                <h3 className="checklist-heading">While you wait</h3>
                <ul className="checklist">
                  <li><b>Browse the catalog.</b><span>You can look through every department and build a quote request now.</span></li>
                  <li><b>Pricing unlocks on approval.</b><span>Wholesale prices and checkout appear as soon as a trade rep approves the account.</span></li>
                  <li><b>Questions?</b><span><CallOrEmail /></span></li>
                </ul>
              </>
            )}
            {/* On hold, calling or emailing the trade desk is the one thing
                to do, so those are the actions (AW-097). */}
            <div className="dialog-actions">
              {status === 'suspended' ? (
                <>
                  <a className="button" href={`tel:${COMPANY.phoneRaw}`} data-autofocus>{`Call ${COMPANY.phone}`}</a>
                  <a className="button ghost" href={`mailto:${COMPANY.email}`}>Email the trade desk</a>
                </>
              ) : (
                <>
                  <Link className="button" to="/account" onClick={onClose} data-autofocus>View account status</Link>
                  <Link className="text-link" to="/catalog" onClick={onClose}>Browse the catalog</Link>
                </>
              )}
              <button className="text-link" type="button" onClick={requestClose}>Close</button>
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
              <button className="button" type="submit" disabled={submitting || !isBackendConfigured}><span>{submitting ? 'Sending…' : 'Send reset link'}</span></button>
              <button className="text-link" type="button" onClick={() => switchMode('signin')}>Back to sign in</button>
            </div>
          </form>
        )}

        {mode === 'reset-sent' && (
          <div className="dialog-actions">
            <button className="button" type="button" onClick={requestClose} data-autofocus>Done</button>
            <button className="text-link" type="button" onClick={() => switchMode('signin')}>Back to sign in</button>
          </div>
        )}

        {mode === 'signup' && <p className="fine">21+ licensed businesses only. By applying you confirm all store staff handling tobacco products meet federal and state age requirements.</p>}
      </div>
    </div>
  );
  return <ModalLayer onClose={requestClose}>{dialog}</ModalLayer>;
}
