import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { io, type Socket } from 'socket.io-client';
import type {
  BallEvent,
  BallOutcome,
  ClientToServerEvents,
  Decision,
  DecisionAck,
  LeaderboardRow,
  ServerToClientEvents,
} from '@shared/types';
import { UserService } from './user.service';

export type ClientPhase = 'IDLE' | 'SETTLING' | 'WINDOW_OPEN' | 'LOCKED' | 'REVEAL';

const SERVER_URL = 'http://localhost:3001';

@Injectable({ providedIn: 'root' })
export class RealtimeService implements OnDestroy {
  private readonly user = inject(UserService);
  private readonly socket: Socket<ServerToClientEvents, ClientToServerEvents>;

  readonly connected = signal(false);
  readonly phase = signal<ClientPhase>('IDLE');
  readonly currentBall = signal<BallEvent | null>(null);
  readonly latestOutcome = signal<BallOutcome | null>(null);
  readonly leaderboard = signal<LeaderboardRow[]>([]);

  private windowOpenTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.socket = io(SERVER_URL, { transports: ['websocket'] });

    this.socket.on('connect', () => {
      this.connected.set(true);
      this.socket.emit('user:hello', { user_id: this.user.userId() });
    });

    this.socket.on('disconnect', () => {
      this.connected.set(false);
    });

    this.socket.on('ball:upcoming', (event) => {
      this.currentBall.set(event);
      this.latestOutcome.set(null);
      this.phase.set('SETTLING');
      this.scheduleWindowOpen(event.decision_window.opens_at);
    });

    this.socket.on('ball:locked', () => {
      this.clearWindowOpenTimer();
      this.phase.set('LOCKED');
    });

    this.socket.on('ball:revealed', (outcome) => {
      this.latestOutcome.set(outcome);
      this.phase.set('REVEAL');
    });

    this.socket.on('leaderboard:update', (rows) => {
      this.leaderboard.set(rows);
    });
  }

  private scheduleWindowOpen(opensAtIso: string): void {
    this.clearWindowOpenTimer();
    const delay = Math.max(0, new Date(opensAtIso).getTime() - Date.now());
    this.windowOpenTimer = setTimeout(() => {
      // Only advance if we're still in SETTLING — server may have raced past.
      if (this.phase() === 'SETTLING') this.phase.set('WINDOW_OPEN');
    }, delay);
  }

  private clearWindowOpenTimer(): void {
    if (this.windowOpenTimer !== null) {
      clearTimeout(this.windowOpenTimer);
      this.windowOpenTimer = null;
    }
  }

  submitDecision(decision: Decision): Promise<DecisionAck> {
    return new Promise((resolve) => {
      this.socket.emit('decision:submit', decision, resolve);
    });
  }

  async startOver(): Promise<void> {
    // Clear locally so the UI snaps to fresh state immediately rather than
    // showing the previous over's residue while we wait for the first event.
    this.currentBall.set(null);
    this.latestOutcome.set(null);
    this.leaderboard.set([]);
    this.phase.set('IDLE');
    this.clearWindowOpenTimer();

    await fetch(`${SERVER_URL}/start-over`, { method: 'POST' });
  }

  ngOnDestroy(): void {
    this.clearWindowOpenTimer();
    this.socket.disconnect();
  }
}
