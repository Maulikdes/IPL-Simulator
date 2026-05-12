# IPL Coaching Simulator — Technical Design

> This document assumes you've read [PROBLEM.md](PROBLEM.md). It is the "how" to that doc's "what & why". Scope: hackathon MVP — one over, replay-driven, Angular + Node.

---

## 1. System overview

```
                      ┌────────────────────────────────────┐
                      │           Browser (Angular)        │
                      │                                    │
                      │  ┌──────────────┐  ┌────────────┐  │
                      │  │  Field UI    │  │  Bowler    │  │
                      │  │  (SVG +      │  │  picker    │  │
                      │  │   CDK drag)  │  │            │  │
                      │  └──────┬───────┘  └─────┬──────┘  │
                      │         │                │         │
                      │         ▼                ▼         │
                      │  ┌────────────────────────────┐    │
                      │  │   RealtimeService          │    │
                      │  │   (Socket.IO client)       │    │
                      │  └─────────────┬──────────────┘    │
                      └────────────────┼───────────────────┘
                                       │ WebSocket
                                       ▼
                ┌────────────────────────────────────────────┐
                │            Node + Fastify + Socket.IO      │
                │                                            │
                │  ┌────────────┐    ┌─────────────────┐     │
                │  │  Replay    │───▶│   Match-state   │     │
                │  │  engine    │    │   broadcaster   │     │
                │  └────────────┘    └────────┬────────┘     │
                │                             │              │
                │                             ▼              │
                │  ┌────────────┐    ┌─────────────────┐     │
                │  │  Decision  │───▶│   Scoring       │     │
                │  │  lock      │    │   engine        │     │
                │  └────────────┘    └────────┬────────┘     │
                │                             │              │
                │                             ▼              │
                │                    ┌─────────────────┐     │
                │                    │  Leaderboard    │     │
                │                    │  (in-memory)    │     │
                │                    └─────────────────┘     │
                │                                            │
                │      fixtures/                             │
                │       ├── demo-over.json                   │
                │       ├── field-templates.json             │
                │       └── bowler-stats.json                │
                └────────────────────────────────────────────┘
```

One Node process, one Angular SPA, all state in memory, fixtures on disk.

---

## 2. Per-ball lifecycle (the state machine)

This is the heart of the system. Every ball goes through these phases, driven server-side:

```
   ┌─────────────┐  5s   ┌─────────────┐  15s   ┌─────────────┐  1s   ┌─────────────┐  8s
   │  SETTLING   │──────▶│ WINDOW_OPEN │───────▶│   LOCKED    │──────▶│   REVEAL    │────┐
   │  (5s pause) │       │  (decide!)  │        │ (no edits)  │       │ (show result)│   │
   └─────────────┘       └─────────────┘        └─────────────┘       └─────────────┘    │
          ▲                                                                              │
          └──────────────────────────────────────────────────────────────────────────────┘
                                          next ball
```

Total per ball: ~29s. Six balls + 10s end-of-over summary ≈ **3 min demo**. Tight enough to hold a judge's attention.

**Phase responsibilities:**

| Phase | Server emits | Client shows | Client → server allowed? |
|---|---|---|---|
| SETTLING | `ball:upcoming` (with `opens_at`) | Countdown + preview of upcoming ball | No |
| WINDOW_OPEN | (already sent) | Field UI + bowler picker active | `decision:submit` (idempotent — last one wins) |
| LOCKED | `ball:locked` | UI freezes; "waiting for delivery..." | Rejected with `late_submission` |
| REVEAL | `ball:revealed` | Captain's actual field overlay, outcome animation, score breakdown | No |

**Lock authority is the server, period.** The client may show a countdown but the server's clock decides what's late. This is the answer to "what stops me from changing my answer after the ball?"

---

## 3. Data contracts

All shapes live in `shared/types.ts` and are imported by both server and client (a tiny `shared/` folder; not a full monorepo, just shared file).

