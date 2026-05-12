// Per-bowler expected economy + wicket rate by matchup.
// Hand-curated for our demo over. Real Cricsheet aggregation comes later.

import type { BatterHand, Phase } from '@shared/types';

export type BowlerStat = {
  bowler_id: string;
  batter_hand: BatterHand;
  phase: Phase;
  economy: number;       // runs per over (lower = better)
  wicket_rate: number;   // wickets per ball (higher = better)
};

export const bowlerStats: BowlerStat[] = [
  // Death overs vs RHB (the matchup our demo over uses)
  { bowler_id: 'malinga', batter_hand: 'right', phase: 'death', economy: 7.0, wicket_rate: 0.08 },
  { bowler_id: 'hardik',  batter_hand: 'right', phase: 'death', economy: 8.5, wicket_rate: 0.05 },
  { bowler_id: 'krunal',  batter_hand: 'right', phase: 'death', economy: 9.5, wicket_rate: 0.04 },
  { bowler_id: 'chahar',  batter_hand: 'right', phase: 'death', economy: 9.0, wicket_rate: 0.05 },
];

export function lookupBowlerStat(
  bowlerId: string,
  hand: BatterHand,
  phase: Phase,
): BowlerStat | undefined {
  return bowlerStats.find(
    (s) => s.bowler_id === bowlerId && s.batter_hand === hand && s.phase === phase,
  );
}
