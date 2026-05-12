import type { BallEvent, FieldPlacement, ScoreComponent } from '@shared/types';
import { fieldSimilarity } from './similarity';
import { fieldTemplates, type FieldTemplate } from '../fixtures/field-templates';
import { lookupBowlerStat } from '../fixtures/bowler-stats';

// DESIGN §5.2. Max 50 weighted points:
//   bowler merit  (max 20) — rank of chosen bowler in this matchup
//   field merit   (max 30) — similarity to best applicable template

export type MeritResult = {
  component: ScoreComponent;
  explanation: string;
  bowlerMeritPts: number;
  fieldMeritPts: number;
  matchedTemplate: FieldTemplate | null;
};

export function scoreTacticalMerit(user: FieldPlacement, ball: BallEvent): MeritResult {
  const bowlerMeritPts = scoreBowlerMerit(user.bowler_id, ball);
  const { points: fieldMeritPts, matchedTemplate } = scoreFieldMerit(user, ball);

  const weighted = bowlerMeritPts + fieldMeritPts;
  const raw = weighted / 50;

  const templateLabel = matchedTemplate?.label ?? 'no template for this matchup';
  const fieldPct = Math.round((fieldMeritPts / 30) * 100);
  const explanation =
    `Bowler choice scored ${bowlerMeritPts}/20 for this matchup. ` +
    `Field is ${fieldPct}% match to "${templateLabel}" → ${fieldMeritPts}/30.`;

  return {
    component: { raw, weighted },
    explanation,
    bowlerMeritPts,
    fieldMeritPts,
    matchedTemplate,
  };
}

function scoreBowlerMerit(chosenId: string, ball: BallEvent): number {
  // Rank candidates (the chosen + everyone with overs remaining) by economy ascending.
  const candidates = ball.bowler_options.filter(
    (b) => b.overs_remaining > 0 || b.id === chosenId,
  );
  if (candidates.length === 0) return 0;

  const ranked = candidates
    .map((b) => ({
      id: b.id,
      economy: lookupBowlerStat(b.id, ball.batter.hand, ball.phase)?.economy ?? 10,
    }))
    .sort((a, b) => a.economy - b.economy);

  const idx = ranked.findIndex((r) => r.id === chosenId);
  if (idx === -1) return 0;
  if (ranked.length === 1) return 20;
  // Linear: rank 0 (best) → 20, rank N-1 (worst) → 0.
  return Math.round(20 * (1 - idx / (ranked.length - 1)));
}

function scoreFieldMerit(
  user: FieldPlacement,
  ball: BallEvent,
): { points: number; matchedTemplate: FieldTemplate | null } {
  const userBowler = ball.bowler_options.find((b) => b.id === user.bowler_id);

  // Filter templates by matchup. Bowler-type match is preferred but optional.
  const sameMatchup = fieldTemplates.filter(
    (t) => t.phase === ball.phase && t.batter_hand === ball.batter.hand,
  );
  const preferred = userBowler
    ? sameMatchup.filter((t) => t.bowler_type === userBowler.type)
    : [];
  const applicable = preferred.length > 0 ? preferred : sameMatchup;

  if (applicable.length === 0) {
    // No template available; give a mid-tier 15 so the score isn't punishing.
    return { points: 15, matchedTemplate: null };
  }

  // Pick the closest template (treat as "what the user was aiming for").
  let best = applicable[0]!;
  let bestSim = fieldSimilarity(user.fielders, best.fielders);
  for (let i = 1; i < applicable.length; i++) {
    const t = applicable[i]!;
    const sim = fieldSimilarity(user.fielders, t.fielders);
    if (sim > bestSim) {
      bestSim = sim;
      best = t;
    }
  }

  return { points: Math.round(bestSim * 30), matchedTemplate: best };
}
