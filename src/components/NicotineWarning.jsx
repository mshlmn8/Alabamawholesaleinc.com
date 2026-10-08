import React from 'react';
import { FDA_NICOTINE_WARNING } from '../lib/regulated.js';

export function NicotineWarning({ compact = false }) {
  return (
    <p className={compact ? 'nicotine-warning is-compact' : 'nicotine-warning'} role="note">
      {FDA_NICOTINE_WARNING} Not for sale to anyone under 21.
    </p>
  );
}
