// Hand-curated "ideal" field templates per matchup. Used by the merit scorer
// (DESIGN §7). One template per (phase, bowler_type, batter_hand, variant).
// Authored from cricket-watching, not derived data.

import type { BatterHand, BowlerType, Fielder, Phase } from '@shared/types';

export type FieldTemplate = {
  template_id: string;
  label: string;
  phase: Phase;
  bowler_type: BowlerType;
  batter_hand: BatterHand;
  variant: 'aggressive' | 'standard' | 'defensive';
  fielders: Fielder[];
};

export const fieldTemplates: FieldTemplate[] = [
  {
    template_id: 'death_pace_rhb_aggressive',
    label: 'Death pace vs RHB (aggressive)',
    phase: 'death',
    bowler_type: 'right_pace',
    batter_hand: 'right',
    variant: 'aggressive',
    // Legal: 5 outside (third man, deep cover, long off, long on, deep
    // midwicket), 4 inside (mid-off, mid-on, short fine leg, slip).
    // The slip is the "aggressive" twist — close catcher for the edge.
    fielders: [
      { slot_id: 't1', x: -0.30, y: -0.85, name: 'third man' },
      { slot_id: 't2', x: -0.70, y:  0.55, name: 'deep cover' },
      { slot_id: 't3', x: -0.30, y:  0.90, name: 'long off' },
      { slot_id: 't4', x:  0.30, y:  0.90, name: 'long on' },
      { slot_id: 't5', x:  0.70, y:  0.55, name: 'deep midwicket' },
      { slot_id: 't6', x: -0.20, y:  0.55, name: 'mid-off' },
      { slot_id: 't7', x:  0.20, y:  0.55, name: 'mid-on' },
      { slot_id: 't8', x:  0.20, y: -0.30, name: 'short fine leg' },
      { slot_id: 't9', x: -0.10, y: -0.15, name: 'slip' },
    ],
  },
];
