import type { FieldPlacement, ScoreComponent } from '@shared/types';
import { fieldSimilarity } from './similarity';

// DESIGN §5.1. Max 30 weighted points.
// raw = 0.4 * bowler_match + 0.6 * field_similarity
// weighted = raw * 30

export type CaptainResult = {
  component: ScoreComponent;
  explanation: string;
  bowlerMatch: boolean;
  fieldSimilarity: number;
};

export function scoreCaptainSimilarity(
  user: FieldPlacement,
  captain: FieldPlacement,
): CaptainResult {
  const bowlerMatch = user.bowler_id === captain.bowler_id;
  const fieldSim = fieldSimilarity(user.fielders, captain.fielders);
  const raw = 0.4 * (bowlerMatch ? 1 : 0) + 0.6 * fieldSim;
  const weighted = raw * 30;

  const pct = Math.round(fieldSim * 100);
  let explanation: string;
  if (bowlerMatch && pct >= 85) {
    explanation = `Almost identical to the captain — same bowler, field ${pct}% similar.`;
  } else if (bowlerMatch) {
    explanation = `Same bowler as the captain. Field is ${pct}% similar.`;
  } else if (pct >= 70) {
    explanation = `Different bowler, but field is ${pct}% similar to the captain.`;
  } else {
    explanation = `Different bowler, field only ${pct}% similar.`;
  }

  return {
    component: { raw, weighted },
    explanation,
    bowlerMatch,
    fieldSimilarity: fieldSim,
  };
}
