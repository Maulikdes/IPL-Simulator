// Socket.IO event-name constants. Use these instead of string literals
// so renames are typechecked.

export const Events = {
  // server -> client
  BallUpcoming: 'ball:upcoming',
  BallLocked: 'ball:locked',
  BallRevealed: 'ball:revealed',
  LeaderboardUpdate: 'leaderboard:update',
  OverComplete: 'over:complete',

  // client -> server
  DecisionSubmit: 'decision:submit',
  UserHello: 'user:hello',
} as const;