### 3.1 Ball event (server → client at SETTLING)

```ts
type BallEvent = {
  ball_id: string;              // "demo_match:over_19:ball_3"
  over_number: number;          // 19 (1-indexed)
  ball_number: number;          // 3 (1-indexed within over)
  phase: 'powerplay' | 'middle' | 'death';
  batter: { id: string; name: string; hand: 'left' | 'right' };
  non_striker: { id: string; name: string };
  bowler_options: BowlerOption[];     // 4-6 bowlers available; includes the actual one
  match_situation: MatchSituation;
  prev_field?: FieldPlacement;        // captain's field on previous ball (for cold-start pre-fill)
  decision_window: {
    opens_at: string;           // ISO 8601, server clock
    closes_at: string;          // ISO 8601
  };
};

type BowlerOption = {
  id: string;
  name: string;
  type: 'right_pace' | 'left_pace' | 'right_spin' | 'left_spin';
  overs_used: number;
  overs_remaining: number;     // T20 max 4 per bowler
};

type MatchSituation = {
  target: number | null;       // null in first innings
  score: number;
  wickets: number;
  balls_remaining: number;
  required_rate: number | null;
};
```

### 3.2 Field placement (both directions)

```ts
type FieldPlacement = {
  bowler_id: string;
  fielders: Fielder[];          // exactly 9 (keeper + bowler implicit)
};

type Fielder = {
  slot_id: string;              // "f1"..."f9", stable across renders
  x: number;                    // -1.0 to 1.0, pitch center at (0,0)
  y: number;                    // -1.0 to 1.0
  name?: string;                // optional human label ("deep cover"), set by client snap
};
```

**Coordinate system:** top-down view, batter facing +y, square leg at +x, off side at -x for a RHB (mirrored for LHB). Pitch runs vertically through origin. (-1, -1) = boundary corner, (1, 1) = opposite corner. Stumps at (0, -0.05) and (0, 0.05).

### 3.3 Decision (client → server during WINDOW_OPEN)

```ts
type Decision = {
  ball_id: string;
  user_id: string;              // local-only id, no auth
  placement: FieldPlacement;
  client_submitted_at: string;  // ISO; informational only — server uses its own clock
};
```

### 3.4 Ball outcome (server → client at REVEAL)

```ts
type BallOutcome = {
  ball_id: string;
  captain_placement: FieldPlacement;   // the truth, revealed
  result: {
    runs: number;
    extras: number;
    wicket: WicketInfo | null;
    shot: {
      direction: { x: number; y: number };
      stroke: 'drive' | 'pull' | 'cut' | 'sweep' | 'defend' | 'edge' | 'mis-hit';
    };
  };
  user_score: BallScore;
};

type WicketInfo = {
  type: 'bowled' | 'caught' | 'lbw' | 'run_out' | 'stumped';
  fielder_slot?: string;        // if caught/run_out
};

type BallScore = {
  components: {
    captain_similarity: { raw: number; weighted: number };  // raw 0-1, weighted 0-30
    tactical_merit:     { raw: number; weighted: number };  // raw 0-1, weighted 0-50
    outcome_bonus:      { raw: number; weighted: number };  // raw 0-1, weighted 0-20
  };
  total: number;                 // 0-100
  explanation: {
    captain: string;
    merit: string;
    outcome: string;
  };
};
```

---

## 4. Socket.IO event contract

```
server → client
  ball:upcoming        BallEvent           (start of SETTLING)
  ball:locked          { ball_id }         (start of LOCKED)
  ball:revealed        BallOutcome         (start of REVEAL)
  leaderboard:update   LeaderboardRow[]    (after each score)
  over:complete        OverSummary         (after ball 6)

client → server
  decision:submit      Decision            (ack: { ok: true } or { ok: false, reason: 'late_submission' | 'invalid' })
  user:hello           { user_id, name? }  (on connect, registers session)
```

