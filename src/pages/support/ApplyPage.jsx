// Trade account application page: the "what you'll need" checklist, how the
// process works, and — for a signed-in applicant — the current approval status.
//
// The page head, intro and contact strip follow the account (AW-098): a guest
// is invited to apply, with Start application in the first screen (AW-242);
// an applicant under review sees where the application stands; an approved
// account is pointed at the catalog and its account; an account on hold is
// told who to call. While the account loads the page says nothing it might
// have to take back. App titles the page the same way (meta.js, route.applyAs).

import { COMPANY } from '../../data/content.js';
import { APPLICATION_CHECKLIST } from '../../data/onboarding.js';
import { accountStatus } from '../../lib/accountStatus.js';
import { ServiceUnavailable } from '../../components/ServiceUnavailable.jsx';
import { ApplicationDocuments } from '../../components/DocumentUploads.jsx';
import { CallOrEmail } from '../../components/ContactLinks.jsx';
import { AccountLoading } from '../../components/AccountStatus.jsx';
import { Link } from '../../lib/router.js';
import { accountStatusLabel } from '../../lib/accountLabels.js';
import { PageHead, SupportLayout, ContactStrip } from './SupportShell.jsx';

const INTRO_21 = 'Alabama Wholesale sells exclusively to licensed retail businesses — 21+, no consumer sales.';

// Per view ('guest', 'loading' and the three account statuses): the eyebrow,
// the h1 and the contact strip. A strip left out is the default one.
const VIEWS = {
  guest: { eyebrow: 'OPEN AN ACCOUNT', title: 'Apply for a trade account', strip: { eyebrow: 'RATHER TALK IT THROUGH?', title: 'Apply with a trade rep' } },
  loading: { eyebrow: 'TRADE ACCOUNT', title: 'Trade account' },
  pending: { eyebrow: 'APPLICATION UNDER REVIEW', title: 'Your trade account', strip: { eyebrow: 'QUESTIONS ABOUT YOUR APPLICATION?', title: 'Talk to a trade rep' } },
  approved: { eyebrow: 'ACCOUNT ACTIVE', title: 'Your trade account' },
  suspended: { eyebrow: 'ACCOUNT ON HOLD', title: 'Your trade account', strip: { eyebrow: 'ACCOUNT ON HOLD?', title: 'Talk to a trade rep' } },
};

// The view for an account: 'loading' until the session and profile are
// known, then accountStatus() ('guest' also when the profile didn't load).
export function applyView(profile, account) {
  return account === 'loading' ? 'loading' : accountStatus(profile);
}

function ApplyIntro({ view }) {
  if (view === 'loading') return <p>{INTRO_21}</p>;
  if (view === 'pending') {
    return <p>Your application is with a trade rep. Here is where it stands, and the license documents you can add while you wait.</p>;
  }
  if (view === 'approved') {
    return (
      <p>
        Your trade account is active. Browse <Link className="text-link" to="/catalog">the catalog</Link> with your pricing,
        see your orders in <Link className="text-link" to="/account">My account</Link>, or reorder by SKU
        with <Link className="text-link" to="/account#quick-reorder">Quick Reorder</Link>.
      </p>
    );
  }
  if (view === 'suspended') {
    return <p>Ordering is paused on this account. <CallOrEmail after=" and a trade rep will help you sort it out." /></p>;
  }
  return <p>{`${INTRO_21} Here is what to have ready, and what happens after you apply.`}</p>;
}

