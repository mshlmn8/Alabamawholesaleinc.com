// What Admin -> Accounts' list and the account page (AccountDetail.jsx,
// AW-113) share: the approval line, the change and error sentences, the
// application answers (AccountFacts, the details row of AW-017), an email
// that wraps after its @, and View on a licence document (signed when it
// is clicked, AW-208).

import { useEffect, useState } from 'react';
import { DOCUMENT_VIEW_SECONDS, openDocument } from '../../lib/documents.js';
import { Icon } from '../../components/Icon.jsx';
import { adminErrorMessage, isMissingSchema, isRefused, refusalFor } from './adminData.js';

// Who approved an account, and when (AW-197): the approver's name from the
// accounts already loaded. Accounts approved before 20261008193000, or on a
// database without it, have no approved_at, and show nothing.
export function approvalLine(p, profiles) {
  if (!p.approved_at) return null;
  const at = new Date(p.approved_at);
  if (Number.isNaN(at.getTime())) return null;
  const when = at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const approver = p.approved_by ? profiles.find(x => x.id === p.approved_by) : null;
  const by = approver ? (approver.name || approver.email) : null;
  return by ? `Approved ${when} by ${by}` : `Approved ${when}`;
}

// What Admin -> Accounts says after a change was saved.
export function profileChangeText(who, patch) {
  if (patch.role === 'admin') return `${who} is now an admin.`;
  if (patch.role === 'customer') return `${who} is now a customer account.`;
  if ('status' in patch) return `${who} is now ${patch.status}.`;
  if ('pricing_tier' in patch) return `${who} is now on the ${patch.pricing_tier} tier.`;
  if ('verification_note' in patch) return `Saved the verification note for ${who}.`;
  return `Saved the change to ${who}.`;
}

// The live database gets the approval and consent columns from the
// 2026-10-08 migrations (AW-197, AW-019); until then they read as '—' and a
// note cannot be saved. The database refuses some admin changes with 42501
// and a hint (20261009140000); one with no hint names the account.
export function profileSaveError(error, who) {
  if (isMissingSchema(error) || /PGRST204|42703/.test(String(error?.message || ''))) return 'Saving this needs the October 2026 database update (see BACKEND.md).';
  if (isRefused(error) && !refusalFor(error)) return `That change to ${who} isn’t allowed.`;
  return adminErrorMessage(error, `The change to ${who} wasn’t saved`);
}

// An email address that may wrap after its @ (AW-021), so a long address
// doesn't push the table wider than the screen.
export function Email({ address }) {
  const text = String(address || '');
  const at = text.indexOf('@');
  if (at < 1) return <span>{text}</span>;
  return <><span>{text.slice(0, at + 1)}</span><wbr /><span>{text.slice(at + 1)}</span></>;
}

const dateTime = (value) => (value ? new Date(value).toLocaleString() : '');
// The application answers staff verify (AW-017), in the details row's order.
// `contact`: the phone, state, store address and business type, which the
// account page edits in its own form instead.
const FACTS = [
  { label: 'EIN', value: (p) => p.ein },
  { label: 'Tobacco license', value: (p) => p.license_no },
  { label: 'Resale certificate', value: (p) => p.resale_cert_no },
  { label: 'Phone', contact: true, value: (p) => p.phone },
  { label: 'Store state', contact: true, value: (p) => p.state },
  { label: 'Street', contact: true, value: (p) => p.store_street },
  { label: 'City', contact: true, value: (p) => p.store_city },
  { label: 'ZIP', contact: true, value: (p) => p.store_zip },
  { label: 'Business type', contact: true, value: (p) => p.business_type },
  { label: 'Monthly volume', value: (p) => p.expected_volume },
  { label: 'Signed up', detail: true, value: (p) => dateTime(p.created_at) },
  { label: 'Approved', value: (p) => dateTime(p.approved_at) },
  { label: 'Approved by', value: (p, profiles) => profiles.find(row => row.id === p.approved_by)?.name || p.approved_by || '' },
  { label: 'Terms accepted', value: (p) => (p.terms_accepted_at ? `${dateTime(p.terms_accepted_at)}${p.terms_version ? ` · ${p.terms_version}` : ''}` : '') },
  { label: '21+ confirmed', value: (p) => dateTime(p.age_confirmed_at) },
];

// The application answers as a grid of label and value ('—' for none).
// detail: the account page's set (without the contact answers its form
// edits, with the signup date).
export function AccountFacts({ profile, profiles = [], detail = false }) {
  const facts = FACTS.filter((f) => (detail ? !f.contact : !f.detail));
  return (
    <div className="account-facts">
      {facts.map((f) => <Fact key={f.label} label={f.label} value={f.value(profile, profiles)} />)}
    </div>
  );
}

function Fact({ label, value }) {
  return (
    <div>
      <p className="fact-label">{label}</p>
      <p>{value || '—'}</p>
    </div>
  );
}

// View on a licence document signs its URL when it is clicked, for a
// minute, and opens it in a new tab (AW-208). Nothing is signed when the
// page loads. When the browser blocks the tab, the signed URL is offered as
// a link until it expires. Returns { view(row, who, label), viewError,
// blocked(key) }; a document's key is `${profile_id}:${document_type}`.
export function useDocumentViewer() {
  const [viewError, setViewError] = useState(null);
  const [blockedLink, setBlockedLink] = useState(null); // { key, url }
  const view = async (row, who, label) => {
    setViewError(null);
    setBlockedLink(null);
    const result = await openDocument(row.storage_path);
    if (!result.ok) {
      setViewError(adminErrorMessage(result.error, `Couldn’t open the ${label.toLowerCase()} for ${who}`));
      return;
    }
    if (result.blocked) setBlockedLink({ key: `${row.profile_id}:${row.document_type}`, url: result.url });
  };
  useEffect(() => {
    if (!blockedLink) return undefined;
    const timer = setTimeout(() => setBlockedLink(null), (DOCUMENT_VIEW_SECONDS - 5) * 1000);
    return () => clearTimeout(timer);
  }, [blockedLink]);
  return { view, viewError, blocked: (key) => (blockedLink?.key === key ? blockedLink.url : null) };
}

// View, and the link a blocked tab leaves (useDocumentViewer).
export function DocumentView({ row, doc, who, viewer }) {
  const blockedLink = viewer.blocked(`${row.profile_id}:${row.document_type}`);
  return (
    <>
      <button type="button" className="text-link" onClick={() => viewer.view(row, who, doc.label)}>
        View<Icon name="external" /><span className="sr-only">{` ${doc.label} for ${who} (opens in a new tab)`}</span>
      </button>
      {blockedLink && (
        <a href={blockedLink} target="_blank" rel="noopener noreferrer">
          <span>{`Open the ${doc.label.toLowerCase()}`}</span><Icon name="external" /><span className="sr-only">{` for ${who} (opens in a new tab)`}</span>
        </a>
      )}
    </>
  );
}
