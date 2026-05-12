// Tunable constants for the replay engine and decision lock.
// All durations in milliseconds. See DESIGN.md §2 for the lifecycle.

// FAST_MODE=1 speeds the lifecycle ~50× for dev/test runs.
const fast = process.env.FAST_MODE === '1';
const scale = fast ? 50 : 1;

export const config = {
  port: 3001,
  corsOrigin: 'http://localhost:4200',

  settlingMs: 5_000 / scale,
  windowMs: 15_000 / scale,
  lockedMs: 1_000 / scale,
  revealMs: 8_000 / scale,
  overSummaryMs: 10_000 / scale,
} as const;
