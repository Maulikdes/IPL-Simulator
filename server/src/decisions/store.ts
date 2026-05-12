import type { Decision } from '@shared/types';

// In-memory: Map<userId, Map<ballId, Decision>>. Last write wins for the
// same (user, ball). Server restart wipes everything — fine for demo.

const decisions = new Map<string, Map<string, Decision>>();

export function recordDecision(decision: Decision): void {
  let byBall = decisions.get(decision.user_id);
  if (!byBall) {
    byBall = new Map();
    decisions.set(decision.user_id, byBall);
  }
  byBall.set(decision.ball_id, decision);
}

export function getDecision(userId: string, ballId: string): Decision | undefined {
  return decisions.get(userId)?.get(ballId);
}