Connection model: one room per match (only one match in MVP, so effectively a global broadcast). Decisions are per-socket and last-write-wins within the WINDOW_OPEN phase.

---

## 5. Scoring formula (concrete numbers)

Each ball is scored 0–100. The breakdown:

### 5.1 Captain similarity (max 30 points)

- **Bowler match** (10 pts): `10` if `user.bowler_id === captain.bowler_id`, else `0`.
- **Field similarity** (20 pts): Hungarian assignment between user's 9 fielders and captain's 9 fielders. For each matched pair, compute `sim = max(0, 1 − (distance / 0.5))` (distances above 0.5 = "totally different position" = 0). Average across 9 pairs, multiply by 20.

```
captain_similarity.raw     = 0.4 * bowler_match + 0.6 * avg_field_sim
captain_similarity.weighted = captain_similarity.raw * 30
```

### 5.2 Tactical merit (max 50 points)

- **Bowler merit** (20 pts): rank the user's chosen bowler among `bowler_options` by `expected_economy` for this `(batter_hand, phase)` (lower = better). Map rank to score: rank 1 of N → 20, rank N → 0, linear interpolation.
- **Field merit** (30 pts): find the matchup-appropriate template from `field-templates.json` (lookup key: `phase × bowler_type × batter_hand`). Hungarian similarity between user's field and template's ideal positions, same formula as 5.1. Multiply average by 30.

```
tactical_merit.raw      = (bowler_merit_pts + field_merit_pts) / 50
tactical_merit.weighted = bowler_merit_pts + field_merit_pts    // already 0-50
```

### 5.3 Outcome bonus (max 20 points)

Rule-based, cricket-flavoured:

| Situation | Bonus |
|---|---|
| Wicket caught, user had a fielder within 0.15 of the catching position | +20 |
| Boundary saved (ball clearly heading to fence but stopped) and user had a fielder in the line | +10 |
| Dot ball + user picked a "defensive" template variant | +5 |
| Six conceded + user had no deep fielder in that line | -10 (yes, can go negative) |
| None of the above | 0 |

Clamped to [0, 20] for the final weighted value (so a -10 day caps the score at 80, not negative).

### 5.4 Worked example

Death over, Bumrah bowling to Dhoni (RHB). Fan submits a field similar to the captain's but picked Pandya over Bumrah; ball goes for 4 to deep cover where the fan had placed a fielder.

```
captain_similarity:
  bowler_match    = 0          (picked Pandya, captain picked Bumrah)
  avg_field_sim   = 0.85       (fields were very close)
  raw             = 0.4*0 + 0.6*0.85 = 0.51
  weighted        = 0.51 * 30 = 15.3

tactical_merit:
  bowler_merit    = 5 / 20     (Pandya ranks 3 of 4 for this matchup)
  field_merit     = 24 / 30    (field is 80% similar to "death pace vs RHB aggressive" template)
  weighted        = 5 + 24 = 29

outcome_bonus:
  user had a fielder at deep cover, ball went there for 4 (saved a six)
  weighted        = 10

TOTAL = 15.3 + 29 + 10 = 54.3
```

The explanation strings make this human-readable in the UI.

---

## 6. Field coordinate system & default positions

11 fielders total. Bowler and keeper are fixed slots (not draggable). 9 outfielders are draggable.

```
                    +y (down the wicket)
                         │
                    ┌────┴────┐
                    │  bowler │      (fixed)
                    │   end   │
                    │         │
       -x ──────────┼─────────┼────────── +x
       (off side    │  pitch  │  (leg side
        for RHB)    │         │   for RHB)
                    │ stumps  │
                    │         │
                    │  keeper │      (fixed)
                    │   end   │
                    └────┬────┘
                         │
                         -y
```

Named positions (with approximate (x,y) for RHB; mirror x for LHB):

