// Admin -> Pricing (/admin/pricing, AW-114): the pricing tiers, each with its
// key (read-only) and its discount off the list price, which staff change
// here instead of in SQL. Each changed tier is one checked update
// (`.update().eq('tier', t).select('tier')`), which the live database's
// pricing_tiers_admin_write policy already allows; 20261010121000 adds the
// 0-to-under-100 check the form also makes. Tiers are not added or removed
// here (accounts point at them; see BACKEND.md). The tiers' label column is
// not shown or edited (NEW-078): buyers and staff see a tier by its key's
// name and its discount (tierPriceNote), which the hint quotes.

import { useEffect, useId, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { tierPriceNote } from '../../lib/pricing.js';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { LoadProblem } from './AdminStatus.jsx';
import { useLeaveGuard } from './useLeaveGuard.js';
import { NO_ROWS, adminErrorMessage, checkedWrite, withStatus } from './adminData.js';
import { changeText, draftOf, tierChanges, validateTier } from './pricingTiers.js';

export const PRICES_NOTE = 'Approved buyers see the new prices on their next page load; orders already saved keep their prices.';

// One tier's update, read back. Returns checkedWrite's { data, error }.
export function saveTier(client, change) {
  return checkedWrite(
    client.from('pricing_tiers').update({ discount_pct: change.discount_pct }).eq('tier', change.tier),
    'tier',
  );
}

// A refused tier save, in staff wording.
export function tierSaveError(error, tier) {
  if (error?.code === NO_ROWS) return `The ${tier} tier wasn’t saved: your account isn’t allowed to change it, or it no longer exists.`;
  return adminErrorMessage(error, `The ${tier} tier wasn’t saved`);
}

export function PricingTab({ notify }) {
  const id = useId();
  const [tiers, setTiers] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [loadError, setLoadError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  // A failed load says so, with Try again (AW-202).
  const load = () => supabase.from('pricing_tiers').select('tier,discount_pct').order('discount_pct', { ascending: true })
    .then((result) => {
      const error = withStatus(result || {});
      setLoadError(error ? adminErrorMessage(error, 'The pricing tiers didn’t load') : null);
      if (error) return;
      const rows = result.data || [];
      setTiers(rows);
      setDrafts(Object.fromEntries(rows.map((t) => [t.tier, draftOf(t)])));
    });
  useEffect(() => { load(); }, []);
  const retry = async () => {
    setRetrying(true);
    await load();
    setRetrying(false);
  };

  const changes = tiers ? tierChanges(tiers, drafts) : [];
  useLeaveGuard(changes.length > 0);

  const edit = (tier, field, value) => {
    setDrafts((current) => ({ ...current, [tier]: { ...current[tier], [field]: value } }));
    setErrors((current) => ({ ...current, [`${tier}:${field}`]: undefined }));
    setSaveError(null);
  };

  const submit = (event) => {
    event.preventDefault();
    setSaveError(null);
    const found = {};
    for (const tier of tiers) {
      const problems = validateTier(drafts[tier.tier]);
      for (const [field, message] of Object.entries(problems)) found[`${tier.tier}:${field}`] = message;
    }
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(`${id}-${first.replace(':', '-')}`)?.focus();
      return;
    }
    if (!changes.length) {
      setSaveError('Nothing has changed.');
      return;
    }
    setConfirm(changes);
  };

  // Each changed tier in turn; the first refusal stops there, and the tiers
  // saved before it stay saved.
  const apply = async () => {
    setBusy(true);
    const saved = [];
    let failure = null;
    for (const change of confirm) {
      const { error } = await saveTier(supabase, change);
      if (error) {
        failure = tierSaveError(error, change.tier);
        break;
      }
      saved.push(change);
    }
    setBusy(false);
    setConfirm(null);
    if (saved.length) {
      setTiers((current) => current.map((t) => {
        const change = saved.find((c) => c.tier === t.tier);
        return change ? { ...t, discount_pct: change.discount_pct } : t;
      }));
      setDrafts((current) => {
        const next = { ...current };
        for (const change of saved) next[change.tier] = draftOf({ discount_pct: change.discount_pct });
        return next;
      });
      notify?.(saved.length === 1 ? `Saved the ${saved[0].tier} tier` : `Saved ${saved.length} tiers`);
    }
    if (failure) setSaveError(failure);
  };

  if (!tiers) {
    return loadError ? <LoadProblem message={loadError} onRetry={retry} retrying={retrying} /> : <p className="result-note">Loading…</p>;
  }
  // How buyers see a tier, from the first saved one with a discount.
  const example = tiers.find((t) => Number(t.discount_pct) > 0) || tiers[0];

  return (
    <div className="pricing-tiers">
      <h2 className="bulk-title">Pricing tiers</h2>
      <p className="pricing-note">
        Each approved account is on one tier, and its prices are the list price less the tier’s discount, rounded to the cent. {PRICES_NOTE} Tiers are added or removed in the database (see BACKEND.md).
      </p>
      <form noValidate onSubmit={submit}>
        <div className="table-scroll">
          <table className="aw-table pricing-table">
            <thead>
              <tr><th>Tier</th><th>Discount (%)</th></tr>
            </thead>
            <tbody>
              {tiers.map((tier) => {
                const draft = drafts[tier.tier] || draftOf(tier);
                const pctError = errors[`${tier.tier}:pct`];
                const base = `${id}-${tier.tier}`;
                return (
                  <tr key={tier.tier}>
                    <th scope="row"><span className="pricing-key">{tier.tier}</span></th>
                    <td>
                      <input
                        id={`${base}-pct`} type="text" inputMode="decimal" value={draft.pct} aria-label={`Discount of the ${tier.tier} tier, in percent`}
                        aria-invalid={pctError ? true : undefined} aria-describedby={`${base}-pct-error`}
                        onChange={(e) => edit(tier.tier, 'pct', e.target.value)}
                      />
                      <p className="form-error" id={`${base}-pct-error`}>{pctError || ''}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {example && (
          <p className="field-hint">{`Buyers see their tier by its name and discount, for example “${tierPriceNote({ tier: example.tier, discountPct: example.discount_pct })}”`}</p>
        )}
        {saveError && <p className="form-error" role="alert">{saveError}</p>}
        <div className="inline-actions bulk-actions">
          <button className="button" type="submit" disabled={busy}>Save tiers</button>
          {changes.length > 0 && (
            <button className="button ghost" type="button" onClick={() => {
              setDrafts(Object.fromEntries(tiers.map((t) => [t.tier, draftOf(t)])));
              setErrors({});
              setSaveError(null);
            }}>Undo changes</button>
          )}
        </div>
      </form>
      {confirm && (
        <ConfirmDialog
          title={confirm.length === 1 ? `Save the ${confirm[0].tier} tier?` : `Save ${confirm.length} tiers?`}
          body={`${confirm.map(changeText).join('; ')}. ${PRICES_NOTE}`}
          confirmLabel={busy ? 'Saving…' : 'Save'} busy={busy}
          onConfirm={apply} onCancel={() => { if (!busy) setConfirm(null); }}
        />
      )}
    </div>
  );
}
