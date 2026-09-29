// Catches render errors so one broken page shows a way forward instead of a
// blank white site (AW-183). main.jsx wraps the whole app with a full-page
// fallback; App wraps the route switch, so a broken page keeps the header
// and footer. `resetKey` changes on navigation: leaving a broken page clears
// the error without remounting pages that rendered fine.

import { Component, useEffect, useRef } from 'react';
import { IMG } from '../data/theme.js';
import { CallOrEmail } from './ContactLinks.jsx';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('A page failed to render.', error, info?.componentStack || '');
  }

  componentDidUpdate(prevProps, prevState) {
    // Only an error that was already showing is cleared; an error thrown by
    // the page just navigated to stays up instead of looping.
    if (this.state.error && prevState.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return this.props.fullPage ? <FullPageFallback /> : <ErrorFallback />;
  }
}

function ErrorFallback() {
  const titleRef = useRef(null);
  // The control that was focused went away with the broken page.
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }); }, []);
  return (
    <section className="page-head error-fallback" role="alert" aria-labelledby="error-fallback-title">
      <p className="eyebrow">PAGE ERROR</p>
      <h1 id="error-fallback-title" ref={titleRef} tabIndex={-1}>Something went wrong loading this page</h1>
      <p>Reload to try again, or go to the home page. If it keeps happening, <CallOrEmail before="call" after=" and a trade rep will help you." /></p>
      <div className="dialog-actions">
        <button className="button" type="button" onClick={() => window.location.reload()}>Reload <span aria-hidden="true">↗</span></button>
        {/* A full page load, so nothing from the broken page carries over. */}
        <a className="button ghost" href="/">Go to home</a>
      </div>
    </section>
  );
}

function FullPageFallback() {
  return (
    <div className="error-page">
      <div className="container">
        <img className="error-page-logo" src={IMG.logo} alt="Alabama Wholesale Inc" />
        <ErrorFallback />
      </div>
    </div>
  );
}
