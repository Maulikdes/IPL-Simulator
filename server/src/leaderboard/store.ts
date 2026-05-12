import type { LeaderboardRow } from '@shared/types';

type Entry = { name?: string; total: number; ballsPlayed: number };

const board = new Map<string, Entry>();

export function recordBallScore(userId: string, name: string | undefined, scoreTotal: number): void {
  const cur = board.get(userId) ?? { name, total: 0, ballsPlayed: 0 };
  cur.total += scoreTotal;
  cur.ballsPlayed += 1;
  if (name && !cur.name) cur.name = name;
  board.set(userId, cur);
}

export function getLeaderboard(): LeaderboardRow[] {
  return Array.from(board.entries())
    .map(([user_id, e]) => ({ user_id, name: e.name, total: e.total, balls_played: e.ballsPlayed }))
    .sort((a, b) => b.total - a.total);
}

export function resetLeaderboard(): void {
  board.clear();
}
