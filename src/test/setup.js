// Vitest setup: unmount React trees rendered by @testing-library/react after
// each test (auto-cleanup needs test globals, which this project keeps off).
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { flushHistory } from './history.js';

// waitFor and findBy give up after 10s instead of Testing Library's 1s. What
// they wait for is often a module loaded on first use (a lazy page, the
// storage client): Vitest transforms it then, which took over a second while
// other test runs or a build shared the machine. They still return as soon as
// the condition holds, and vite.config.js's testTimeout stays above this.
configure({ asyncUtilTimeout: 10_000 });

// After the unmount, the history traversals a test left queued land here and
// not in the next test: a dialog takes its history entry back as it closes
// or unmounts (history.back(), AW-065), and jsdom runs that a few tasks
// later, where it would change the next test's URL or leave the router
// ignoring its first Back. Under fake timers jsdom's traversals wait for the
// fake clock, so there is nothing to flush.
afterEach(async () => {
  cleanup();
  if (!vi.isFakeTimers()) await flushHistory();
});
