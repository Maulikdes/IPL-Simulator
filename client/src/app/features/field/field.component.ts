import { Component, ElementRef, input, model, signal, viewChild } from '@angular/core';
import type { Fielder } from '@shared/types';
import { snapToNearest } from './positions';

@Component({
  selector: 'app-field',
  standalone: true,
  templateUrl: './field.component.html',
  styleUrl: './field.component.css',
})
export class FieldComponent {
  readonly fielders = model<Fielder[]>([]);
  readonly editable = input(true);

  readonly draggingSlot = signal<string | null>(null);
  readonly svgEl = viewChild<ElementRef<SVGSVGElement>>('svgEl');

  // Captain's actual placement, shown during REVEAL.
  readonly captainFielders = input<Fielder[] | null>(null);

  onPointerDown(event: PointerEvent, slotId: string): void {
    if (!this.editable()) return;
    event.preventDefault();
    this.draggingSlot.set(slotId);
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    const slot = this.draggingSlot();
    if (!slot) return;
    const pt = this.screenToData(event);
    if (!pt) return;
    // Clamp to within the boundary circle.
    const r = Math.hypot(pt.x, pt.y);
    if (r > 1) {
      pt.x = pt.x / r;
      pt.y = pt.y / r;
    }
    this.fielders.update((fs) =>
      fs.map((f) => (f.slot_id === slot ? { ...f, x: pt.x, y: pt.y, name: undefined } : f)),
    );
  }

  onPointerUp(_event: PointerEvent): void {
    const slot = this.draggingSlot();
    if (!slot) return;
    const current = this.fielders().find((f) => f.slot_id === slot);
    if (current) {
      const snapped = snapToNearest(current.x, current.y);
      if (snapped) {
        this.fielders.update((fs) =>
          fs.map((f) =>
            f.slot_id === slot ? { ...f, x: snapped.x, y: snapped.y, name: snapped.name } : f,
          ),
        );
      }
    }
    this.draggingSlot.set(null);
  }

  private screenToData(event: PointerEvent): { x: number; y: number } | null {
    const svg = this.svgEl()?.nativeElement;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
    // SVG y is down; data y is up. Flip.
    return { x: pt.x, y: -pt.y };
  }
}
