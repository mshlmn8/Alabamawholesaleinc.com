// Trade account application page: the "what you'll need" checklist, how the
// process works, and — for a signed-in applicant — the current approval status.

import { COMPANY } from '../../data/content.js';
import { APPLICATION_CHECKLIST } from '../../data/onboarding.js';
import { ServiceUnavailable } from '../../components/ServiceUnavailable.jsx';
import { ApplicationDocuments } from '../../components/DocumentUploads.jsx';
import { CallOrEmail } from '../../components/ContactLinks.jsx';
import { PageHead, ContactStrip } from './SupportShell.jsx';

export function ApplyPage({ goHome, navigate, profile, isBackendConfigured, onApplyClick, onLoginClick, onResetClick }) {
  const status = profile?.status;

  return (
    <section className="support-page">
      <PageHead goHome={goHome} crumb="Trade account" eyebrow="OPEN AN ACCOUNT" title={profile ? 'Your trade account' : 'Apply for a trade account'}>
        <p>Alabama Wholesale sells exclusively to licensed retail businesses — 21+, no consumer sales. Here is what to have ready, and what happens after you apply.</p>
      </PageHead>

      {profile && <StatusPanel profile={profile} navigate={navigate} />}

      {profile?.status === 'pending' && <ApplicationDocuments disabled={!isBackendConfigured} />}

      {!isBackendConfigured && <ServiceUnavailable what="The online application" className="form-error support-alert" />}

      {(!profile || status === 'suspended') && (
        <div className="apply-layout">
          <section className="checklist-card" aria-labelledby="checklist-title">
            <p className="eyebrow">WHAT YOU’LL NEED</p>
            <h2 id="checklist-title">Application checklist</h2>
            <ul className="checklist big">
              {APPLICATION_CHECKLIST.map((item, i) => (
                <li key={item.title}>
                  <b>{String(i + 1).padStart(2, '0')} · {item.title}</b>
                  <span>{item.detail}</span>
                </li>
              ))}
            </ul>
            <p className="checklist-note">Missing one of these? <CallOrEmail before="Call" after=" and a trade rep can talk you through it." /></p>
            <div className="dialog-actions">
              {isBackendConfigured
                ? <button className="button" type="button" onClick={onApplyClick}>Start application <span aria-hidden="true">↗</span></button>
                : <a className="button" href={`tel:${COMPANY.phoneRaw}`}>Apply by phone · {COMPANY.phone} <span aria-hidden="true">↗</span></a>}
              {!profile && <button className="text-link" type="button" onClick={onLoginClick}>Already applied? Sign in</button>}
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

      <ContactStrip navigate={navigate} eyebrow="RATHER TALK IT THROUGH?" title="Apply with a trade rep" />
    </section>
  );
}

function StatusPanel({ profile, navigate }) {
  const status = profile.status || 'pending';
  const label = { pending: 'Pending approval', approved: 'Approved', suspended: 'On hold' }[status] || status;
  return (
    <section className={`status-panel status-${status}`} aria-labelledby="status-title">
      <div>
        <p className="eyebrow">APPLICATION STATUS</p>
        <h2 id="status-title">{label}</h2>
        {status === 'pending' && (
          <p>Thanks{profile.name ? `, ${profile.name}` : ''}. We have the application{profile.business ? ` for ${profile.business}` : ''}. A trade rep is reviewing your license information and will contact you at {profile.email} when the account is approved. Wholesale pricing and ordering unlock at that point.</p>
        )}
        {status === 'approved' && (
          <p>{profile.business || profile.name} is approved for wholesale pricing and ordering. Prices show on every product while you are signed in.</p>
        )}
        {status === 'suspended' && (
          <p>Ordering is paused on this account. <CallOrEmail before="Call" after=" and a trade rep will help you sort it out." /></p>
        )}
      </div>
      <div className="contact-strip-actions">
        <button className="button" type="button" onClick={() => navigate({ page: 'account' })}>{status === 'approved' ? 'My account' : 'View account'} <span aria-hidden="true">↗</span></button>
        <button className="button ghost" type="button" onClick={() => navigate({ page: 'catalog' })}>Browse the catalog</button>
      </div>
    </section>
  );
}
