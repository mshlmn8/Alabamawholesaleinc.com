// New-password page at /reset-password. The recovery link in the reset email
// opens it (src/lib/authLink.js turns the link into this address, once), and
// a signed-in account can open it directly. It is an ordinary page: the
// header, footer, links and Back all work while it is showing (AW-015).
//
// App keys it by account, so signing out ends a half-done or finished reset
// and shows the signed-out view, not "link expired".
//
// What it shows is one state, resetView() (AW-255): the page head, the body
// and, through onViewChange, the tab title all follow it.

import { useEffect, useRef, useState } from 'react';
import { AUTH_ERROR_TEXT, friendlyAuthError } from '../../lib/authErrors.js';
import { isRateLimitError } from '../../lib/errors.js';
import { ServiceUnavailable } from '../../components/ServiceUnavailable.jsx';
import { CallOrEmail } from '../../components/ContactLinks.jsx';
import { PASSWORD_MIN_LENGTH, PasswordField } from '../../components/PasswordField.jsx';
import { Link, useLocation } from '../../lib/router.js';
import { PageHead } from './SupportShell.jsx';
import { resetHead, resetView } from './resetView.js';

// The checking view shows only after this long, so a quick check, or a
// session that is already there, never flashes it (AW-263).
export const CHECKING_DELAY_MS = 300;

// What a reset link that did not work says. Supabase's own description is
// never shown: anyone can write text into a link.
function linkProblem(linkError) {
  if (linkError.network) {
    return {
      title: 'We couldn’t check this reset link',
      text: 'Check your connection, then open the link from your email again. It works until it expires.',
    };
  }
  return {
    title: 'This reset link has expired or was already used',
    text: 'Reset links work once and expire after a short time. Request a new one and open it on the same device.',
  };
}

// Supabase's answer when the new password is the one already set. Older
// Auth servers send no code, only the 422 and its message.
const isSamePassword = (err) => err?.code === 'same_password'
  || (err?.status === 422 && /different from the old password/i.test(err?.message || ''));

