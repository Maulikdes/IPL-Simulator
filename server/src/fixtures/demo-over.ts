// Stub data for the replay engine. Six balls of placeholder content
// shaped per shared/types.ts. The real 2019 IPL Final 20th-over data
// (DESIGN §8.3) replaces this once the content track delivers it.

import type {
  BallEvent,
  BallResult,
  BowlerOption,
  FieldPlacement,
} from '@shared/types';

export type BallSpec = {
  // Everything in BallEvent except decision_window — engine fills that
  // in at runtime so timestamps reflect the actual emit moment.
  event_template: Omit<BallEvent, 'decision_window'>;
  captain_placement: FieldPlacement;
  result: BallResult;
};

const bowlerOptions: BowlerOption[] = [
  { id: 'malinga', name: 'Lasith Malinga', type: 'right_pace', overs_used: 3, overs_remaining: 1 },
  { id: 'hardik', name: 'Hardik Pandya', type: 'right_pace', overs_used: 2, overs_remaining: 2 },
  { id: 'krunal', name: 'Krunal Pandya', type: 'left_spin', overs_used: 3, overs_remaining: 1 },
  { id: 'chahar', name: 'Rahul Chahar', type: 'right_spin', overs_used: 3, overs_remaining: 1 },
];

// Legal in non-powerplay (max 5 outside the 30-yard ring at r=0.60):
//   5 outside: third man, deep cover, long off, long on, deep midwicket
//   4 inside:  mid-off, mid-on, point, short fine leg
const standardDeathField: FieldPlacement = {
  bowler_id: 'malinga',
  fielders: [
    { slot_id: 'f1', x: -0.30, y: -0.85, name: 'third man' },
    { slot_id: 'f2', x: -0.70, y:  0.55, name: 'deep cover' },
    { slot_id: 'f3', x: -0.30, y:  0.90, name: 'long off' },
    { slot_id: 'f4', x:  0.30, y:  0.90, name: 'long on' },
    { slot_id: 'f5', x:  0.70, y:  0.55, name: 'deep midwicket' },
    { slot_id: 'f6', x: -0.20, y:  0.55, name: 'mid-off' },
    { slot_id: 'f7', x:  0.20, y:  0.55, name: 'mid-on' },
    { slot_id: 'f8', x: -0.50, y:  0.00, name: 'point' },
    { slot_id: 'f9', x:  0.20, y: -0.30, name: 'short fine leg' },
  ],
};

const shardul = { id: 'shardul', name: 'Shardul Thakur', hand: 'right' as const };
const jadeja = { id: 'jadeja', name: 'Ravindra Jadeja' };

function ball(
  ballNumber: number,
  before: { score: number; wickets: number },
  result: BallResult,
  captainPlacement: FieldPlacement = standardDeathField,
): BallSpec {
  const ballsRemaining = 7 - ballNumber; // before this ball
  const runsNeeded = 150 - before.score;
  const requiredRate = ballsRemaining > 0 ? (runsNeeded * 6) / ballsRemaining : null;

  return {
    event_template: {
      ball_id: `ipl2019_final:over_20:ball_${ballNumber}`,
      over_number: 20,
      ball_number: ballNumber,
      phase: 'death',
      batter: shardul,
      non_striker: jadeja,
      bowler_options: bowlerOptions,
      match_situation: {
        target: 150,
        score: before.score,
        wickets: before.wickets,
        balls_remaining: ballsRemaining,
        required_rate: requiredRate,
      },
    },
    captain_placement: captainPlacement,
    result,
  };
}

export const demoOver: BallSpec[] = [
  ball(1, { score: 141, wickets: 7 }, {
    runs: 1, extras: 0, wicket: null,
    shot: { direction: { x: -0.30, y: 0.40 }, stroke: 'drive' },
  }),
  ball(2, { score: 142, wickets: 7 }, {
    runs: 2, extras: 0, wicket: null,
    shot: { direction: { x: 0.65, y: 0.50 }, stroke: 'pull' },
  }),
  ball(3, { score: 144, wickets: 7 }, {
    runs: 1, extras: 0, wicket: null,
    shot: { direction: { x: 0.20, y: -0.30 }, stroke: 'edge' },
  }),
  ball(4, { score: 145, wickets: 7 }, {
    runs: 4, extras: 0, wicket: null,
    shot: { direction: { x: -0.70, y: 0.55 }, stroke: 'drive' },
  }),
  ball(5, { score: 149, wickets: 7 }, {
    runs: 0, extras: 0, wicket: null,
    shot: { direction: { x: 0.10, y: 0.20 }, stroke: 'defend' },
  }),
  ball(6, { score: 149, wickets: 7 }, {
    runs: 0, extras: 0,
    wicket: { type: 'caught', fielder_slot: 'f5' },
    shot: { direction: { x: 0.30, y: 0.90 }, stroke: 'mis-hit' },
  }),
];
