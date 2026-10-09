import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { installDomGuards } from './lib/domGuard.js';
import { installPrintHelpers } from './lib/print.js';
import { takeAuthLink } from './lib/authLink.js';
import { AuthProvider } from './lib/auth.jsx';
import { CatalogProvider } from './lib/catalog.jsx';
import { PricesProvider } from './lib/prices.jsx';
import { redirectLegacyHash } from './lib/router.js';
import { installChunkRecovery } from './lib/chunks.js';
import './index.css';

// Before React touches the DOM: translated pages must not crash it (AW-039).
installDomGuards();
// Printing opens /catalog's SKU lists, and closes them again after (AW-148).
installPrintHelpers();

// A Supabase email link ('#access_token=…', '#error=…') is read and removed
// from the address first (AW-015), so neither the legacy redirect below nor
// the router ever sees its tokens. A recovery link becomes /reset-password.
const authLink = takeAuthLink();

// Old '#/…' links become their path (AW-043).
redirectLegacyHash();

// A page whose code didn't download reloads once (NEW-006).
installChunkRecovery();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary fullPage>
      <AuthProvider link={authLink}>
        <CatalogProvider>
          {/* An approved buyer's prices (AW-003): after the account and the catalog. */}
          <PricesProvider>
            <App />
          </PricesProvider>
        </CatalogProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
