// Wire contracts between server and client.
// See DESIGN.md §3 for documentation.

export type Phase = 'powerplay' | 'middle' | 'death';
export type BatterHand = 'left' | 'right';
export type BowlerType = 'right_pace' | 'left_pace' | 'right_spin' | 'left_spin';

export type Batter = {
  id: string;
  name: string;
  hand: BatterHand;
};

export type NonStriker = {
  id: string;
  name: string;
};

export type BowlerOption = {
  id: string;
  name: string;
  type: BowlerType;
  overs_used: number;
  overs_remaining: number;
};

export type MatchSituation = {
  target: number | null;
  score: number;
  wickets: number;
  balls_remaining: number;
  required_rate: number | null;
};

export type Fielder = {
  slot_id: string;        // "f1".."f9"
  x: number;              // -1..1
  y: number;              // -1..1
  name?: string;          // optional human label (e.g., "deep cover")
};

export type FieldPlacement = {
  bowler_id: string;
  fielders: Fielder[];    // exactly 9
};

export type DecisionWindow = {
  opens_at: string;       // ISO 8601, server clock
  closes_at: string;
};

export type BallEvent = {
  ball_id: string;
  over_number: number;
  ball_number: number;
  phase: Phase;
  batter: Batter;
  non_striker: NonStriker;
  bowler_options: BowlerOption[];
  match_situation: MatchSituation;
  prev_field?: FieldPlacement;
  decision_window: DecisionWindow;
};

export type Decision = {
  ball_id: string;
  user_id: string;
  placement: FieldPlacement;
  client_submitted_at: string;
};

export type DecisionAck =
  | { ok: true }
  | { ok: false; reason: 'late_submission' | 'invalid' | 'unknown_ball' };

export type WicketInfo = {
  type: 'bowled' | 'caught' | 'lbw' | 'run_out' | 'stumped';
  fielder_slot?: string;  // for caught / run_out
};

export type BallResult = {
  runs: number;
  extras: number;
  wicket: WicketInfo | null;
  shot: {
    direction: { x: number; y: number };
    stroke: 'drive' | 'pull' | 'cut' | 'sweep' | 'defend' | 'edge' | 'mis-hit';
  };
};

export type ScoreComponent = {
  raw: number;       // 0..1
  weighted: number;  // points contributed to ball total
};

export type BallScore = {
  components: {
    captain_similarity: ScoreComponent;  // weighted 0..30
    tactical_merit: ScoreComponent;      // weighted 0..50
    outcome_bonus: ScoreComponent;       // weighted 0..20
  };
  total: number;     // 0..100
  explanation: {
    captain: string;
    merit: string;
    outcome: string;
  };
};

export type BallOutcome = {
  ball_id: string;
  captain_placement: FieldPlacement;
  result: BallResult;
  user_score: BallScore;
};

export type LeaderboardRow = {
  user_id: string;
  name?: string;
  total: number;
  balls_played: number;
};

export type OverSummary = {
  over_number: number;
  user_total: number;
  best_ball: { ball_id: string; score: number };
  ranking: LeaderboardRow[];
};

// Socket.IO event payload map. Keys are event names exactly as emitted.
export type ServerToClientEvents = {
  'ball:upcoming': (e: BallEvent) => void;
  'ball:locked': (e: { ball_id: string }) => void;
  'ball:revealed': (e: BallOutcome) => void;
  'leaderboard:update': (e: LeaderboardRow[]) => void;
  'over:complete': (e: OverSummary) => void;
};

export type ClientToServerEvents = {
  'decision:submit': (d: Decision, ack: (a: DecisionAck) => void) => void;
  'user:hello': (h: { user_id: string; name?: string }) => void;
};
