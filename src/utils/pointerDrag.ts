import type React from 'react';

interface DragCallbacks {
  /** The drag has begun (mouse: moved a few pixels; finger: pressed and held, then moved). */
  onStart: (x: number, y: number) => void;
  onMove: (x: number, y: number) => void;
  /** Released after a real drag. */
  onEnd: (x: number, y: number) => void;
  onCancel?: () => void;
}

const HOLD_MS = 260;      // a finger must press and hold this long before dragging starts
const MOUSE_SLOP = 5;     // px a mouse must move before a press becomes a drag
const TOUCH_SLOP = 8;     // px a finger may wander during the hold before we treat it as a scroll

let lastDragEndedAt = 0;
/** True for a moment after a drag, so the click that follows the release can be ignored. */
export function justDragged(): boolean {
  return Date.now() - lastDragEndedAt < 120;
}

/**
 * Start a drag from a pointerdown. Works with a mouse and with touch.
 * On touch, press-and-hold picks the item up (so ordinary swiping still scrolls the page),
 * then moving drags it and the page is stopped from scrolling.
 */
export function beginPointerDrag(e: React.PointerEvent | PointerEvent, cb: DragCallbacks): void {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const isTouch = e.pointerType !== 'mouse';
  const sx = e.clientX;
  const sy = e.clientY;
  let active = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const activate = (x: number, y: number) => {
    if (active) return;
    active = true;
    if (isTouch) navigator.vibrate?.(12);
    cb.onStart(x, y);
  };

  const onMove = (ev: PointerEvent) => {
    if (!active) {
      const dist = Math.hypot(ev.clientX - sx, ev.clientY - sy);
      if (isTouch) {
        if (dist > TOUCH_SLOP) cleanup(); // moved before the hold finished: the user is scrolling
        return;
      }
      if (dist < MOUSE_SLOP) return;
      activate(ev.clientX, ev.clientY);
    }
    cb.onMove(ev.clientX, ev.clientY);
  };
  const onTouchMove = (ev: TouchEvent) => {
    if (active && ev.cancelable) ev.preventDefault(); // stop the page scrolling under the dragged item
  };
  const onUp = (ev: PointerEvent) => {
    const wasActive = active;
    cleanup();
    if (wasActive) {
      lastDragEndedAt = Date.now();
      if (ev.type === 'pointercancel') cb.onCancel?.();
      else cb.onEnd(ev.clientX, ev.clientY);
    }
  };
  const cleanup = () => {
    if (timer) clearTimeout(timer);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    window.removeEventListener('touchmove', onTouchMove);
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  if (isTouch) timer = setTimeout(() => activate(sx, sy), HOLD_MS);
}
