import { Component, computed, effect, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type { DecisionAck, Fielder } from '@shared/types';
import { checkLegality } from '@shared/legality';
import { RealtimeService } from '../../core/realtime.service';
import { UserService } from '../../core/user.service';
import { FieldComponent } from '../field/field.component';
import { BowlerPickerComponent } from '../bowler-picker/bowler-picker.component';
import { defaultFielders } from '../field/positions';

@Component({
  selector: 'app-decision-panel',
  standalone: true,
  imports: [FieldComponent, BowlerPickerComponent, DecimalPipe],
  templateUrl: './decision-panel.component.html',
  styleUrl: './decision-panel.component.css',
})
export class DecisionPanelComponent {
  readonly realtime = inject(RealtimeService);
  private readonly user = inject(UserService);

  readonly fielders = signal<Fielder[]>(defaultFielders());
  readonly selectedBowlerId = signal<string | null>(null);

  readonly submitting = signal(false);
  readonly lastAck = signal<DecisionAck | null>(null);
  readonly submittedBallId = signal<string | null>(null);

  readonly editable = computed(() => {
    const p = this.realtime.phase();
    return p === 'SETTLING' || p === 'WINDOW_OPEN';
  });

  readonly captainFielders = computed(() => {
    if (this.realtime.phase() !== 'REVEAL') return null;
    return this.realtime.latestOutcome()?.captain_placement.fielders ?? null;
  });

  readonly captainBowlerId = computed(() => {
    if (this.realtime.phase() !== 'REVEAL') return null;
    return this.realtime.latestOutcome()?.captain_placement.bowler_id ?? null;
  });

  readonly legality = computed(() => {
    const ball = this.realtime.currentBall();
    if (!ball) return null;
    return checkLegality(this.fielders(), ball.phase);
  });

  constructor() {
    // When a new ball arrives, reset state from prev_field or defaults.
    effect(() => {
      const ball = this.realtime.currentBall();
      if (!ball) return;
      if (this.submittedBallId() === ball.ball_id) return; // already initialised for this ball
      this.submittedBallId.set(null);
      this.lastAck.set(null);

      const prev = ball.prev_field;
      this.fielders.set(prev?.fielders ?? defaultFielders());
      const initialBowler = prev?.bowler_id
        ?? ball.bowler_options.find((b) => b.overs_remaining > 0)?.id
        ?? null;
      this.selectedBowlerId.set(initialBowler);
    });
  }

  async lockIn(): Promise<void> {
    const ball = this.realtime.currentBall();
    const bowler = this.selectedBowlerId();
    if (!ball || !bowler || this.submitting()) return;

    this.submitting.set(true);
    const ack = await this.realtime.submitDecision({
      ball_id: ball.ball_id,
      user_id: this.user.userId(),
      placement: { bowler_id: bowler, fielders: this.fielders() },
      client_submitted_at: new Date().toISOString(),
    });
    this.submitting.set(false);
    this.lastAck.set(ack);
    if (ack.ok) this.submittedBallId.set(ball.ball_id);
  }
}
