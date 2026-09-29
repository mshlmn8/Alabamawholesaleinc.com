// Full-page 21+ confirmation shown before the storefront on a first visit.

export function AgeGate({ onYes, onNo, tooYoung }) {
  return (
    <div className="age-gate" role="dialog" aria-modal="true" aria-labelledby="age-gate-title">
      <div className="inner fade-in">
        <div className="brand"><span>Alabama</span><small>WHOLESALE INC.</small></div>
        {!tooYoung ? (
          <>
            <h1 id="age-gate-title">Are you <em>21 or older?</em></h1>
            <p>This site lists tobacco and vapor products for licensed retail businesses. Access is restricted to trade accounts and adults 21 years or older.</p>
            <div className="btn-row">
              <button className="button" onClick={onYes}>Yes, I am 21+ <span aria-hidden="true">↗</span></button>
              <button className="button ghost" onClick={onNo}>No, exit</button>
            </div>
          </>
        ) : (
          <>
            <h1>We&apos;re sorry —</h1>
            <p>You must be 21 years or older to enter this site.</p>
          </>
        )}
      </div>
    </div>
  );
}
