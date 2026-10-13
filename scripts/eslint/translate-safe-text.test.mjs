// aw/translate-safe-text (AW-039, AW-164).
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './translate-safe-text.mjs';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
});

const only = { messageId: 'onlyChild' };
const after = { messageId: 'textAfterDynamic' };

tester.run('translate-safe-text', rule, {
  valid: [
    'const a = <p>{`Showing ${n} of ${m}`}</p>;',
    'const a = <p>Showing <strong>{n}</strong> <span>{`of ${m}`}</span></p>;',
    'const a = <b aria-live="polite">{qty}</b>;',
    'const a = <p>Call {COMPANY.phone} or email {COMPANY.email}.</p>;',
    'const a = <ul>{items.map(i => <li key={i}>{i}</li>)}</ul>;',
    'const a = <p>Static text {cond && <b>x</b>}</p>;',
    'const a = <p>{cond && <b>x</b>}<i>always</i> text</p>;',
    'const a = <p>{cond ? <b>a</b> : <i>b</i>}<span>after</span></p>;',
    'const note = <p>n</p>; const a = <div>{note}<span>{x}</span> text</div>;',
    'function Shell({ children }) { return <div>{children}<footer>f</footer></div>; }',
    'const a = <p>{"literal"} and text</p>;',
    'const a = <button><span>{busy ? "Saving…" : "Save"}</span> <span aria-hidden="true">↗</span></button>;',
    'const a = <p>{/* comment */}text</p>;',
  ],
  invalid: [
    { code: 'const a = <p>Showing {n} of {m}</p>;', errors: [only, only] },
    { code: 'const a = <p>item{n === 1 ? "" : "s"}</p>;', errors: [only] },
    { code: 'const a = <button>{busy ? "Saving…" : "Save"} <span aria-hidden="true">↗</span></button>;', errors: [only] },
    { code: 'function Link({ before }) { return <>{before} <a href="#">x</a></>; }', errors: [only] },
    { code: 'const a = <p>{`Updated ${d}. `}Questions?</p>;', errors: [only] },
    { code: 'const a = <p>{cond && <b>x</b>} text</p>;', errors: [after] },
    { code: 'const a = <p>{items.map(i => <b key={i}>{i}</b>)} total</p>;', errors: [after] },
    { code: 'const a = <p>{cond ? <b>a</b> : null}{" "}text</p>;', errors: [after] },
    { code: 'const [label] = useState(""); const a = <span>{label} ({count})</span>;', errors: [only, only] },
  ],
});
