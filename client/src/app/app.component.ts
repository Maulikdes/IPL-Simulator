import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { RealtimeService } from './core/realtime.service';
import { UserService } from './core/user.service';
import { DecisionPanelComponent } from './features/decision-panel/decision-panel.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, DecisionPanelComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnDestroy {
  readonly realtime = inject(RealtimeService);
  private readonly user = inject(UserService);

  readonly sessionScore = computed(() => {
    const myId = this.user.userId();
    return this.realtime.leaderboard().find((r) => r.user_id === myId) ?? null;
  });

  private readonly tick = signal(Date.now());
  private readonly tickHandle = setInterval(() => this.tick.set(Date.now()), 250);

  readonly secondsToOpen = computed(() => {
    const ball = this.realtime.currentBall();
    if (!ball) return null;
    const ms = new Date(ball.decision_window.opens_at).getTime() - this.tick();
    return ms > 0 ? Math.ceil(ms / 1000) : 0;
  });

  readonly secondsToClose = computed(() => {
    const ball = this.realtime.currentBall();
    if (!ball) return null;
    const ms = new Date(ball.decision_window.closes_at).getTime() - this.tick();
    return ms > 0 ? Math.ceil(ms / 1000) : 0;
  });

  readonly countdownLabel = computed(() => {
    if (this.realtime.phase() === 'SETTLING' && this.secondsToOpen()! > 0) {
      return `opens in ${this.secondsToOpen()}s`;
    }
    if (this.realtime.phase() === 'WINDOW_OPEN' && this.secondsToClose()! > 0) {
      return `${this.secondsToClose()}s left`;
    }
    return null;
  });

  readonly chaseTagline = computed(() => {
    const ball = this.realtime.currentBall();
    if (!ball) return null;
    const s = ball.match_situation;
    if (s.target === null) return null;
    const need = s.target - s.score;
    if (need <= 0) return 'Target met.';
    return `CSK need ${need} from ${s.balls_remaining} ball${s.balls_remaining === 1 ? '' : 's'} to win`;
  });

  async startOver(): Promise<void> {
    await this.realtime.startOver();
  }

  ngOnDestroy(): void {
    clearInterval(this.tickHandle);
  }
}