| Position | x | y | Ring |
|---|---|---|---|
| Slip 1 | -0.10 | -0.15 | close |
| Gully | -0.25 | -0.15 | close |
| Point | -0.50 | 0.00 | ring |
| Cover | -0.40 | 0.30 | ring |
| Mid-off | -0.20 | 0.55 | ring |
| Mid-on | 0.20 | 0.55 | ring |
| Mid-wicket | 0.40 | 0.30 | ring |
| Square leg | 0.50 | 0.00 | ring |
| Fine leg | 0.30 | -0.50 | ring |
| Third man | -0.30 | -0.85 | boundary |
| Deep point | -0.90 | 0.00 | boundary |
| Deep cover | -0.70 | 0.55 | boundary |
| Long off | -0.30 | 0.90 | boundary |
| Long on | 0.30 | 0.90 | boundary |
| Deep midwicket | 0.70 | 0.55 | boundary |
| Deep square leg | 0.90 | 0.00 | boundary |
| Deep fine leg | 0.30 | -0.90 | boundary |

The field UI snaps a dragged fielder to the nearest named position within a radius of 0.08 (otherwise leaves it free). This makes setting standard fields fast while still allowing creativity.

---

## 7. Field templates dataset

Lives in `fixtures/field-templates.json`. ~8 templates for v1:

| Template ID | Phase | Bowler type | Batter hand | Variant |
|---|---|---|---|---|
| `pp_pace_rhb_standard` | powerplay | right_pace | right | standard |
| `pp_pace_lhb_standard` | powerplay | right_pace | left | standard |
| `pp_spin_rhb_standard` | powerplay | right_spin | right | standard |
| `middle_spin_rhb_attacking` | middle | right_spin | right | attacking |
| `middle_spin_rhb_defensive` | middle | right_spin | right | defensive |
| `death_pace_rhb_aggressive` | death | right_pace | right | aggressive |
| `death_pace_lhb_aggressive` | death | right_pace | left | aggressive |
| `death_pace_rhb_protect_short` | death | right_pace | right | protect-short-side |

Each template has the canonical 9-fielder placement. Hand-curated from cricket-watching + a few hours of YouTube death-over analysis.

**Shape:**

```json
{
  "template_id": "death_pace_rhb_aggressive",
  "label": "Death over, right-arm pace vs RHB (aggressive)",
  "phase": "death",
  "bowler_type": "right_pace",
  "batter_hand": "right",
  "variant": "aggressive",
  "fielders": [
    { "name": "third man",        "x": -0.30, "y": -0.85, "ring": "boundary" },
    { "name": "deep point",       "x": -0.90, "y":  0.00, "ring": "boundary" },
    { "name": "deep cover",       "x": -0.70, "y":  0.55, "ring": "boundary" },
    { "name": "long off",         "x": -0.30, "y":  0.90, "ring": "boundary" },
    { "name": "long on",          "x":  0.30, "y":  0.90, "ring": "boundary" },
    { "name": "deep midwicket",   "x":  0.70, "y":  0.55, "ring": "boundary" },
    { "name": "deep square leg",  "x":  0.90, "y":  0.00, "ring": "boundary" },
    { "name": "short fine leg",   "x":  0.20, "y": -0.30, "ring": "ring" },
    { "name": "mid-off",          "x": -0.20, "y":  0.55, "ring": "ring" }
  ]
}
```

---

## 8. UX decisions (closing open questions from PROBLEM.md §9)

### 8.1 Scoring transparency — **YES, show breakdown**

After REVEAL, the score panel shows three rows (captain / merit / outcome) with the raw score, the weighted contribution, and the one-line `explanation` from `BallScore.explanation`. This is the demo's "aha" moment — without it the score is a black box.

### 8.2 Cold start — **pre-fill captain's previous-ball field**

Server includes `prev_field` in the `BallEvent`. Client renders it as the starting position. Fan edits rather than starts blank. Justification:
- A 15s decision window is brutal from a blank canvas.
- Real captains change 1–2 fielders per ball, not 9.

