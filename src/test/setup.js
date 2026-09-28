// Vitest setup: unmount React trees rendered by @testing-library/react after
// each test (auto-cleanup needs test globals, which this project keeps off).
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