export function ApplyPage({ profile, account = profile ? 'ready' : 'signed-out', isBackendConfigured, onApplyClick, onLoginClick, onResetClick }) {
  // A signed-in applicant's status, not the application checklist, while
  // their account loads (AW-186).
  const loadingAccount = account === 'loading';
  const view = applyView(profile, account);
  const { eyebrow, title, strip } = VIEWS[view];
  // Start application, or the phone number without a backend.
  const applyAction = isBackendConfigured
    ? <button className="button" type="button" onClick={onApplyClick}>Start application</button>
    : <a className="button" href={`tel:${COMPANY.phoneRaw}`}>Apply by phone · {COMPANY.phone}</a>;

  return (
    <section className="support-page">
      <PageHead crumb="Trade account" eyebrow={eyebrow} title={title}>
        {/* Keyed: each view's sentence is a new paragraph, never a patch
            of the last one's text nodes (Google Translate, AW-039). */}
        <ApplyIntro key={view} view={view} />
        {/* The page's own action in the first screen, not only at the end of the checklist (AW-242). */}
        {view === 'guest' && (
          <div className="dialog-actions compact-actions">
            {applyAction}
            <button className="text-link" type="button" onClick={onLoginClick}>Already applied? Sign in</button>
          </div>
        )}
      </PageHead>
      <SupportLayout current="apply">

      {loadingAccount && <AccountLoading text="Checking for your application…" />}

      {profile && <StatusPanel profile={profile} />}

      {/* Every signed-in account can see and renew its proof (AW-254). */}
      {profile && <ApplicationDocuments status={profile.status} disabled={!isBackendConfigured} />}

      {!isBackendConfigured && <ServiceUnavailable what="The online application" className="form-error support-alert" />}

      {/* Only for someone who hasn't applied: an account on hold calls the
          trade desk instead of applying again (AW-098). */}
      {view === 'guest' && (
        <div className="apply-layout">
          <section className="checklist-card" aria-labelledby="checklist-title">
            <p className="eyebrow">WHAT YOU’LL NEED</p>
            <h2 id="checklist-title">Application checklist</h2>
            <ul className="checklist big">
              {APPLICATION_CHECKLIST.map(item => (
                <li key={item.title}>
                  <b>{item.title}</b>
                  <span>{item.detail}</span>
                </li>
              ))}
            </ul>
            <p className="checklist-note">Missing one of these? <CallOrEmail before="Call" after=" and a trade rep can talk you through it." /></p>
            <p className="checklist-note">Read the <Link className="text-link" to={{ page: 'terms' }}>Trade terms</Link> and <Link className="text-link" to={{ page: 'privacy' }}>Privacy policy</Link> before you apply.</p>
            <div className="dialog-actions">
              {applyAction}
              <button className="text-link" type="button" onClick={onLoginClick}>Already applied? Sign in</button>
            </div>
          </section>

          <section className="support-block" aria-labelledby="how-apply-title">
            <p className="eyebrow">HOW IT WORKS</p>
            <h2 id="how-apply-title">Three steps to wholesale pricing</h2>
            <ol className="next-steps">
              <li><b>Apply online.</b><span>Enter your business details, EIN, state retail tobacco license number and resale certificate number. It takes a few minutes. You will get an email to confirm your address.</span></li>
              <li><b>We verify.</b><span>A trade rep reviews the application and checks your license and resale certificate. Your account shows as pending until then — you can browse and build a quote request in the meantime.</span></li>
              <li><b>Order and receive.</b><span>Once approved, wholesale pricing and checkout unlock. Order online or by phone for delivery on our trucks when your stop is on a route in Alabama, Mississippi or Georgia, or will-call at the Birmingham warehouse.</span></li>
            </ol>
            <p className="support-note">Already have a login but can’t get in? <button className="text-link" type="button" onClick={onResetClick}>Reset your password</button>.</p>
          </section>
        </div>
      )}
      </SupportLayout>

      <ContactStrip {...strip} />
    </section>
  );
}

function StatusPanel({ profile }) {
  const status = accountStatus(profile);
  const label = accountStatusLabel(status);
  return (
    <section className={`status-panel status-${status}`} aria-labelledby="status-title">
      <div>
        <p className="eyebrow">APPLICATION STATUS</p>
        <h2 id="status-title">{label}</h2>
        {status === 'pending' && (
          <p>{`Thanks${profile.name ? `, ${profile.name}` : ''}. We have the application${profile.business ? ` for ${profile.business}` : ''}. A trade rep is reviewing your license information and will contact you at ${profile.email} when the account is approved. Wholesale pricing and ordering unlock at that point.`}</p>
        )}
        {status === 'approved' && (
          <p>{`${profile.business || profile.name} is approved for wholesale pricing and ordering. Prices show on every product while you are signed in.`}</p>
        )}
        {/* The intro above says who to call (AW-098). */}
        {status === 'suspended' && (
          <p>Ordering stays paused until a trade rep reactivates the account. If your license or resale certificate has changed, upload the new one below.</p>
        )}
      </div>
      <div className="contact-strip-actions">
        <Link className="button" to="/account"><span>{status === 'approved' ? 'My account' : 'View account'}</span></Link>
        <Link className="button ghost" to="/catalog">Browse the catalog</Link>
      </div>
    </section>
  );
}
