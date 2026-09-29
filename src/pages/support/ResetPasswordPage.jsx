// New-password page. Reached from the recovery link in the reset email (the
// storefront recognises the recovery fragment and shows this page), or
// directly at /reset-password by a signed-in account.

import { useState } from 'react';
import { describeError } from '../../lib/errors.js';
import { ServiceUnavailable } from '../../components/ServiceUnavailable.jsx';
import { CallOrEmail } from '../../components/ContactLinks.jsx';
import { Link } from '../../lib/router.js';
import { PageHead } from './SupportShell.jsx';

export function ResetPasswordPage({ auth, onRequestReset, onLoginClick }) {
  const { session, loading, recovery, linkError, updatePassword, clearRecovery, isBackendConfigured } = auth;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Leaving the page (any of its links) ends the account-link state.
  const finish = () => clearRecovery();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError('Choose a password with at least 8 characters.'); return; }
    if (password !== confirm) { setError('The two passwords don’t match.'); return; }
    setSaving(true);
    try { await updatePassword(password); setDone(true); }
    catch (err) { setError(describeError(err, 'Password reset', 'We couldn’t update the password.')); }
    finally { setSaving(false); }
  };

  let body;
  if (!isBackendConfigured) {
    body = <ServiceUnavailable what="Password reset" className="form-error support-alert" />;
  } else if (done) {
    body = (
      <div className="status-panel status-approved">
        <div>
          <p className="eyebrow">ALL SET</p>
          <h2>Password updated</h2>
          <p>You are signed in with your new password. Use it the next time you sign in.</p>
        </div>
        <div className="contact-strip-actions">
          <Link className="button" to="/account" onClick={finish}>Go to my account <span aria-hidden="true">↗</span></Link>
          <Link className="button ghost" to="/catalog" onClick={finish}>Browse the catalog</Link>
        </div>
      </div>
    );
  } else if (loading && !session) {
    body = <p className="support-note" role="status">Checking your reset link…</p>;
  } else if (session) {
    body = (
      <form className="reset-form" onSubmit={handleSubmit} aria-labelledby="reset-form-title">
        <p className="eyebrow">{recovery ? 'RESET LINK CONFIRMED' : 'SIGNED IN'}</p>
        <h2 id="reset-form-title">{`New password for ${session.user?.email}`}</h2>
        <div className="form-grid">
          <div className="full">
            <label htmlFor="reset-password">New password</label>
            <input id="reset-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" aria-describedby="reset-password-hint" data-autofocus />
            <small className="field-hint" id="reset-password-hint">At least 8 characters.</small>
          </div>
          <div className="full">
            <label htmlFor="reset-confirm">Confirm new password</label>
            <input id="reset-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
          </div>
        </div>
        <p className="form-error" role="alert">{error}</p>
        <div className="dialog-actions">
          <button className="button" type="submit" disabled={saving}><span>{saving ? 'Saving…' : 'Save new password'}</span> <span aria-hidden="true">↗</span></button>
          <Link className="text-link" to="/" onClick={finish}>Cancel</Link>
        </div>
      </form>
    );
  } else {
    const fromLink = recovery || !!linkError;
    body = (
      <div className={`status-panel ${fromLink ? 'status-suspended' : 'status-pending'}`}>
        <div>
          <p className="eyebrow">{fromLink ? 'LINK NOT VALID' : 'RESET BY EMAIL'}</p>
          <h2>{fromLink ? 'This link has expired or was already used' : 'Request a reset link'}</h2>
          {fromLink
            ? <p><span>{linkError ? `${linkError.replace(/\.$/, '')}. ` : ''}</span>Reset links work once and expire after a short time. Request a new one and open it from the same device, or <CallOrEmail before="call" after=" and a trade rep will help you get back in." /></p>
            : <p>We’ll email a link to the business address on your account. Open it on this device to choose a new password. Locked out completely? <CallOrEmail before="Call" after="." /></p>}
        </div>
        <div className="contact-strip-actions">
          <button className="button" type="button" onClick={onRequestReset}>Request a new reset link <span aria-hidden="true">↗</span></button>
          <button className="button ghost" type="button" onClick={onLoginClick}>Sign in</button>
        </div>
      </div>
    );
  }

  return (
    <section className="support-page">
      <PageHead onHome={finish} crumb="Password reset" eyebrow="PASSWORD HELP" title="Choose a new password">
        <p>Pick a password of at least 8 characters that you don’t use anywhere else. Your trade account stays signed in once it is saved.</p>
      </PageHead>
      <div className="reset-layout">{body}</div>
    </section>
  );
}
