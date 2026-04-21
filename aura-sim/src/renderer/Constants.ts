// Wrapper for UI constants
// Re-exports all auto‑generated constants from `constants.auto.ts`
// and merges any manual overrides from `overrides.ts`.
// Existing imports such as `import { COLORS, TIMINGS } from './Constants'`
// continue to work unchanged.

import * as auto from './constants.auto';
import * as overrides from './overrides';

// Preserve semantic Z‑Index enum that existed previously.
export enum ZIndex {
  Background = 0,
  Content = 10,
  Modal = 20,
  Overlay = 30,
}

// Export everything from the auto‑generated module.
export * from './constants.auto';

// Merge manual overrides – overrides take precedence.
export const TIMINGS = { ...auto.TIMINGS, ...(overrides.TIMINGS ?? {}) } as const;
export const COLORS = { ...(overrides.COLORS ?? {}) } as const;
