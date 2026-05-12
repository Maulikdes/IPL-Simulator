import type { FastifyBaseLogger } from 'fastify';
import type { BallEvent, BallOutcome, BallScore, FieldPlacement } from '@shared/types';
import type { AppIoServer } from '../realtime/socket';
import { Events } from '../realtime/events';
import { config } from '../config';
import { sleep, isoFromNow } from './clock';
import { demoOver, type BallSpec } from '../fixtures/demo-over';
import { getDecision } from '../decisions/store';
import { scoreDecision, noDecisionScore } from '../scoring/score';
import { recordBallScore, getLeaderboard, resetLeaderboard } from '../leaderboard/store';

export class ReplayEngine {
  private running = false;
  private currentBall: BallEvent | null = null;

  constructor(
    private io: AppIoServer,
    private log: FastifyBaseLogger,
    private balls: BallSpec[] = demoOver,
  ) {}

  isAcceptingDecisions(ballId: string): boolean {
    if (!this.currentBall || this.currentBall.ball_id !== ballId) return false;
    const now = Date.now();
    const opens = new Date(this.currentBall.decision_window.opens_at).getTime();
    const closes = new Date(this.currentBall.decision_window.closes_at).getTime();
    return now >= opens && now < closes;
  }

  knowsBall(ballId: string): boolean {
    return this.currentBall?.ball_id === ballId;
  }

  async start(): Promise<void> {
    if (this.running) {
      this.log.warn('replay engine already running; ignoring start()');
      return;
    }
    this.running = true;
    resetLeaderboard();
    // Tell clients to clear their session-score chip immediately, rather
    // than waiting ~30s for the first ball to score.
    this.io.emit(Events.LeaderboardUpdate, []);
    this.log.info({ ballCount: this.balls.length }, 'replay engine: starting over');

    try {
      let prevField: FieldPlacement | undefined;
      for (const spec of this.balls) {
        await this.runBall(spec, prevField);
        prevField = spec.captain_placement;
      }
      this.log.info('replay engine: over complete');
    } finally {
      this.running = false;
      this.currentBall = null;
    }
  }

  private async runBall(spec: BallSpec, prevField: FieldPlacement | undefined): Promise<void> {
    const ballId = spec.event_template.ball_id;

    // SETTLING — broadcast ball:upcoming with window timestamps
    const opensAt = isoFromNow(config.settlingMs);
    const closesAt = isoFromNow(config.settlingMs + config.windowMs);

    const event: BallEvent = {
      ...spec.event_template,
      prev_field: prevField,
      decision_window: { opens_at: opensAt, closes_at: closesAt },
    };
    this.currentBall = event;

    this.log.info({ ballId, phase: 'SETTLING', opensAt, closesAt }, 'ball:upcoming');
    this.io.emit(Events.BallUpcoming, event);

    await sleep(config.settlingMs + config.windowMs);

    // LOCKED
    this.log.info({ ballId, phase: 'LOCKED' }, 'ball:locked');
    this.io.emit(Events.BallLocked, { ball_id: ballId });
    await sleep(config.lockedMs);

    // REVEAL — score each connected user individually
    this.log.info(
      { ballId, phase: 'REVEAL', runs: spec.result.runs, wicket: !!spec.result.wicket },
      'ball:revealed',
    );
    await this.scoreAndEmitOutcomes(event, spec);
    this.io.emit(Events.LeaderboardUpdate, getLeaderboard());

    await sleep(config.revealMs);
  }

  private async scoreAndEmitOutcomes(event: BallEvent, spec: BallSpec): Promise<void> {
    const sockets = await this.io.fetchSockets();
    for (const sock of sockets) {
      const userId = sock.data.userId;
      const userName = sock.data.userName;
      let userScore: BallScore;
      if (!userId) {
        userScore = noDecisionScore();
      } else {
        const decision = getDecision(userId, event.ball_id);
        userScore = decision
          ? scoreDecision(decision, event, spec.captain_placement, spec.result)
          : noDecisionScore();
        recordBallScore(userId, userName, userScore.total);
      }
      const outcome: BallOutcome = {
        ball_id: event.ball_id,
        captain_placement: spec.captain_placement,
        result: spec.result,
        user_score: userScore,
      };
      sock.emit(Events.BallRevealed, outcome);
    }
  }
}
