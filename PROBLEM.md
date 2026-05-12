# IPL Coaching Simulator — Problem Definition

## 1. One-line pitch

A live second-screen game where, during every IPL ball, fans pick the field and the bowler they'd choose. Their choices are scored against (a) what the real captain actually did and (b) what historical data says was the smartest tactical option. The most consistently sharp "armchair captains" climb leaderboards and earn rewards.

## 2. Why this is interesting (and hard)

Cricket fans already do this in their heads — "why is he bowling Chahal to a left-hander?", "third man is open, that's a gift" — but there is no platform that captures that intuition, grades it, and makes it competitive. The hard parts are not the UI; they are:

- **Real-time data**: ball-by-ball state must arrive fast enough that fans can decide *before* the bowler runs in.
- **Decision locking**: choices must be sealed before the ball is bowled, or the game is just hindsight.
- **Scoring "tactical merit"**: matching the captain is easy to score; deciding whether a fan's *different* choice was actually smarter requires a model, not a rule.
- **Scale**: an IPL final has ~500M viewers globally. Even a 0.1% conversion is a real-time system problem.

## 3. Target user

Primary: the 18–35 cricket fan who already watches IPL on a phone/TV with a second screen, posts on Reddit/Twitter about captaincy, plays Dream11. They want their cricket IQ to *count* for something.

Secondary: casual fans who learn by playing — the game teaches field names and tactical patterns by doing.

## 4. Core loop (per ball)

```
  Ball N-1 ends
        │
        ▼
  ┌─────────────────────┐
  │ Decision window     │   ~10–20s typical between balls
  │  - Pick bowler*     │   (* only at end-of-over or wicket)
  │  - Place 9 fielders │
  │  - Lock in          │
  └─────────────────────┘
        │
        ▼
  Captain's actual choice revealed
        │
        ▼
  Ball is bowled, outcome resolved
        │
        ▼
  ┌─────────────────────┐
  │ Score this ball     │
  │  - Match-captain    │
  │  - Tactical merit   │
  │  - Outcome bonus    │
  └─────────────────────┘
        │
        ▼
  Update leaderboard, next ball
```

## 5. Scoring model — the heart of the product

A fan's score on a ball is composed of three signals. Weights are tunable; starting point:

| Component | What it measures | Weight |
|---|---|---|
| **Match-captain similarity** | How close was the fan's field/bowler to the actual captain's? | 30% |
| **Historical tactical merit** | Given this batter, bowler, phase, match-up — how does the chosen field/bowler rank historically? | 50% |
| **Outcome bonus** | Did the ball reward this choice? (catch in the placed position, dot ball, wicket) | 20% |

