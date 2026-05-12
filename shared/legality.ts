// Cricket fielding-restriction model. Used by both server (scoring penalty)
// and client (live warning chip).

import type { Fielder, Phase } from './types';

// Inner "30-yard" ring radius in our normalized [-1, 1] coords.
// Real cricket: 30 yards / ~70-yard boundary ≈ 0.43. We use 0.60 so the
// DESIGN §6 named ring positions (cover, mid-off, etc.) count as inside,
// matching how players talk about them.
export const INNER_RING_RADIUS = 0.60;

export function maxOutfieldersOutside(phase: Phase): number {
  return phase === 'powerplay' ? 2 : 5;
}

export function countOutsideRing(fielders: Fielder[]): number {
  return fielders.filter((f) => Math.hypot(f.x, f.y) >= INNER_RING_RADIUS).length;
}

export type LegalityCheck = {
  legal: boolean;
  outsideCount: number;
  maxAllowed: number;
  phase: Phase;
  reason?: string;
};

export function checkLegality(fielders: Fielder[], phase: Phase): LegalityCheck {
  const outsideCount = countOutsideRing(fielders);
  const maxAllowed = maxOutfieldersOutside(phase);
  if (outsideCount > maxAllowed) {
    return {
      legal: false,
      outsideCount,
      maxAllowed,
      phase,
      reason: `${outsideCount} fielders outside the 30-yard ring (max ${maxAllowed} in ${phase}).`,
    };
  }
  return { legal: true, outsideCount, maxAllowed, phase };
}