// onSignOut is App's Sign Out, which also clears the guest cart, the receipt
// and the age confirmation: never auth.signOut here. onViewChange(view) lets
// App title the page.
export function ResetPasswordPage({ auth, onRequestReset, onLoginClick, onSignOut, signingOut = false, onViewChange }) {
  const { session, loading, recovery, linkError, linkChecking, verifyPassword, updatePassword, isBackendConfigured } = auth;
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [currentWrong, setCurrentWrong] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [othersSignedOut, setOthersSignedOut] = useState(false);
  const currentRef = useRef(null);

  // Without a reset link, the signed-in account's current password is checked
  // first (AW-349). Either way the account's other devices are signed out.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setCurrentWrong(false);
    if (password.length < 8) { setError('Choose a password with at least 8 characters.'); return; }
    if (password !== confirm) { setError('The two passwords don’t match.'); return; }
    setSaving(true);
    try {
      if (!recovery) {
        try {
          await verifyPassword(current);
        } catch (err) {
          if (err?.code === 'wrong_password') {
            setError('That isn’t the current password for this account.');
            setCurrentWrong(true);
            currentRef.current?.focus();
            return;
          }
          if (isRateLimitError(err) || err?.code === 'over_request_rate_limit') {
            setError('Too many tries. Wait a few minutes, then try again.');
            return;
          }
          throw err;
        }
      }
      const result = await updatePassword(password);
      setOthersSignedOut(result?.othersSignedOut === true);
      setDone(true);
    } catch (err) {
      // Supabase's own text is never shown (AW-084).
      setError(isSamePassword(err)
        ? AUTH_ERROR_TEXT.samePassword
        : friendlyAuthError(err, { what: 'Password reset', fallback: 'We couldn’t update the password. Try again in a moment.' }));
    } finally {
      setSaving(false);
    }
  };

  const view = resetView({ isBackendConfigured, done, session, loading, linkChecking, linkError });
  const head = resetHead(view, { linkChecking });
  useEffect(() => { onViewChange?.(view); }, [view, onViewChange]);

  const [checkingShown, setCheckingShown] = useState(false);
  if (view !== 'checking' && checkingShown) setCheckingShown(false);
  useEffect(() => {
    if (view !== 'checking') return undefined;
    const timer = window.setTimeout(() => setCheckingShown(true), CHECKING_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [view]);

  // Focus follows the state (AW-256). Once the link or the account has been
  // checked, the cursor goes to the new password, unless focus has moved
  // elsewhere meanwhile. App remounts the page when the session arrives (it
  // is keyed by account), so the form also takes focus when it is the first
  // view of a page that was loaded rather than navigated to: the email link
  // and a reload. After a navigation the router has focused the h1, and the
  // form leaves it there. A saved password moves focus from the Save button,
  // which is gone, to the panel that says so.
  const loaded = useLocation().action === 'load';
  const sectionRef = useRef(null);
  const passRef = useRef(null);
  const doneRef = useRef(null);
  const shownView = useRef(null);
  useEffect(() => {
    const previous = shownView.current;
    shownView.current = view;
    if (previous === view) return;
    if (view === 'done') {
      doneRef.current?.focus();
    } else if (view === 'form' && (previous === 'checking' || (previous === null && loaded))) {
      const active = document.activeElement;
      // The first field: the current password without a reset link (AW-349).
      if (!active || active === document.body || active.id === 'main' || sectionRef.current?.contains(active)) (recovery ? passRef : currentRef).current?.focus();
    }
  }, [view, loaded, recovery]);

  let body = null;
  if (view === 'unavailable') {
    body = <ServiceUnavailable what="Password reset" className="form-error support-alert" />;
  } else if (view === 'done') {
    body = (
      <div className="status-panel status-approved" role="status">
        <div>
          <p className="eyebrow">ALL SET</p>
          <h2 ref={doneRef} tabIndex={-1}>New password saved</h2>
          <p>
            <span>You are signed in with your new password. Use it the next time you sign in.</span>{' '}
            <span>{othersSignedOut
              ? 'Other devices signed in to this account have been signed out.'
              : 'We couldn’t sign out your other devices. To be sure, use Sign out of all devices on your account page.'}</span>
          </p>
        </div>
        <div className="contact-strip-actions">
          <Link className="button" to="/account">Go to my account</Link>
          <Link className="button ghost" to="/catalog">Browse the catalog</Link>
        </div>
      </div>
    );
  } else if (view === 'checking') {
    // In the form's frame, after a short wait (AW-263).
    body = checkingShown && (
      <div className="reset-form" role="status" aria-busy="true">
        <p className="eyebrow">{linkChecking ? 'CHECKING YOUR LINK' : 'LOADING'}</p>
        <p className="support-note">{linkChecking ? 'Checking your reset link…' : 'Loading your account…'}</p>
      </div>
    );
  } else if (view === 'form') {
    // The email on a line of its own that wraps anywhere (AW-262). A reset
    // link signed the account in on this device: the form says so, and
    // offers to sign out again (AW-253).
    body = (
      <form className="reset-form" onSubmit={handleSubmit} aria-labelledby="reset-form-title" aria-describedby={recovery ? 'reset-link-hint' : undefined}>
        <p className="eyebrow">{recovery ? 'RESET LINK CONFIRMED' : 'YOUR ACCOUNT'}</p>
        <h2 id="reset-form-title">Set a new password</h2>
        <p className="reset-account">For <strong>{session.user?.email}</strong></p>
        {recovery && (
          <p className="field-hint" id="reset-link-hint">Opening this link signed you in on this device. Save a new password, or choose ‘Cancel and sign out’.</p>
        )}
        <div className="form-grid">
          {/* The current password first, without a reset link (AW-349). */}
          {!recovery && (
            <div className="full">
              <PasswordField id="reset-current" label="Current password" value={current} onChange={(e) => { setCurrent(e.target.value); setCurrentWrong(false); }} required autoComplete="current-password" inputRef={currentRef}
                aria-invalid={currentWrong || undefined} aria-describedby={currentWrong ? 'reset-error' : undefined} />
              <button className="text-link" type="button" onClick={onRequestReset}>Forgot it? Email me a reset link</button>
            </div>
          )}
          {/* Show/Hide and the length rule as it is typed (AW-248). */}
          <PasswordField id="reset-password" className="full" label="New password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" showRule inputRef={passRef} />
          <PasswordField id="reset-confirm" className="full" label="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" />
        </div>
        <p className="form-error" id="reset-error" role="alert">{error}</p>
        <div className="dialog-actions">
          <button className="button" type="submit" disabled={saving}><span>{saving ? 'Saving…' : 'Save new password'}</span></button>
          {/* My account, where the session shows; not history.back(), which can leave the site. */}
          <Link className="text-link" to="/account">Cancel</Link>
          {recovery && (
            <button className="text-link" type="button" onClick={onSignOut} disabled={signingOut}>
              <span>{signingOut ? 'Signing out…' : 'Cancel and sign out'}</span>
            </button>
          )}
        </div>
      </form>
    );
  } else if (view === 'link-invalid') {
    const problem = linkProblem(linkError);
    body = (
      <div className="status-panel status-suspended">
        <div>
          <p className="eyebrow">RESET LINK</p>
          <h2>{problem.title}</h2>
          <p><span>{problem.text}</span> Or <CallOrEmail before="call" after=" and a trade rep will help you get back in." /></p>
        </div>
        <div className="contact-strip-actions">
          <button className="button" type="button" onClick={onRequestReset}>Request a new reset link</button>
          <button className="button ghost" type="button" onClick={onLoginClick}>Sign in</button>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="status-panel status-pending">
        <div>
          <p className="eyebrow">RESET BY EMAIL</p>
          <h2>Request a reset link</h2>
          <p>We’ll email a link to the business address on your account. Open it on this device to choose a new password. Locked out completely? <CallOrEmail before="Call" after="." /></p>
        </div>
        <div className="contact-strip-actions">
          <button className="button" type="button" onClick={onRequestReset}>Request a reset link</button>
          <button className="button ghost" type="button" onClick={onLoginClick}>Sign in</button>
        </div>
      </div>
    );
  }

  return (
    <section className="support-page" ref={sectionRef}>
      <PageHead crumb="Password reset" eyebrow={head.eyebrow} title={head.h1}>
        {head.intro && <p>{head.intro}</p>}
      </PageHead>
      <div className="reset-layout">{body}</div>
    </section>
  );
}
