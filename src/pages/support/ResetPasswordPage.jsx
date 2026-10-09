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

import { useEffect, useState } from 'react';
import { friendlyAuthError } from '../../lib/authErrors.js';
import { ServiceUnavailable } from '../../components/ServiceUnavailable.jsx';
import { CallOrEmail } from '../../components/ContactLinks.jsx';
import { PASSWORD_MIN_LENGTH, PasswordField } from '../../components/PasswordField.jsx';
import { Link } from '../../lib/router.js';
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

// onViewChange(view) lets App title the page.
export function ResetPasswordPage({ auth, onRequestReset, onLoginClick, onViewChange }) {
  const { session, loading, recovery, linkError, linkChecking, updatePassword, isBackendConfigured } = auth;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError('Choose a password with at least 8 characters.'); return; }
    if (password !== confirm) { setError('The two passwords don’t match.'); return; }
    setSaving(true);
    try { await updatePassword(password); setDone(true); }
    // Supabase's own text is never shown (AW-084).
    catch (err) { setError(friendlyAuthError(err, { what: 'Password reset', fallback: 'We couldn’t update the password. Try again in a moment.' })); }
    finally { setSaving(false); }
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

  let body = null;
  if (view === 'unavailable') {
    body = <ServiceUnavailable what="Password reset" className="form-error support-alert" />;
  } else if (view === 'done') {
    body = (
      <div className="status-panel status-approved">
        <div>
          <p className="eyebrow">ALL SET</p>
          <h2>New password saved</h2>
          <p>You are signed in with your new password. Use it the next time you sign in.</p>
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
    body = (
      <form className="reset-form" onSubmit={handleSubmit} aria-labelledby="reset-form-title">
        <p className="eyebrow">{recovery ? 'RESET LINK CONFIRMED' : 'SIGNED IN'}</p>
        <h2 id="reset-form-title">{`New password for ${session.user?.email}`}</h2>
        <div className="form-grid">
          {/* Show/Hide and the length rule as it is typed (AW-248). */}
          <PasswordField id="reset-password" className="full" label="New password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" showRule data-autofocus />
          <PasswordField id="reset-confirm" className="full" label="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" />
        </div>
        <p className="form-error" role="alert">{error}</p>
        <div className="dialog-actions">
          <button className="button" type="submit" disabled={saving}><span>{saving ? 'Saving…' : 'Save new password'}</span></button>
          <Link className="text-link" to="/">Cancel</Link>
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
    <section className="support-page">
      <PageHead crumb="Password reset" eyebrow={head.eyebrow} title={head.h1}>
        {head.intro && <p>{head.intro}</p>}
      </PageHead>
      <div className="reset-layout">{body}</div>
    </section>
  );
}
