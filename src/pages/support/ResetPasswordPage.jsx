// New-password page at /reset-password. The recovery link in the reset email
// opens it (src/lib/authLink.js turns the link into this address, once), and
// a signed-in account can open it directly. It is an ordinary page: the
// header, footer, links and Back all work while it is showing (AW-015).
//
// App keys it by account, so signing out ends a half-done or finished reset
// and shows the signed-out view, not "link expired".

import { useRef, useState } from 'react';
import { describeError, isRateLimitError } from '../../lib/errors.js';
import { ServiceUnavailable } from '../../components/ServiceUnavailable.jsx';
import { CallOrEmail } from '../../components/ContactLinks.jsx';
import { Link } from '../../lib/router.js';
import { PageHead } from './SupportShell.jsx';

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

export function ResetPasswordPage({ auth, onRequestReset, onLoginClick }) {
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
      setError(isSamePassword(err)
        ? 'Choose a password that’s different from your current one.'
        : describeError(err, 'Password reset', 'We couldn’t update the password.'));
    } finally {
      setSaving(false);
    }
  };

  let body;
  if (!isBackendConfigured) {
    body = <ServiceUnavailable what="Password reset" className="form-error support-alert" />;
  } else if (done && session) {
    body = (
      <div className="status-panel status-approved">
        <div>
          <p className="eyebrow">ALL SET</p>
          <h2>Password updated</h2>
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
  } else if (linkChecking || (loading && !session)) {
    body = <p className="support-note" role="status">{linkChecking ? 'Checking your reset link…' : 'Loading your account…'}</p>;
  } else if (session) {
    body = (
      <form className="reset-form" onSubmit={handleSubmit} aria-labelledby="reset-form-title">
        <p className="eyebrow">{recovery ? 'RESET LINK CONFIRMED' : 'SIGNED IN'}</p>
        <h2 id="reset-form-title">{`New password for ${session.user?.email}`}</h2>
        <div className="form-grid">
          {!recovery && (
            <div className="full">
              <label htmlFor="reset-current">Current password</label>
              <input id="reset-current" ref={currentRef} type="password" value={current} onChange={(e) => { setCurrent(e.target.value); setCurrentWrong(false); }} required autoComplete="current-password"
                aria-invalid={currentWrong || undefined} aria-describedby={currentWrong ? 'reset-error' : undefined} />
              <button className="text-link" type="button" onClick={onRequestReset}>Forgot it? Email me a reset link</button>
            </div>
          )}
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
        <p className="form-error" id="reset-error" role="alert">{error}</p>
        <div className="dialog-actions">
          <button className="button" type="submit" disabled={saving}><span>{saving ? 'Saving…' : 'Save new password'}</span></button>
          <Link className="text-link" to="/">Cancel</Link>
        </div>
      </form>
    );
  } else if (linkError?.forReset) {
    const problem = linkProblem(linkError);
    body = (
      <div className="status-panel status-suspended">
        <div>
          <p className="eyebrow">LINK NOT VALID</p>
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
      <PageHead crumb="Password reset" eyebrow="PASSWORD HELP" title="Choose a new password">
        <p>Pick a password of at least 8 characters that you don’t use anywhere else. Your trade account stays signed in once it is saved.</p>
      </PageHead>
      <div className="reset-layout">{body}</div>
    </section>
  );
}
