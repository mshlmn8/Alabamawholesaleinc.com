// An order's pick list or packing slip (AW-110): /admin/orders/:id/print
// ?doc=pick|slip. One order, its lines sorted by department, sub-line and
// name (printSheet.js), with an empty box to tick by hand, the SKU, the
// quantity and the sell unit. No prices on either sheet. The packing slip
// goes with the order, so it carries the store's name and address and the
// customer's notes; staff notes never print. The print stylesheet
// (src/index.css, @media print) hides the site around it.

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { Link } from '../../lib/router.js';
import { COMPANY } from '../../data/content.js';
import { adminErrorMessage } from './adminData.js';
import { LoadProblem } from './AdminStatus.jsx';
import { orderMethod, placedAt, requestedDate } from './OrdersSection.jsx';
import { PRINT_DOCS, loadPrintOrder, printDoc, printGroups, printHref, printLines, printTotals } from './printSheet.js';

// orderId, doc: what to print. listHref: the list to go back to.
// onBack(event): Back was clicked (AdminPage goes back in history when the
// list opened this sheet).
export function PrintSheet({ orderId, doc: requested, listHref, onBack }) {
  const doc = printDoc(requested);
  const sheet = PRINT_DOCS[doc];
  const [state, setState] = useState({ order: undefined, error: null });
  const [retrying, setRetrying] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const headingRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadPrintOrder(supabase, orderId).then((result) => {
      if (cancelled) return;
      setState({ order: result.order, error: result.error ? adminErrorMessage(result.error, 'The order didn’t load') : null });
      setRetrying(false);
    });
    return () => { cancelled = true; };
  }, [orderId, attempt]);
  const retry = () => {
    setRetrying(true);
    setAttempt((n) => n + 1);
  };
  // The sheet replaces the list: its heading takes focus.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [orderId, doc]);

  const order = state.order;
  const lines = order ? printLines(order) : [];
  const groups = printGroups(lines);

  return (
    <article className={`print-sheet print-${doc}`} aria-labelledby="print-title">
      <div className="print-actions">
        <button className="button" type="button" disabled={!order} onClick={() => window.print()}>Print</button>
        <Link className="button ghost" to={printHref(orderId, sheet.other)} replace scroll={false}>{`Show the ${sheet.otherLabel.toLowerCase()}`}</Link>
        <Link className="text-link" to={listHref} onClick={onBack}>Back to orders</Link>
      </div>
      <header className="print-head">
        {doc === 'slip' && (
          <p className="print-company">{`${COMPANY.name} · ${COMPANY.addressShort} · ${COMPANY.phone}`}</p>
        )}
        <h2 id="print-title" ref={headingRef} tabIndex={-1}>
          <span>{sheet.title}</span> <span className="print-ref">{order ? order.ref_num : ''}</span>
        </h2>
        {order && (
          <dl className="print-facts">
            <div><dt>Business</dt><dd>{order.business || '—'}</dd></div>
            <div><dt>Contact</dt><dd>{order.contact || '—'}</dd></div>
            <div><dt>Phone</dt><dd>{order.phone || '—'}</dd></div>
            <div><dt>Method</dt><dd>{orderMethod(order)}</dd></div>
            <div><dt>Requested</dt><dd>{requestedDate(order.preferred_date)}</dd></div>
            <div><dt>Placed</dt><dd>{placedAt(order.created_at)}</dd></div>
          </dl>
        )}
      </header>
      {order === undefined && !state.error && <p className="result-note">Loading…</p>}
      {state.error && <LoadProblem message={state.error} onRetry={retry} retrying={retrying} />}
      {order === null && <p className="result-note">That order wasn’t found. It may have been deleted.</p>}
      {order && (
        <>
          <table className="print-lines">
            <thead>
              <tr>
                <th scope="col" className="print-tick-cell">{sheet.tick}</th>
                <th scope="col">SKU</th>
                <th scope="col" className="print-num">Qty</th>
                <th scope="col">Unit</th>
                <th scope="col" className="print-product">Product</th>
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group.key || 'other'}>
                <tr className="print-group"><th scope="rowgroup" colSpan={5}>{group.label}</th></tr>
                {group.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="print-tick-cell"><span className="print-tick" aria-hidden="true" /></td>
                    <td className="print-sku">{line.sku}</td>
                    <td className="print-num">{line.qty}</td>
                    <td>{line.unit || '—'}</td>
                    <td>
                      <span className="print-name">{line.name}</span>
                      {line.sub && <span className="print-sub">{line.sub}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
          <p className="print-total">{lines.length ? printTotals(lines) : 'This order has no lines.'}</p>
          {order.notes && (
            <section className="print-notes" aria-labelledby="print-notes-title">
              <h3 id="print-notes-title">Customer notes</h3>
              <p>{order.notes}</p>
            </section>
          )}
        </>
      )}
    </article>
  );
}
