# IPL Coaching Simulator

A live second-screen game where cricket fans play **armchair captain** ball-by-ball. During each delivery you set the field, pick the bowler, and lock in your choice before the bowler runs in. The server then reveals what the real captain actually did, scores you against (a) the captain's move, (b) the tactically optimal call for the matchup, and (c) what the ball actually produced. The sharpest cricket minds rack up the highest scores.

> **Status: hackathon prototype.** One IPL over (2019 Final, MI vs CSK, 20th over) plays end-to-end with scoring, leaderboard, and a 30-yard-ring legality check. See [Future work](#future-work) for what's deliberately *not* built yet.

---

## Why this exists

Cricket fans already coach in their heads — *"Why is he bowling Chahal to a left-hander?"*, *"Third man is open, that's a gift."* Nothing captures that intuition and grades it. This does.

For the full product framing see [`PROBLEM.md`](PROBLEM.md). For the technical design see [`DESIGN.md`](DESIGN.md).

---

## Quick start

You need Node 22+ and npm 10+.

```bash
# install
cd server && npm install
cd ../client && npm install

# run (two terminals)
cd server && npm run dev          # localhost:3001 (Fastify + Socket.IO)
cd client && npm start            # localhost:4200 (Angular dev server)
```

Open **http://localhost:4200** and click **Start Over**.

**FAST_MODE** for dev — runs a whole over in ~3 seconds instead of ~3 minutes:

```bash
FAST_MODE=1 npm run dev    # inside server/
```

---

## How it works

Per-ball lifecycle, driven server-side ([DESIGN §2](DESIGN.md)):

```
SETTLING (5s)  →  WINDOW_OPEN (15s)  →  LOCKED (1s)  →  REVEAL (8s)
ball:upcoming   user can edit field   ball:locked    ball:revealed
                                                     per-user score
                                                     leaderboard:update
```

Six balls × ~29s ≈ a **3-minute over** in normal mode.

### Scoring (per ball, 0–100)

Three components, weights tunable in code ([DESIGN §5](DESIGN.md)):

| Component | Max | What it measures |
|---|---|---|
| **Captain similarity** | 30 | Same bowler? Same field placement? (Hungarian-style greedy distance match) |
| **Tactical merit** | 50 | Bowler rank for this matchup + field similarity to the ideal template |
| **Outcome bonus** | 20 | Wicket near placed fielder, boundary saved, dot ball — rule-based |

**Illegal field penalty**: if you place more than 5 fielders outside the 30-yard ring (in non-powerplay; max 2 in powerplay), tactical merit is **halved** and the explanation flags the violation. A live red chip in the UI warns you before lock-in.

### What the user sees

- A green SVG cricket field with a dashed 30-yard ring, the brown pitch, and 9 yellow draggable fielders (plus fixed bowler + keeper)
- Fielders snap to one of ~17 named positions (slip, point, cover, mid-off, deep midwicket, etc.) when dropped within 0.08 of a named spot
- Right side: bowler picker (4 buttons with overs-remaining), live legality chip, lock-in button
- During REVEAL: captain's actual field overlaid as dashed red rings, runs/wicket headline, three-row score breakdown with plain-English explanations
- Session score chip in the header showing **`X / Y`** (total / max possible)

---

## Architecture

```
                      ┌───────────────────────────────────┐
                      │     Browser (Angular 18 SPA)      │
                      │                                   │
                      │   Field (SVG + pointer drag)      │
                      │   Bowler picker                   │
                      │   Decision panel + countdown      │
                      │   Score breakdown + leaderboard   │
                      │             │                     │
                      │    RealtimeService (Socket.IO)    │
                      └─────────────┼─────────────────────┘
                                    │ WebSocket
                                    ▼
                ┌───────────────────────────────────────────┐
                │     Node 22 + Fastify + Socket.IO         │
                │                                           │
                │   Replay engine (state machine, timers)   │
                │   Decision lock + store                   │
                │   Scoring (captain · merit · outcome)     │
                │   Legality check                          │
                │   In-memory leaderboard                   │
                │                                           │
                │   Fixtures:                               │
                │     demo-over.ts (the 6 balls)            │
                │     field-templates.ts (1 ideal field)    │
                │     bowler-stats.ts (4 bowlers)           │
                └───────────────────────────────────────────┘
```

State storage is **in-memory** on the server. Server restart wipes the leaderboard. Fine for a demo.

---

## Tech stack

| Layer | Pick |
|---|---|
| Frontend framework | Angular 18 (standalone components + signals) |
| Field rendering | SVG with native pointer events (DESIGN §12 fallback from CDK drag-drop) |
| Styling | Plain CSS, no Tailwind |
| Backend | Node 22 + Fastify + `tsx` for dev runtime |
| Realtime | Socket.IO (typed events shared between client & server) |
| Types contract | `shared/types.ts` + `shared/legality.ts`, imported via `@shared/*` path alias |
| Data prep (future) | Python + pandas for Cricsheet aggregation |

---

## Project structure

```
GDG/
├── PROBLEM.md                  # product framing — what & why
├── DESIGN.md                   # technical design — how
├── README.md                   # you are here
├── shared/                     # cross-project contracts (ESM-marked)
│   ├── package.json            # { "type": "module" }
│   ├── types.ts                # BallEvent, Decision, BallOutcome, etc.
│   └── legality.ts             # fielding-restriction helpers
├── server/
│   └── src/
│       ├── index.ts            # Fastify bootstrap + /health + /start-over
│       ├── config.ts           # phase durations (FAST_MODE override)
│       ├── realtime/
│       │   ├── socket.ts       # Socket.IO server, decision:submit handler
│       │   └── events.ts       # event-name constants
│       ├── replay/
│       │   ├── engine.ts       # the per-ball state machine
│       │   └── clock.ts        # sleep + ISO helpers
│       ├── decisions/
│       │   └── store.ts        # Map<userId, Map<ballId, Decision>>
│       ├── scoring/
│       │   ├── similarity.ts   # greedy global nearest-neighbor + distance similarity
│       │   ├── captain.ts      # §5.1 captain match (30 pts)
│       │   ├── merit.ts        # §5.2 tactical merit (50 pts)
│       │   ├── outcome.ts      # §5.3 outcome bonus (20 pts)
│       │   └── score.ts        # composer + legality penalty
│       ├── leaderboard/
│       │   └── store.ts        # in-memory cumulative scores
│       └── fixtures/
│           ├── demo-over.ts          # 6 balls, hardcoded
│           ├── field-templates.ts    # 1 ideal field (death_pace_rhb_aggressive)
│           └── bowler-stats.ts       # economy/wicket-rate per bowler
└── client/
    └── src/app/
        ├── app.component.{ts,html,css}
        ├── core/
        │   ├── realtime.service.ts   # Socket.IO client, signal-based state
        │   └── user.service.ts       # localStorage UUID
        └── features/
            ├── field/                # SVG field + drag + snap
            ├── bowler-picker/
            └── decision-panel/       # composes all of the above
```

---

## Demo content

The simulator currently ships with **one over** of one match:

> **MI vs CSK, 2019 IPL Final, 20th over.** Lasith Malinga to Shardul Thakur (with Jadeja at non-striker). CSK needed 9 to win. MI won by 1 run. Last-ball wicket caught at long-on. Rationale for picking this over: [DESIGN §8.3](DESIGN.md).

The 6 balls' captain placements and ball outcomes are stubbed approximations of the real over — close enough for the demo loop to feel real. Real ball-by-ball data is on the [future-work list](#future-work).

---

## Future work

In rough priority order. Items marked **★** are the biggest unlocks.

### Content & realism
- **★ Cricsheet ingestion pipeline** — Python + pandas script that converts [Cricsheet](https://cricsheet.org) ball-by-ball JSON into our `BallSpec` format. Unlocks *any* IPL over since 2008 as playable content. Closes the "where does the data come from?" gap and replaces hand-curated fixtures with attribution-licensed open data.
- **Real 2019 IPL Final captain placements** — watch the YouTube highlights, record Rohit Sharma's actual field per ball (~30 min). Currently we use a generic "standard death field" for all 6 balls.
- **More field templates** — only `death_pace_rhb_aggressive` exists today. Author 6–8 more covering powerplay vs spin, middle overs vs LHB, etc.
- **Real bowler stats** — derive `bowler-stats.ts` from Cricsheet aggregation instead of hand-tuned numbers.
- **Multi-match selection** — `/matches` endpoint + a UI dropdown to pick which over to play.

### Cricket-rule credibility
- **Consecutive-over rule for bowler picker** — same bowler can't bowl two overs in a row. Currently unchecked.
- **Powerplay-mode demo over** — add an over from the powerplay (1–6) so the stricter "max 2 outside" restriction matters in a demo.
- **Wides / no-balls / extras** — wire into `BallResult` with free-hit logic.
- **Wicket detail in outcome bonus** — currently any catch within 0.15 of the shot direction gets +20. Better: compare against the captain's actual wicket-taking fielder slot.

### Scoring quality
- **Replace greedy assignment with Hungarian** — `munkres-js` lib, drop-in replacement of `similarity.ts`. Greedy is within ~5% of optimal for n=9; this would close that gap.
- **Per-component weights as config** — currently 30/50/20 hardcoded in `score.ts`; expose as env or tunable.
- **Strict decision-lock validation** — already validates against the window, but no replay-attack defence (e.g., delayed submissions during reconnect).

### UX / demo polish
- **Animations on REVEAL** — fade the captain ghost in, animate the ball trajectory to the shot direction, briefly flash the catching fielder.
- **Sound** — *clack* on lock-in, crowd noise on wicket, sad horn on six conceded.
- **Mobile responsive pass** — works on tablet, breaks on phone. Field needs touch-friendly snap radius.
- **Replay history** — let the user scroll back through past balls of the over.
- **Team / player photos** — currently text-only.

### Multi-user / product
- **Persistent leaderboard** — replace in-memory `Map` with SQLite. Survive server restarts.
- **Authentication & profiles** — currently `localStorage` UUID. Real user accounts unlock cross-session leaderboards and friend battles.
- **Squad mode** — multiple users coach as a team, vote on each decision.
- **Live match mode** — wire to a paid feed (Sportradar / Roanuz) for *actual* live cricket instead of replays. Big regulatory and cost lift.
- **Rewards** — points/badges → merch / brand partnerships / contests. Avoid real-money prizes (regulatory minefield).

### Engineering
- **CI** — typecheck both projects on push.
- **Tests** — vitest for scoring math (greedy assignment, captain similarity, legality). Currently zero automated tests.
- **Deployment** — Vercel (frontend) + Railway/Fly (backend). Currently localhost only.
- **Observability** — structured logs go to stdout. For production: ship to a real log sink, add OpenTelemetry for the WebSocket lifecycle.

---

## Data sources & attribution

- **Cricsheet** ([cricsheet.org](https://cricsheet.org)) — open ball-by-ball data, Open Data Commons license, attribution required. Currently used as the *intended* source for ingestion; not yet wired in (see future work).
- All field templates and bowler stats in this repo are **hand-curated** for the demo, not derived from licensed data.

---

## Documents

- [`PROBLEM.md`](PROBLEM.md) — product framing, scope, decisions, what's deliberately *not* in v1
- [`DESIGN.md`](DESIGN.md) — technical design: data shapes, lifecycle, scoring math, file layout

---

## License

Not yet decided. Hackathon prototype.
