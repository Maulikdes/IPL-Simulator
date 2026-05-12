import type {
  BallEvent,
  BallResult,
  BallScore,
  Decision,
  FieldPlacement,
} from '@shared/types';
import { checkLegality } from '@shared/legality';
import { scoreCaptainSimilarity } from './captain';
import { scoreTacticalMerit } from './merit';
import { scoreOutcomeBonus } from './outcome';

export function scoreDecision(
  decision: Decision,
  ball: BallEvent,
  captainPlacement: FieldPlacement,
  result: BallResult,
): BallScore {
  const legality = checkLegality(decision.placement.fielders, ball.phase);

  const captain = scoreCaptainSimilarity(decision.placement, captainPlacement);
  const merit = scoreTacticalMerit(decision.placement, ball);
  const outcome = scoreOutcomeBonus(decision.placement, result);

  // Illegal field: tactical merit halved — the field has no merit if it
  // breaks the rules. Captain similarity & outcome bonus left untouched.
  let meritWeighted = merit.component.weighted;
  let meritRaw = merit.component.raw;
  let meritExp = merit.explanation;
  if (!legality.legal) {
    meritWeighted = meritWeighted / 2;
    meritRaw = meritRaw / 2;
    meritExp = `⚠ Illegal field: ${legality.reason} Merit halved. ${merit.explanation}`;
  }

  const total = Math.round(
    captain.component.weighted + meritWeighted + outcome.component.weighted,
  );

  return {
    components: {
      captain_similarity: captain.component,
      tactical_merit: { raw: meritRaw, weighted: meritWeighted },
      outcome_bonus: outcome.component,
    },
    total,
    explanation: {
      captain: captain.explanation,
      merit: meritExp,
      outcome: outcome.explanation,
    },
  };
}

export function noDecisionScore(): BallScore {
  return {
    components: {
      captain_similarity: { raw: 0, weighted: 0 },
      tactical_merit: { raw: 0, weighted: 0 },
      outcome_bonus: { raw: 0, weighted: 0 },
    },
    total: 0,
    explanation: {
      captain: 'No decision submitted.',
      merit: 'No decision submitted.',
      outcome: 'No decision submitted.',
    },
  };
}
