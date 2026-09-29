// All products: a department index with every product line, plus an
// expandable list of every SKU in each department. The "Browse the catalog"
// destination.

import { Link } from '../../lib/router.js';
import { variantAxis, variantCount } from '../../lib/lines.js';
import { PageHead } from './SupportShell.jsx';

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-');

export function CatalogIndexPage({ products, departments, isApprovedBuyer, profile, onLoginClick }) {
  const lines = departments.reduce((n, d) => n + d.subs.length, 0);

  return (
    <section className="support-page catalog-index">
      <PageHead crumb="All products" eyebrow={`FULL ASSORTMENT · ${departments.length} DEPARTMENTS · ${products.length} SKUs`} title="All products">
        <p>{`Every department and product line we stock, in one place. Jump to a department, open a line, or expand the full SKU list. ${isApprovedBuyer ? 'Your account pricing shows on every product.' : profile ? 'Pricing unlocks after your account is approved.' : 'Sign in to see wholesale pricing.'}`}</p>
      </PageHead>

      <nav className="dept-jump" aria-label="Jump to department">
        {departments.map((d, i) => (
          <Link key={d.key} to={`#dept-${slug(d.key)}`}><span>{String(i + 1).padStart(2, '0')}</span><span>{d.label}</span></Link>
        ))}
      </nav>
      <p className="result-note">{`${departments.length} departments · ${lines} product lines · ${products.length} SKUs`}</p>

      <div className="dept-index">
        {departments.map((d, i) => {
          const rows = products.filter(p => p.cat === d.key).sort((a, b) => a.name.localeCompare(b.name));
          return (
            <section key={d.key} className="dept-section" id={`dept-${slug(d.key)}`} aria-labelledby={`dept-title-${slug(d.key)}`}>
              <div className="dept-head">
                <div>
                  <p className="eyebrow">{`DEPARTMENT ${String(i + 1).padStart(2, '0')} · ${d.count} SKUs`}</p>
                  <h2 id={`dept-title-${slug(d.key)}`}>{d.label}</h2>
                </div>
                <Link className="text-link" to={{ page: 'category', category: d.key }}><span>{`Browse ${d.label}`}</span> <span aria-hidden="true">↗</span></Link>
              </div>
              <div className="sub-pills" aria-label={`${d.label} product lines`}>
                {d.subs.map(s => {
                  const count = rows.filter(p => p.sub === s).length;
                  return <Link key={s} className="sub-pill" to={{ page: 'category', category: d.key, sub: s }}>{`${s} (${count})`}</Link>;
                })}
              </div>
              <details className="sku-details">
                <summary>{`All ${d.count} ${d.label} SKUs`}</summary>
                <ul className="sku-list">
                  {rows.map(p => (
                    <li key={p.id}>
                      <Link to={{ page: 'product', productId: p.id }}>
                        <b>{p.name}</b>
                        <small>{`${p.brand} · ${p.sub} · ${p.sku}${variantCount(p) > 1 ? ` · ${variantCount(p)} ${variantAxis(p).plural}` : ''}`}</small>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            </section>
          );
        })}
      </div>

      {!profile && (
        <button className="filter-signin catalog-signin" type="button" onClick={onLoginClick}>
          <b>Wholesale pricing is locked</b><span>Sign in to see your account pricing on every product.</span>
        </button>
      )}
    </section>
  );
}