Why this split: pure captain-match makes the game a mimicry contest. Pure outcome-based scoring rewards luck (a top edge to fine leg isn't a vindicated field). Historical merit is the anchor.

**Defining "historical tactical merit"** (this is the modelling problem):
- Build matchup tables from ball-by-ball data: `(batter, bowler_type, over_phase, match_situation) → distribution of outcomes by field setting`.
- Score a field by expected runs conceded + P(wicket) for that batter/bowler/phase.
- For bowling changes, score by expected economy/wicket-rate of available bowlers in the situation.
- Open question: do we use a learned model (xgboost on ball-by-ball features) or a transparent lookup? Transparency matters for fan trust — they'll want to know *why* their choice scored low.

## 6. Data sources

| Need | Source | Notes |
|---|---|---|
| Replay feed (the "live" match) | **Cricsheet** ball-by-ball JSON | Free, open, every IPL match since 2008. Pick one tactically-rich over and emit ball events on a timer. |
| Bowling-change tactical merit | **Cricsheet** aggregated stats | Pre-compute per `(bowler, batter-hand, phase)` economy + wicket-rate. Used to rank the bowlers the fan could have picked. |
| Field-placement tactical merit | **Hand-curated field templates** per `(phase, bowler-type, batter-hand)` | ~6–10 templates covering common matchups (powerplay spin vs LHB, death pace vs RHB, etc.). Fan's field is scored by similarity to the matchup-appropriate template. |
| The captain's *actual* field for our demo over | **Hand-recorded from YouTube highlights** | One-time cost (~30 min) for one over. Beats anything we could scrape. |

**Why field templates instead of historical fielding data:** structured ball-level fielder positions don't exist in any free dataset (Hawkeye/IPL.com have it internally, none of it is public). Trying to scrape commentary text and infer positions is a rabbit hole. Templates are honest about the abstraction and let us ship a defensible scorer in a day, not a week.

**Cricsheet license note:** Open Data Commons, attribution required. Cite cricsheet.org in the demo footer.

---

## 7. MVP scope (what we build first)

**Context: this is a hackathon / GDG demo.** Scope is one over of one past match, replayed as if live. The goal is a tight vertical slice that tells the full story in 90 seconds.

The "one over" constraint is deliberate: it forces us to nail the per-ball loop (decision window → lock → reveal → score) without getting buried in match-long state, fatigue models, or leaderboard polish. If one over feels good, the rest is replication.

- [x] ~~Live ball-by-ball ingestion~~ → **Replay engine**: read a recorded over from JSON, emit ball events on a timer to simulate live pacing
- [ ] Field placement UI: 2D top-down field, 9 draggable fielders snapping to ~20 named positions
- [ ] Bowling change UI: list of available bowlers with overs remaining (only meaningful at over-start)
- [ ] Decision locking: server-authoritative timer that closes input before the simulated ball "delivery"
- [ ] Match-captain similarity scoring (the easy half — geometric distance between fielder positions, exact match on bowler)
- [ ] Rough tactical-merit scorer — a lookup on `(bowler-type, batter-hand, phase) → expected outcomes` is enough to validate the loop
- [ ] Single-session leaderboard (in-memory; no accounts needed for the demo)
- [ ] One-screen post-ball replay: "your field vs captain's field, ball outcome, score breakdown"

## 8. Non-goals (explicitly out of scope for v1)

- Test cricket, other leagues, women's cricket — IPL only
- Batting decisions (shot selection, running) — fielding/bowling only
- Real-money rewards — points + badges only (regulatory minefield)
- DRS / review decisions
- Native mobile apps — web-first, mobile-responsive
- Multiplayer/squad modes — solo only in v1

## 9. Decisions made / open questions

**Decided (2026-05-12):**
- ✅ **Format**: hackathon / GDG demo. Optimise for a compelling end-to-end story.
- ✅ **Data**: mock / replay from a recorded match. No live feed.
- ✅ **First slice**: both features (field + bowling), end-to-end, one over of one match.
- ✅ **Data sources**: Cricsheet for replay + bowling-merit stats; hand-curated field templates for field-merit scoring (see §6).

**Also decided (2026-05-12):**
- ✅ **Stack**: Angular (17+ standalone + signals) + TS frontend, Node + Fastify + Socket.IO backend. SVG field with Angular CDK drag-drop. Plain CSS (no Tailwind). In-memory state. Python+pandas for one-off Cricsheet prep. Localhost demo, no hosting.

**Closed in [DESIGN.md](DESIGN.md):**
- ✅ **Scoring transparency** — yes, three-row breakdown after each reveal (DESIGN §8.1).
- ✅ **Cold start** — pre-fill captain's previous-ball field; ball 1 defaults to a phase-appropriate ring (DESIGN §8.2).

**Closed in [DESIGN.md](DESIGN.md):**
- ✅ **Scoring transparency** — three-row breakdown after each reveal (DESIGN §8.1).
- ✅ **Cold start** — pre-fill captain's previous-ball field (DESIGN §8.2).
- ✅ **Featured over** — 2019 IPL Final 20th over, Malinga to Shardul Thakur. Rationale in DESIGN §8.3.

**Still open — flag as we hit them:**
1. **Field templates dataset**: define the 8 templates (positions × matchup) per DESIGN §7. ~half a day of cricket-watching + tabulation, can run in parallel with the build.
2. **Captain-field-per-ball for the featured over**: ~30 min of YouTube to record Rohit's field for each of the 6 balls. Required before scoring code can be tested end-to-end.

## 10. Technical shape (a first guess, not a commitment)

```
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Live data feed  │───▶│  Match state svc │───▶│  Decision svc    │
│  (vendor API)    │    │  (event stream)  │    │  (open/lock      │
└──────────────────┘    └──────────────────┘    │   windows)       │
                                │                └──────────────────┘
                                ▼                         │
                       ┌──────────────────┐               ▼
                       │  Scoring engine  │     ┌──────────────────┐
                       │  - similarity    │◀────│  Fan choices DB  │
                       │  - merit (ML)    │     └──────────────────┘
                       │  - outcome       │
                       └──────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  Leaderboards    │
                       └──────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  Web client      │
                       │  (field UI,      │
                       │   WebSockets)    │
                       └──────────────────┘
```

## 11. What success looks like

- A fan can play one full match end-to-end without confusion about *when* to decide.
- The score they get at the end feels *earned* — they can point at 2–3 balls where the model agreed they outsmarted the captain.
- Day-2 retention: do they come back for the next match?
- "Cricket IQ" leaderboard becomes shareable — Twitter/Instagram screenshot moments.

---

## Next step — **start the build**

Problem and design are both locked. Next move is hands-on code, following [DESIGN.md §13](DESIGN.md)'s build order.

**Why build before content** (the alternative was hand-curating fixtures first):
- Setup risk dominates. Angular + Socket.IO + CDK drag-drop has unknown-unknowns that only surface when you actually run `ng new`. We'd rather find those on day 1 than day 4.
- Data shapes are already pinned down in DESIGN.md — code doesn't need fixtures to start, it needs stub data shaped correctly.
- A working scaffold with stub data is more recoverable than perfect content with no app to show it in.

**Concrete first moves** (in order):

1. **Scaffold both projects** — `server/` (Node + Fastify + Socket.IO + TS) and `client/` (Angular 17+ standalone). ~30 min.
2. **Author `shared/types.ts`** from [DESIGN.md §3](DESIGN.md) — get both projects importing the same contracts.
3. **Replay engine state machine** ([DESIGN §2](DESIGN.md)) — server emits `ball:upcoming` → `ball:locked` → `ball:revealed` on a timer, with stub `BallEvent` data. No scoring yet.
4. **Client realtime service + match-state signal** — see events arrive, render the raw JSON to screen. Proves the wire works.
5. **SVG field + CDK drag-drop** — the most visually motivating piece. Build early so the team sees the product taking shape.

**Content work that should run in parallel** (one person, not blocking the build):
- Author **one** field template — `death_pace_rhb_aggressive` from [DESIGN §7](DESIGN.md). Just JSON, no code. ~1 hour.
- Record **one** ball of captain field placement from the 2019 IPL Final 20th over (YouTube). Just JSON. ~30 min.

Together that's enough fixture data to drive the scoring engine end-to-end on one ball. The remaining 7 templates and 5 captain fields are polish — backfill once the code works.

**Stop conditions** (when to step back and re-plan):
- If Angular + Socket.IO setup eats more than half a day, cut to polling.
- If CDK drag-drop fights us on SVG, drop to plain mouse events on `<circle>` elements.
- If Hungarian assignment is too fiddly, use greedy nearest-neighbor matching for v1. Scoring won't be perfectly fair but the demo will run.
