// Named cricket field positions in DESIGN.md §6 coordinate system.
// (x, y) in [-1, 1], pitch center at origin, +y = forward (toward bowler),
// +x = leg side for a right-hander. Mirror x for LHB.

export type Ring = 'close' | 'ring' | 'boundary';

export type NamedPosition = {
  name: string;
  x: number;
  y: number;
  ring: Ring;
};

export const NAMED_POSITIONS: NamedPosition[] = [
  // Close
  { name: 'slip',           x: -0.10, y: -0.15, ring: 'close' },
  { name: 'gully',          x: -0.25, y: -0.15, ring: 'close' },
  // Ring
  { name: 'point',          x: -0.50, y:  0.00, ring: 'ring' },
  { name: 'cover',          x: -0.40, y:  0.30, ring: 'ring' },
  { name: 'mid-off',        x: -0.20, y:  0.55, ring: 'ring' },
  { name: 'mid-on',         x:  0.20, y:  0.55, ring: 'ring' },
  { name: 'mid-wicket',     x:  0.40, y:  0.30, ring: 'ring' },
  { name: 'square leg',     x:  0.50, y:  0.00, ring: 'ring' },
  { name: 'short fine leg', x:  0.20, y: -0.30, ring: 'ring' },
  // Boundary
  { name: 'third man',      x: -0.30, y: -0.85, ring: 'boundary' },
  { name: 'deep point',     x: -0.90, y:  0.00, ring: 'boundary' },
  { name: 'deep cover',     x: -0.70, y:  0.55, ring: 'boundary' },
  { name: 'long off',       x: -0.30, y:  0.90, ring: 'boundary' },
  { name: 'long on',        x:  0.30, y:  0.90, ring: 'boundary' },
  { name: 'deep midwicket', x:  0.70, y:  0.55, ring: 'boundary' },
  { name: 'deep square leg',x:  0.90, y:  0.00, ring: 'boundary' },
  { name: 'deep fine leg',  x:  0.30, y: -0.90, ring: 'boundary' },
];

export const SNAP_RADIUS = 0.08;

export function snapToNearest(x: number, y: number): NamedPosition | null {
  let best: NamedPosition | null = null;
  let bestDist = Infinity;
  for (const p of NAMED_POSITIONS) {
    const dx = p.x - x;
    const dy = p.y - y;
    const d = Math.hypot(dx, dy);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return bestDist <= SNAP_RADIUS ? best : null;
}

// Default 9-fielder placement used when no prev_field is available.
import type { Fielder } from '@shared/types';

// Legal default for non-powerplay: 5 outside the 30-yard ring, 4 inside.
// For powerplay you'd need a different default (max 2 outside). v1 demo
// is over 20 (death) so this default is always legal.
export function defaultFielders(): Fielder[] {
  return [
    { slot_id: 'f1', x: -0.30, y: -0.85, name: 'third man' },
    { slot_id: 'f2', x: -0.70, y:  0.55, name: 'deep cover' },
    { slot_id: 'f3', x: -0.30, y:  0.90, name: 'long off' },
    { slot_id: 'f4', x:  0.30, y:  0.90, name: 'long on' },
    { slot_id: 'f5', x:  0.70, y:  0.55, name: 'deep midwicket' },
    { slot_id: 'f6', x: -0.20, y:  0.55, name: 'mid-off' },
    { slot_id: 'f7', x:  0.20, y:  0.55, name: 'mid-on' },
    { slot_id: 'f8', x: -0.50, y:  0.00, name: 'point' },
    { slot_id: 'f9', x:  0.20, y: -0.30, name: 'short fine leg' },
  ];
}
