import { Component, input, model } from '@angular/core';
import type { BowlerOption } from '@shared/types';

@Component({
  selector: 'app-bowler-picker',
  standalone: true,
  templateUrl: './bowler-picker.component.html',
  styleUrl: './bowler-picker.component.css',
})
export class BowlerPickerComponent {
  readonly bowlers = input<BowlerOption[]>([]);
  readonly selected = model<string | null>(null);
  readonly editable = input(true);
  readonly captainBowlerId = input<string | null>(null);

  pick(bowler: BowlerOption): void {
    if (!this.editable() || bowler.overs_remaining <= 0) return;
    this.selected.set(bowler.id);
  }
}
