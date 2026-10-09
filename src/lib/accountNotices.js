// Which account notices the page shows (rendered by SiteNotices), and the
// wording. Pure, so the rules are unit-tested.
//
//   link-error      an email link that expired, was used already or did not
//                   work (AW-015). A link meant for the new-password page is
//                   explained on that page instead.
//   link-confirmed  a sign-up confirmation link signed the buyer in; an
//                   account under review is pointed at its status (AW-016)
//   session-ended   the session ended without a sign-out in this tab (AW-048);
//                   the cart switched to the guest cart with it (AW-189)
//   connection      a saved session could not be refreshed: Supabase is out
//                   of reach
//   no-profile      signed in, but the account's profile did not load
//                   (AW-089); /account and /admin explain it in the page
//   signed-out      the result of Sign Out (AW-336), on the page it led to

// Said when a buyer signs out with items in the cart: the cart is kept for
// the account on this device, out of sight of the next person (AW-189).
export const CART_KEPT_NOTE = 'The items you added are saved on this computer for your next sign-in.';

// What a finished sign-out says. A local sign-out that could not reach
// Supabase still cleared this browser (AW-047); a global one may have left
// other devices signed in (AW-337). cartSaved: the account's cart had items.
export function signOutMessage({ ok, scope } = {}, { cartSaved = false } = {}) {
  let text;
  if (scope === 'global') {
    text = ok
      ? 'You’re signed out on all your devices.'
      : 'You’re signed out on this computer. We couldn’t reach the server, so your other devices may still be signed in. When you’re back online, sign in and choose “Sign out of all devices” again.';
  } else {
    text = ok ? 'You’re signed out.' : 'You’re signed out on this computer.';
  }
  return cartSaved ? `${text} ${CART_KEPT_NOTE}` : text;
}

function linkErrorNotice(linkError, act) {
  if (linkError.network) {
    return {
      id: 'link-error',
      tone: 'warn',
      title: 'We couldn’t check that email link',
      text: 'Check your connection, then open the link from your email again.',
      onDismiss: act.dismissLink,
    };
  }
  return {
    id: 'link-error',
    tone: 'warn',
    title: linkError.code === 'otp_expired' ? 'That email link has expired or was already used' : 'That email link didn’t work',
    text: 'Links in our emails work once and expire after a while. Sign in to continue, or if you were resetting your password, ask for a new reset link.',
    actions: [
      { id: 'sign-in', label: 'Sign in', onClick: act.signIn },
      { id: 'reset', label: 'Reset password', onClick: act.requestReset },
    ],
    onDismiss: act.dismissLink,
  };
}

// After a confirmation link (AW-016). The notice waits while the account
// loads, so it appears, and is read out, once and with the right wording:
// an application under review gets its next step, any other account (or
// one whose profile did not load) the plain confirmation.
function linkConfirmedNotice(state, act) {
  if (state.profileStatus === 'pending') {
    return {
      id: 'link-confirmed',
      title: 'Your email is confirmed',
      text: 'You’re signed in. Your application is waiting for review — see its status and add your license documents on your trade account page.',
      // No link to the page the buyer is already on.
      actions: state.routePage === 'apply' ? [] : [{ id: 'view-application', label: 'View application status', onClick: act.viewApplication }],
      onDismiss: act.dismissLink,
    };
  }
  return {
    id: 'link-confirmed',
    text: 'Your email is confirmed and you’re signed in.',
    onDismiss: act.dismissLink,
  };
}

// state: { linkError, linkConfirmed, sessionEnded, connectionProblem, account,
//          profileStatus, routePage, signOutText, signingOut, retrying }
// act:   { signIn, requestReset, signOutHere, retryProfile, dismissLink,
//          viewApplication, dismissSessionEnded, dismissConnectionProblem,
//          dismissSignOut }
export function accountNotices(state, act) {
  const notices = [];
  if (state.linkError && !state.linkError.forReset) notices.push(linkErrorNotice(state.linkError, act));
  if ((state.linkConfirmed === 'signup' || state.linkConfirmed === 'email') && state.account !== 'loading') {
    notices.push(linkConfirmedNotice(state, act));
  }
  if (state.sessionEnded) {
    notices.push({
      id: 'session-ended',
      tone: 'warn',
      title: 'Your session has ended',
      // The account's cart is put away with the session and comes back when
      // the buyer signs in again (AW-189).
      text: 'Sign in again to see your account pricing and the items you added, and to place orders.',
      actions: [{ id: 'sign-in', label: 'Sign in', onClick: act.signIn }],
      onDismiss: act.dismissSessionEnded,
    });
  }
  if (state.connectionProblem) {
    notices.push({
      id: 'connection',
      tone: 'warn',
      title: 'We can’t reach your account right now',
      text: 'You’re shown as signed out until the connection comes back. We’ll keep trying.',
      actions: [{ id: 'sign-out', label: state.signingOut ? 'Signing out…' : 'Sign out on this computer', onClick: act.signOutHere, disabled: state.signingOut }],
      onDismiss: act.dismissConnectionProblem,
    });
  }
  if (state.account === 'no-profile' && state.routePage !== 'account' && state.routePage !== 'admin') {
    notices.push({
      id: 'no-profile',
      tone: 'warn',
      title: 'Your account details didn’t load',
      text: 'Prices and ordering need them. Try again, or sign out and back in.',
      actions: [
        { id: 'retry', label: state.retrying ? 'Trying again…' : 'Try again', onClick: act.retryProfile, disabled: state.retrying },
        { id: 'sign-out', label: state.signingOut ? 'Signing out…' : 'Sign out', onClick: act.signOutHere, disabled: state.signingOut },
      ],
    });
  }
  if (state.signOutText) {
    notices.push({ id: 'signed-out', text: state.signOutText, onDismiss: act.dismissSignOut });
  }
  return notices;
}
