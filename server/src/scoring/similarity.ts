import type { Fielder } from '@shared/types';

// Distance at which similarity reaches 0. Tuned in DESIGN §5.1.
const SIM_FLOOR_DISTANCE = 0.5;

export type AssignmentPair = {
  userIndex: number;
  refIndex: number;
  distance: number;
};

// Greedy global nearest-neighbor assignment. Builds all (user_i, ref_j)
// pairs, sorts by distance, takes the next pair where neither index is
// already matched. Within ~5% of optimal for n=9.
export function greedyAssign(userFielders: Fielder[], refFielders: Fielder[]): AssignmentPair[] {
  const allPairs: AssignmentPair[] = [];
  for (let ui = 0; ui < userFielders.length; ui++) {
    for (let ri = 0; ri < refFielders.length; ri++) {
      const u = userFielders[ui]!;
      const r = refFielders[ri]!;
      allPairs.push({ userIndex: ui, refIndex: ri, distance: Math.hypot(u.x - r.x, u.y - r.y) });
    }
  }
  allPairs.sort((a, b) => a.distance - b.distance);

  const usedU = new Set<number>();
  const usedR = new Set<number>();
  const matches: AssignmentPair[] = [];
  for (const p of allPairs) {
    if (usedU.has(p.userIndex) || usedR.has(p.refIndex)) continue;
    usedU.add(p.userIndex);
    usedR.add(p.refIndex);
    matches.push(p);
  }
  return matches;
}

// 0..1 similarity: 1 = identical placements, 0 = totally different.
// Uses greedy assignment, then averages per-pair similarities.
export function fieldSimilarity(userFielders: Fielder[], refFielders: Fielder[]): number {
  const n = Math.max(userFielders.length, refFielders.length);
  if (n === 0) return 0;
  const pairs = greedyAssign(userFielders, refFielders);
  const simSum = pairs.reduce((acc, p) => {
    return acc + Math.max(0, 1 - p.distance / SIM_FLOOR_DISTANCE);
  }, 0);
  return simSum / n;
}
