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
//
// A short or mismatched password is named under the field it is about, which
// takes focus (AW-173, ValidatedForm's validate). So is a current password
// the server says is wrong (NEW-026); p#reset-error is for the server's other
// answers (too many tries, timeouts, failures).

import { useEffect, useRef, useState } from 'react';
import { AUTH_ERROR_TEXT, friendlyAuthError } from '../../lib/authErrors.js';
import { announce } from '../../lib/announce.js';
import { isRateLimitError } from '../../lib/errors.js';
import { ServiceUnavailable } from '../../components/ServiceUnavailable.jsx';
import { CallOrEmail } from '../../components/ContactLinks.jsx';
import { PASSWORD_MIN_LENGTH, PasswordField } from '../../components/PasswordField.jsx';
import { ValidatedForm } from '../../components/Field.jsx';
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
const isWeakPassword = (err) => err?.code === 'weak_password' || err?.name === 'AuthWeakPasswordError';

// Said under Current password when the server says it is wrong (NEW-026).
export const WRONG_CURRENT_PASSWORD = 'That isn’t the current password for this account.';

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
  // Counts the saves that have ended, for the focus effect (NEW-003).
  const [savesEnded, setSavesEnded] = useState(0);
  const [done, setDone] = useState(false);
  const [othersSignedOut, setOthersSignedOut] = useState(false);
  const currentRef = useRef(null);
  const submitRef = useRef(null);
  // A save that is running: whether Save had focus when it started (the
  // `disabled` it gets drops that focus to <body> in Chrome), and the field
  // a refusal is about. See the effect below (NEW-003).
  const saveFocus = useRef(null);

  // A short or mismatched new password is named under its field (AW-173);
  // an empty current password gets the field's own 'Enter current password'.
  const validate = () => ({
    'reset-password': password.length < PASSWORD_MIN_LENGTH ? `Choose a password with at least ${PASSWORD_MIN_LENGTH} characters.` : '',
    'reset-confirm': (!confirm && 'Enter the new password again.') || (password !== confirm && 'The two passwords don’t match.') || '',
  });
  // Without a reset link, the signed-in account's current password is checked
  // first (AW-349). Either way the account's other devices are signed out.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setCurrentWrong(false);
    // validate() has checked these already; a guard only.
    if (password.length < PASSWORD_MIN_LENGTH || password !== confirm) return;
    const save = { fromButton: !!submitRef.current && document.activeElement === submitRef.current, field: null };
    saveFocus.current = save;
    setSaving(true);
    try {
      if (!recovery) {
        try {
          await verifyPassword(current);
        } catch (err) {
          if (err?.code === 'wrong_password') {
            // Said under Current password, which takes focus (NEW-026).
            setCurrentWrong(true);
            save.field = 'reset-current';
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
      // A new password the server refused: the cursor goes back to it.
      if (isSamePassword(err) || isWeakPassword(err)) save.field = 'reset-password';
      // Supabase's own text is never shown (AW-084).
      setError(isSamePassword(err)
        ? AUTH_ERROR_TEXT.samePassword
        : friendlyAuthError(err, { what: 'Password reset', fallback: 'We couldn’t update the password. Try again in a moment.' }));
    } finally {
      setSaving(false);
      setSavesEnded((n) => n + 1);
    }
  };
  // When a save is refused, focus goes where it can be acted on (NEW-003):
  // a wrong current password always to that field, once its message is on
  // the page (and the message is read out if the field already had focus);
  // otherwise, only if Save had focus and lost it, to the new password the
  // server refused, else back to Save. A saved password's panel takes focus
  // in the effect further down.
  useEffect(() => {
    const save = saveFocus.current;
    if (saving || !save) return;
    saveFocus.current = null;
    if (done) return;
    const field = save.field ? document.getElementById(save.field) : null;
    const active = document.activeElement;
    if (save.field === 'reset-current') {
      if (field && field === active) announce(WRONG_CURRENT_PASSWORD);
      else field?.focus();
      return;
    }
    if (!save.fromButton || (active && active !== document.body && !active.disabled)) return;
    (field || submitRef.current)?.focus();
  }, [saving, done, savesEnded]);

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
      <ValidatedForm className="reset-form" onSubmit={handleSubmit} validate={validate} aria-labelledby="reset-form-title" aria-describedby={recovery ? 'reset-link-hint' : undefined}>
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
              {/* A wrong one is said in p#reset-current-error, under the box
                  and above 'Forgot it?' (NEW-026). */}
              <PasswordField id="reset-current" label="Current password" value={current} onChange={(e) => { setCurrent(e.target.value); setCurrentWrong(false); }} required autoComplete="current-password" inputRef={currentRef}
                error={currentWrong ? WRONG_CURRENT_PASSWORD : ''} />
              <button className="text-link" type="button" onClick={onRequestReset}>Forgot it? Email me a reset link</button>
            </div>
          )}
          {/* Show/Hide and the length rule as it is typed (AW-248). */}
          <PasswordField id="reset-password" className="full" label="New password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" showRule inputRef={passRef} />
          <PasswordField id="reset-confirm" className="full" label="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" />
        </div>
        <p className="form-error" id="reset-error" role="alert">{error}</p>
        <div className="dialog-actions">
          <button ref={submitRef} className="button" type="submit" disabled={saving}><span>{saving ? 'Saving…' : 'Save new password'}</span></button>
          {/* My account, where the session shows; not history.back(), which can leave the site. */}
          <Link className="text-link" to="/account">Cancel</Link>
          {recovery && (
            <button className="text-link" type="button" onClick={onSignOut} disabled={signingOut}>
              <span>{signingOut ? 'Signing out…' : 'Cancel and sign out'}</span>
            </button>
          )}
        </div>
      </ValidatedForm>
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