Ball 1 has no previous — use a standard ring field for the phase × bowler-type as the default.

### 8.3 Which over — **DECIDED: 2019 IPL Final, 20th over (Malinga's last over)**

**Pick: MI vs CSK, 2019 IPL Final, 20th over of the CSK chase — Lasith Malinga bowling to Shardul Thakur (with Ravindra Jadeja at non-striker).**

Why this wins on every demo criterion:
- **Fame**: MI won by 1 run, last-ball wicket, Malinga's final IPL over. Universal recognition for any Indian cricket-watching audience.
- **Right-arm pace**: Malinga ✓ — matches our most-developed `death_pace_rhb_aggressive` template.
- **Stakes**: The Final. CSK needed 9 to win. Cannot dramatize this more.
- **Tactical richness**: Rohit Sharma (MI captain) moved fielders multiple times within the over. Active captaincy = rich decision points for the fan.
- **Last-ball wicket**: Thakur caught at long-on. Perfect outcome-bonus showcase — fans who placed a fielder there get the maximum +20.
- **Living debate**: This over is still re-litigated on cricket social media — was the bowler choice right (Malinga over Bumrah)? Was long-on a deliberate trap? This is exactly the "armchair captain" energy our product captures.

**Demo narrative hook:**
> "You are Rohit Sharma at the end of the 2019 IPL Final. CSK needs 9 to win, Malinga has one over left in his IPL career. Set your field, pick your bowler, see if you'd have out-captained Rohit."

**Pre-build verification task (~30 min on YouTube highlights):**
1. Ball-by-ball outcomes (runs, wickets, extras) for the 6 balls.
2. Captain's field placement *for each ball* (Rohit changed it between balls — capture all 6 setups, not just the over-start).
3. Bowler options realistically available to the captain at that point (Bumrah's overs left, Hardik's overs left, etc.) → populates `bowler_options` in the `BallEvent`.

**Rejected runners-up:**
- *2023 Final last over* (Mohit Sharma to Jadeja): only 2 balls played before the winning six. We need 6.
- *2022 Final death overs*: Rashid Khan (leg-spin) bowled the key ones — doesn't fit our `right_pace` template.
- *2024 Final*: Mitchell Starc was KKR's death weapon — left-arm pace, wrong template.
- *Bumrah's various death overs*: tactically rich but no single over has the universal pull of "Malinga's last over."

---

## 9. Project layout

Two npm projects in a single repo, no monorepo tooling. Just two folders.

```
GDG/
  PROBLEM.md
  DESIGN.md
  shared/
    types.ts                       # symlinked or copied into both projects
  server/
    src/
      index.ts                     # Fastify bootstrap, Socket.IO attach
      config.ts                    # ports + timing constants (SETTLING_MS, etc.)
      realtime/
        socket.ts                  # Socket.IO server, room mgmt
        events.ts                  # event name constants + payload types (re-exports shared)
      replay/
        engine.ts                  # state machine: SETTLING → WINDOW_OPEN → LOCKED → REVEAL
        clock.ts                   # server-clock helpers
        data-loader.ts             # reads demo-over.json
      decisions/
        store.ts                   # Map<user_id, Map<ball_id, Decision>>
        lock.ts                    # validates submission timestamp against server clock
      scoring/
        similarity.ts              # Hungarian assignment + distance helper
        captain.ts                 # §5.1
        merit.ts                   # §5.2
        outcome.ts                 # §5.3
        score.ts                   # composes the three; produces BallScore + explanations
      leaderboard/
        store.ts                   # Map<user_id, total>; emits leaderboard:update
      fixtures/
        demo-over.json             # one over, fully specified
        field-templates.json       # §7
        bowler-stats.json          # economy per (bowler × batter_hand × phase)
    package.json
    tsconfig.json
  client/
    src/
      app/
        app.component.ts           # root
        app.routes.ts
        core/
          realtime.service.ts      # Socket.IO client; exposes observables/signals
          match-state.service.ts   # current BallEvent as a signal
          user.service.ts          # local user_id (uuid in localStorage)
        features/
          decision-panel/
            decision-panel.component.ts   # composes field + bowler-picker + lock button + countdown
          field/
            field.component.ts            # SVG field + CDK drag-drop
            field.component.css
            positions.ts                  # named position list from §6
            snapping.ts                   # nearest-position snap logic
          bowler-picker/
            bowler-picker.component.ts
          reveal/
            reveal.component.ts           # captain's field overlay + outcome animation
            score-breakdown.component.ts  # the §8.1 panel
          leaderboard/
            leaderboard.component.ts
        shared/
          types.ts                        # mirror of shared/types.ts
    angular.json
    package.json
  python/                                  # offline only; not part of runtime
    prep_cricsheet.py                      # outputs bowler-stats.json
    requirements.txt
```

