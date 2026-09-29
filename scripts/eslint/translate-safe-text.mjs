// ESLint rule aw/translate-safe-text (AW-039, AW-164).
//
// Google Translate (and similar extensions) replace every text node with
// <font> elements. React still holds the original, now detached, text nodes:
//   - updating one changes nothing on screen (stale counts and totals), and
//   - inserting or removing one, or inserting an element before one, throws
//     NotFoundError and unmounts the whole app.
// A string that is the ONLY child of an element is written with textContent
// instead, which survives. So:
//   onlyChild         Text that can change, appear or disappear must be the
//                     only child of an element that is always rendered.
//   textAfterDynamic  Static text must not directly follow an element that
//                     can appear, disappear or reorder, because React inserts
//                     that element in front of the text node.
//
// The check is syntactic. Constants (ALL_CAPS names and COMPANY.phone-style
// members) count as static text; `children`, JSX and .map() count as
// elements; anything else inside {…} may be text.

const STATIC = 'static-text';
const TEXT = 'dynamic-text';
const ELEMENT = 'element';
const DYNAMIC_ELEMENT = 'dynamic-element';
const NOTHING = 'nothing';

const CONSTANT_NAME = /^[A-Z][A-Z0-9_]*$/;
const LIST_METHODS = new Set(['map', 'flatMap']);

// Babel's JSX whitespace rule: text with line breaks is trimmed per line.
function jsxTextValue(raw) {
  const lines = raw.split(/\r\n|\n|\r/);
  let lastNonEmpty = 0;
  lines.forEach((line, i) => { if (/[^ \t]/.test(line)) lastNonEmpty = i; });
  let out = '';
  lines.forEach((line, i) => {
    let t = line.replace(/\t/g, ' ');
    if (i !== 0) t = t.replace(/^[ ]+/, '');
    if (i !== lines.length - 1) t = t.replace(/[ ]+$/, '');
    if (t) out += i === lastNonEmpty ? t : `${t} `;
  });
  return out;
}

function rootIdentifier(node) {
  let n = node;
  while (n.type === 'MemberExpression') {
    if (n.computed && n.property.type !== 'Literal') return null;
    n = n.object;
  }
  return n.type === 'Identifier' ? n : null;
}

function combine(kinds) {
  if (kinds.includes(TEXT)) return TEXT;
  if (kinds.includes(STATIC) && kinds.some((k) => k !== STATIC)) return TEXT;
  if (kinds.every((k) => k === STATIC)) return STATIC;
  if (kinds.every((k) => k === ELEMENT)) return ELEMENT;
  return DYNAMIC_ELEMENT;
}

function create(context) {
  const sourceCode = context.sourceCode ?? context.getSourceCode();

  function classifyIdentifier(node, depth) {
    if (node.name === 'undefined') return NOTHING;
    if (CONSTANT_NAME.test(node.name)) return STATIC;
    if (node.name === 'children') return ELEMENT;
    const scope = sourceCode.getScope ? sourceCode.getScope(node) : context.getScope();
    let s = scope;
    let variable = null;
    while (s && !variable) { variable = s.set.get(node.name) || null; s = s.upper; }
    const def = variable?.defs?.[0];
    if (def && def.type === 'Variable' && def.parent?.kind === 'const' && def.node.init && depth < 4) {
      const kind = classify(def.node.init, depth + 1);
      // A const that always holds JSX is a stable element at every use.
      return kind;
    }
    return TEXT;
  }

  function classify(node, depth = 0) {
    switch (node.type) {
      case 'JSXElement':
      case 'JSXFragment':
        return ELEMENT;
      case 'Literal':
        if (node.value === null || typeof node.value === 'boolean') return NOTHING;
        if (node.value === '') return NOTHING;
        return STATIC;
      case 'TemplateLiteral':
        return node.expressions.length === 0 ? (node.quasis[0].value.cooked ? STATIC : NOTHING) : TEXT;
      case 'Identifier':
        return classifyIdentifier(node, depth);
      case 'MemberExpression': {
        const root = rootIdentifier(node);
        return root && CONSTANT_NAME.test(root.name) ? STATIC : TEXT;
      }
      case 'LogicalExpression': {
        const right = classify(node.right, depth);
        if (node.operator === '&&') {
          if (right === ELEMENT || right === DYNAMIC_ELEMENT) return DYNAMIC_ELEMENT;
          return right === NOTHING ? NOTHING : TEXT;
        }
        const left = classify(node.left, depth);
        return left === STATIC && right === STATIC ? TEXT : combine([left, right].map((k) => (k === NOTHING ? DYNAMIC_ELEMENT : k)));
      }
      case 'ConditionalExpression': {
        const a = classify(node.consequent, depth);
        const b = classify(node.alternate, depth);
        const isText = (k) => k === STATIC || k === TEXT;
        const isNothingLiteral = (n) => n.type === 'Literal' && n.value === '';
        // '' still means a text node appears/disappears.
        if (isText(a) || isText(b) || isNothingLiteral(node.consequent) || isNothingLiteral(node.alternate)) {
          return (a === STATIC && b === STATIC && node.consequent.value === node.alternate.value) ? STATIC : TEXT;
        }
        if (a === ELEMENT && b === ELEMENT) return DYNAMIC_ELEMENT;
        if (a === NOTHING && b === NOTHING) return NOTHING;
        return DYNAMIC_ELEMENT;
      }
      case 'CallExpression': {
        const callee = node.callee;
        if (callee.type === 'MemberExpression' && !callee.computed && LIST_METHODS.has(callee.property.name)) return DYNAMIC_ELEMENT;
        return TEXT;
      }
      case 'ChainExpression':
        return classify(node.expression, depth);
      default:
        return TEXT;
    }
  }

  function childKind(child) {
    if (child.type === 'JSXText') return jsxTextValue(child.value) ? STATIC : null;
    if (child.type === 'JSXElement' || child.type === 'JSXFragment') return ELEMENT;
    if (child.type === 'JSXExpressionContainer') {
      if (child.expression.type === 'JSXEmptyExpression') return null;
      const kind = classify(child.expression);
      return kind === NOTHING ? null : kind;
    }
    return TEXT;
  }

  function check(node) {
    const kids = node.children
      .map((child) => ({ child, kind: childKind(child) }))
      .filter((k) => k.kind !== null);
    if (kids.length > 1) {
      for (const { child, kind } of kids) {
        if (kind === TEXT) context.report({ node: child, messageId: 'onlyChild' });
      }
    }
    // Static text whose nearest earlier sibling that is always rendered is
    // missing, i.e. React may insert an element in front of it.
    let pendingDynamic = false;
    for (const { child, kind } of kids) {
      if (kind === DYNAMIC_ELEMENT) pendingDynamic = true;
      else if (kind === ELEMENT) pendingDynamic = false;
      else if (kind === STATIC && pendingDynamic) {
        context.report({ node: child, messageId: 'textAfterDynamic' });
        pendingDynamic = false;
      }
    }
  }

  return { JSXElement: check, JSXFragment: check };
}

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Keep React text nodes safe from Google Translate (AW-039, AW-164)' },
    schema: [],
    messages: {
      onlyChild: 'Text that can change must be the only child of an always-rendered element (Google Translate safety, AW-039). Build one template string, or wrap it in its own <span>.',
      textAfterDynamic: 'Static text right after an element that can appear, disappear or reorder: React inserts in front of this text node, which Google Translate replaces (AW-039). Wrap the text in a <span>.',
    },
  },
  create,
};
