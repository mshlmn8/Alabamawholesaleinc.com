// What account pages show while the session and profile are still loading
// (AW-186, AW-087), and when a signed-in account's profile could not be
// loaded (AW-089), instead of a signed-out or "access denied" view.

import { CallOrEmail } from './ContactLinks.jsx';

export function AccountLoading({ text = 'Loading your account…' }) {
  return <p className="result-note account-loading">{text}</p>;
}

export function AccountProblem({ onRetry, onSignOut, retrying = false, signingOut = false }) {
  return (
    <div className="notice account-problem">
      <p>You’re signed in, but your account details didn’t load. <CallOrEmail before="Try again, or call" after=" and a trade rep will help you." /></p>
      <div className="dialog-actions compact-actions">
        {onRetry && (
          <button className="button" type="button" onClick={onRetry} disabled={retrying}>
            <span>{retrying ? 'Trying again…' : 'Try again'}</span> <span aria-hidden="true">↗</span>
          </button>
        )}
        {onSignOut && (
          <button className="text-link" type="button" onClick={onSignOut} disabled={signingOut}>
            <span>{signingOut ? 'Signing out…' : 'Sign out'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
