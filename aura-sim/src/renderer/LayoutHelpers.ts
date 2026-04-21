export function centered(rect: { w: number; h: number }, container: { w: number; h: number }): { x: number; y: number } {
  const x = Math.floor((container.w - rect.w) / 2);
  const y = Math.floor((container.h - rect.h) / 2);
  return { x, y };
}

export function offsetFromTopLeft(rect: { w: number; h: number }, offsetX: number, offsetY: number): { x: number; y: number } {
  return { x: offsetX, y: offsetY };
}

export function createTouchHitBox(x: number, y: number, w: number, h: number): { x1: number; y1: number; x2: number; y2: number } {
  return { x1: x, y1: y, x2: x + w, y2: y + h };
}
