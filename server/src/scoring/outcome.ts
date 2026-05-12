import type { BallResult, FieldPlacement, ScoreComponent } from '@shared/types';

// DESIGN §5.3. Rule-based bonus, clamped to [0, 20].

const NEAR_RADIUS = 0.15;

export type OutcomeResult = {
  component: ScoreComponent;
  explanation: string;
};

export function scoreOutcomeBonus(
  user: FieldPlacement,
  result: BallResult,
): OutcomeResult {
  const dir = result.shot.direction;
  const nearestDist = Math.min(
    ...user.fielders.map((f) => Math.hypot(f.x - dir.x, f.y - dir.y)),
  );

  let pts = 0;
  let explanation = 'No bonus this ball.';

  if (result.wicket?.type === 'caught') {
    if (nearestDist <= NEAR_RADIUS) {
      pts = 20;
      explanation = `Caught near a fielder you placed (${nearestDist.toFixed(2)} away). +20.`;
    } else {
      pts = 5;
      explanation = `Wicket fell, but you didn't have a fielder close to the catching position. +5.`;
    }
  } else if (result.wicket) {
    // Non-catch wicket (bowled, lbw, etc.) — small bonus regardless.
    pts = 5;
    explanation = `Wicket (${result.wicket.type}). +5.`;
  } else if (result.runs === 6) {
    if (nearestDist > NEAR_RADIUS) {
      pts = 0;
      explanation = `Six over an empty zone. No bonus.`;
    } else {
      pts = 0;
      explanation = `Six conceded over a fielder. No bonus.`;
    }
  } else if (result.runs === 4) {
    if (nearestDist <= NEAR_RADIUS) {
      pts = 10;
      explanation = `Boundary, but your fielder was in the line (${nearestDist.toFixed(2)} away). +10 saved.`;
    } else {
      pts = 0;
      explanation = `Boundary conceded over an empty zone.`;
    }
  } else if (result.runs === 0) {
    pts = 5;
    explanation = `Dot ball. +5.`;
  } else {
    explanation = `${result.runs} run(s) conceded.`;
  }

  pts = Math.max(0, Math.min(20, pts));
  const raw = pts / 20;
  return { component: { raw, weighted: pts }, explanation };
}
