// ESLint flat config (AW-209): JS recommended, React, the React Hooks rules
// (including the React Compiler checks) and jsx-a11y for the storefront code,
// plus Node globals for configs, scripts and tests.
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import translateSafeText from './scripts/eslint/translate-safe-text.mjs';

// Project rules. aw/translate-safe-text keeps pages from crashing or showing
// stale numbers under Google Translate (AW-039, AW-164).
const aw = { rules: { 'translate-safe-text': translateSafeText } };

export default [
  {
    ignores: ['dist/', 'src/assets/generated/', 'playwright-report/', 'test-results/', 'coverage/']
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      aw
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser }
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      ...reactHooks.configs.flat.recommended.rules,
      // The app declares no PropTypes (React 19 drops them entirely); prop
      // contracts are covered by unit tests instead.
      'react/prop-types': 'off',
      'aw/translate-safe-text': 'error'
    }
  },
  {
    // The site's code runs in the browsers vite.config.js build.target names
    // (Safari 14, Chrome 87, Firefox 78, Edge 88). esbuild rewrites newer
    // syntax for them but not newer built-ins, so these are refused here
    // (NEW-019); scripts/check-compat.mjs checks the built files as well.
    // Tests run in Node and may use them.
    files: ['src/**/*.{js,jsx}'],
    ignores: ['src/**/*.test.{js,jsx}', 'src/test/**'],
    rules: {
      'no-restricted-properties': ['error',
        { object: 'Object', property: 'hasOwn', message: 'Safari 14 has no Object.hasOwn: use Object.prototype.hasOwnProperty.call(object, key) (NEW-019).' },
        { object: 'AbortSignal', property: 'timeout', message: 'Safari 14 has no AbortSignal.timeout: use timeoutSignal() in src/lib/network.js (NEW-019).' },
        { object: 'AbortSignal', property: 'any', message: 'Safari 14 has no AbortSignal.any (NEW-019).' }],
      'no-restricted-globals': ['error',
        { name: 'structuredClone', message: 'Safari 14 has no structuredClone (NEW-019).' }],
      'no-restricted-syntax': ['error',
        {
          selector: 'CallExpression[callee.property.name=/^(at|findLast|findLastIndex|toSorted|toReversed|toSpliced)$/]',
          message: 'Safari 14 and Chrome 87 lack Array.prototype.at, findLast, findLastIndex, toSorted, toReversed and toSpliced: use an index, a loop or a copy (NEW-019).'
        },
        {
          selector: "NewExpression[callee.property.name='ListFormat']",
          message: 'Safari 14.0 has no Intl.ListFormat: use listText() in src/components/Footer.jsx (NEW-019).'
        }]
    }
  },
  {
    // Tests and their helpers (src/test) run in Node.
    files: ['src/**/*.test.{js,jsx}', 'src/test/**/*.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.node }
    }
  },
  {
    files: ['*.{js,mjs}', 'scripts/**/*.{js,mjs}', 'tests/**/*.{js,mjs}', 'netlify/**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node }
    }
  },
  {
    // Playwright specs also hold callbacks that run in the page
    // (page.evaluate, addInitScript).
    files: ['tests/smoke/**/*.{js,mjs}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser }
    }
  }
];
