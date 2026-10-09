// The receipt after a quote or order is saved (AW-012, AW-022, AW-108).
//
// It shows the snapshot src/lib/receipt.js took when submit_quote answered:
// the reference (large, with a Copy button where the browser allows it; the
// toast confirms the copy and speaks it once), the total the server saved,
// the lines that were sent, and the delivery details. Print leaves out the
// site's header, notices, footer, dialogs and these buttons, and adds the
// company's name, address and phone (index.css @media print). Nothing here
// can send the quote again.
//
// QuotePage renders it right after a save and, from the copy App keeps for
// this history entry, after a reload or Back. The heading is focusable
// (tabIndex -1) so QuotePage can move focus to it after the save.
//
// The heading block is centred by its class, with no inline styles
// (AW-108); the details below it read left to right.

import { COMPANY } from '../data/content.js';
import { formatMoney } from '../lib/format.js';
import { DELIVERY_LABELS, formatPreferredDate } from '../lib/receipt.js';
import { Link } from '../lib/router.js';
import { showToast } from '../lib/toast.js';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function QuoteReceipt({ receipt, signedIn = false, headingRef = null }) {
  const asOrder = receipt.kind === 'order';
  const noun = asOrder ? 'order' : 'quote';
  // Copy is offered only where the browser has a clipboard to write to
  // (secure pages in current browsers). The toast shows the result and
  // speaks it through announce(), once.
  const canCopy = typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function';
  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(receipt.ref);
      showToast({ text: 'Reference number copied.' });
    } catch {
      showToast({ text: 'The reference number couldn’t be copied. Select it to copy it instead.' });
    }
  };

  const units = receipt.totalUnits ?? receipt.lines.reduce((sum, line) => sum + line.qty, 0);
  const unpriced = Number(receipt.unpricedLines) || 0;
  const ship = receipt.delivery === 'delivery' ? receipt.ship : null;
  const preferred = formatPreferredDate(receipt.preferredDate);

  return (
    <section className="page-head receipt-head">
      {/* Printed only: whom the receipt is from. */}
      <p className="receipt-from">{`${COMPANY.name} · ${COMPANY.addressShort} · ${COMPANY.phone}`}</p>
      <p className="eyebrow">{asOrder ? 'ORDER RECEIVED' : 'QUOTE RECEIVED'}</p>
      <h1 ref={headingRef} tabIndex={-1}>{`Thank you, ${receipt.contact || 'partner'}.`}</h1>
      {/* TODO(owner): "within one business day" is kept as published; see the AW-246 row in docs/OWNER-TODO.md. (AW-246) */}
      <p>
        <span>{asOrder ? 'Your order has been saved.' : 'Your quote request has been saved.'}</span> A trade desk rep will reach out within one business day at <strong>{receipt.reachAt}</strong> to confirm details.
      </p>
      <p className="receipt-ref">
        <span className="receipt-ref-label">Reference number</span>
        <strong className="receipt-ref-number">{receipt.ref}</strong>
        {canCopy && <button className="button xs text receipt-copy" type="button" onClick={copyRef} aria-label="Copy reference number">Copy</button>}
      </p>
      {/* The total the server saved (AW-351), priced by submit_quote. */}
      {receipt.subtotal != null && <p className="result-note">{`Saved total: ${formatMoney(receipt.subtotal)} · ${plural(Number(units), 'unit', 'units')}`}</p>}
      {receipt.subtotal != null && unpriced > 0 && (
        <p className="result-note">{`${plural(unpriced, 'line is', 'lines are')} priced by the trade desk.`}</p>
      )}

      <div className="receipt-body">
        <h2 className="receipt-subhead">{`Items in this ${noun}`}</h2>
        <ul className="order-items receipt-items">
          {receipt.lines.map((line) => (
            <li key={line.lineKey}>
              <span>
                <span>{`${line.qty} × ${line.name}`}</span> <span className="sku">{`(${line.sku}${line.sellUnit ? ` · sold by the ${line.sellUnit}` : ''})`}</span>
              </span>
            </li>
          ))}
        </ul>

        <h2 className="receipt-subhead">Details</h2>
        <dl className="contact-grid receipt-details">
          {receipt.business && <div><dt>Business</dt><dd>{receipt.business}</dd></div>}
          <div><dt>Delivery method</dt><dd>{DELIVERY_LABELS[receipt.delivery] || DELIVERY_LABELS.delivery}</dd></div>
          {ship ? (
            <div>
              <dt>Ship to</dt>
              <dd><span className="receipt-line">{ship.street}</span><span className="receipt-line">{`${ship.city}, ${ship.state} ${ship.zip}`}</span></dd>
            </div>
          ) : (
            <div><dt>Pickup at</dt><dd>{`${COMPANY.addressShort}, during business hours`}</dd></div>
          )}
          {preferred && <div><dt>Preferred date</dt><dd>{preferred}</dd></div>}
          {receipt.notes && <div className="receipt-wide"><dt>Notes</dt><dd>{receipt.notes}</dd></div>}
        </dl>

        <div className="dialog-actions receipt-actions">
          <Link className="button" to="/catalog">Continue shopping</Link>
          {/* Guest quotes are in no account's history. */}
          {signedIn && <Link className="button ghost" to="/account">View order history</Link>}
          <button className="button ghost" type="button" onClick={() => window.print()}>Print</button>
          <a className="button ghost" href={`tel:${COMPANY.phoneRaw}`}>Call to discuss</a>
        </div>
      </div>
    </section>
  );
}
