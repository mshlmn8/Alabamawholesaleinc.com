// What /reset-password is showing, as one state (AW-255). The page head
// (eyebrow, h1, intro), the body and the tab title all follow it, so the head
// never asks for a new password where there is no form. Pure, Node-safe.
//
//   unavailable   no backend configured
//   done          the new password was saved
//   checking      a reset link is being checked, or the account is loading
//   form          signed in (by the link, or already): the new-password form
//   link-invalid  the reset link expired, was used or couldn't be checked
//   request       signed out with no link: request one by email

export const RESET_VIEWS = ['unavailable', 'done', 'checking', 'form', 'link-invalid', 'request'];

// The order matters: a saved password stays 'done' while the session is
// there, and a link being checked (or a session being loaded) is never shown
// as the signed-out view.
export function resetView({ isBackendConfigured, done, session, loading, linkChecking, linkError }) {
  if (!isBackendConfigured) return 'unavailable';
  if (done && session) return 'done';
  if (linkChecking || (loading && !session)) return 'checking';
  if (session) return 'form';
  if (linkError?.forReset) return 'link-invalid';
  return 'request';
}

const EYEBROW = 'PASSWORD HELP';
// Tab titles are in sentence case, like the h1s (AW-131).
export const RESET_TITLE = 'Reset password';

// The page head and tab title for each view. intro null: none.
// The 8 is PASSWORD_MIN_LENGTH (src/components/PasswordField.jsx); the page
// test keeps them in step.
export const RESET_HEADS = {
  unavailable: { eyebrow: EYEBROW, h1: 'Reset your password', intro: null, title: RESET_TITLE },
  request: {
    eyebrow: EYEBROW,
    h1: 'Reset your password',
    intro: 'Forgot your password? We’ll email you a link to choose a new one.',
    title: RESET_TITLE,
  },
  checking: { eyebrow: EYEBROW, h1: 'Checking your reset link', intro: null, title: RESET_TITLE },
  form: {
    eyebrow: EYEBROW,
    h1: 'Choose a new password',
    intro: 'Pick a password of at least 8 characters that you don’t use anywhere else.',
    title: RESET_TITLE,
  },
  done: { eyebrow: EYEBROW, h1: 'Password updated', intro: null, title: 'Password updated' },
  'link-invalid': { eyebrow: EYEBROW, h1: 'Link not valid', intro: null, title: 'Reset link not valid' },
};

// The head for a view. While no link is being checked, 'checking' is the
// account loading for someone who opened the page signed in.
export function resetHead(view, { linkChecking = false } = {}) {
  const head = RESET_HEADS[view] || RESET_HEADS.request;
  if (view === 'checking' && !linkChecking) return { ...head, h1: 'Loading your account' };
  return head;
}

// The tab title's page name (src/lib/meta.js); without a view, the page as
// a visitor first sees it.
export const resetTitle = (view) => (RESET_HEADS[view] || RESET_HEADS.request).title;