---

## 10. Run instructions (target state)

```bash
# one-time setup
cd server && npm install
cd ../client && npm install

# offline data prep (only when refreshing fixtures)
cd ../python && pip install -r requirements.txt
python prep_cricsheet.py    # writes ../server/src/fixtures/bowler-stats.json

# run the demo
cd ../server && npm run dev       # starts on :3001
cd ../client && npm start         # starts Angular dev server on :4200
```

Open `localhost:4200`, click "Start over", watch the lifecycle drive itself.

---

## 11. What's not in this design (and is fine that way)

- **Auth** — `user_id` is a UUID in `localStorage`. No login.
- **Persistence** — server restart resets the leaderboard. Fine for a demo.
- **Multiplayer/squad** — solo only.
- **Mobile-specific layout** — desktop demo. Responsive enough for a tablet, not a phone.
- **Tests** — manual run-through is the QA. We're not paid by line coverage.
- **CI** — none. Localhost demo.

---

## 12. Risks & where they'll bite

| Risk | Probability | Mitigation |
|---|---|---|
| Hungarian assignment in pure TS is finicky | Medium | Use the [`munkres-js`](https://www.npmjs.com/package/munkres-js) lib; don't write it from scratch. |
| Replay-engine state machine drift (timers slip) | Medium | Server uses `Date.now()` deltas, not `setInterval` arithmetic. Clients reconcile to server timestamps. |
| Field templates feel arbitrary in scoring | High | The §8.1 explanation strings hide the arbitrariness — fans accept "your field matches the aggressive death template at 65%" even though that's a hand-built reference. |
| Demo crash mid-presentation | Low but fatal | Keep a screen-recording of a clean run as backup. Practice the demo end-to-end three times before the day. |
| 15s window feels too short / too long | Medium | Make `WINDOW_MS` a config constant; tune live during practice runs. |

---

## 13. Build order (suggested)

1. **Data shapes + shared/types.ts** — agreement on the contracts.
2. **Server: replay engine state machine** — gets balls flowing on a timer, no scoring yet.
3. **Server: Socket.IO event plumbing** — broadcast `ball:upcoming` and `ball:revealed` with stubbed data.
4. **Client: realtime service + match-state signal** — see events arrive, render JSON to screen.
5. **Client: SVG field + CDK drag-drop** — the most visually impressive piece; build it early to motivate the team.
6. **Client: bowler picker** — trivial after the field is done.
7. **Client: decision submission + countdown** — closes the loop end-to-end (even with stub scoring).
8. **Server: scoring engine** — captain similarity first (easy), then merit (template lookup), then outcome bonus.
9. **Client: reveal screen + score breakdown** — the demo's payoff moment.
10. **Fixtures: hand-curate the demo over** — pick the over, record captain's actual field per ball from YouTube.
11. **Field templates dataset** — 8 templates, hand-built.
12. **Polish pass** — CSS, animations, error handling on socket disconnects.

Each step is a working checkpoint. If we run out of time at step 7 we still have a coherent (if scoreless) demo.
