'use client';

import { useEffect, useState } from 'react';

// Lightweight, framework-agnostic "is any modal currently open" tracker.
//
// Why this exists: the mobile floating pill bottom-nav (Sidebar.tsx) is a
// `position: fixed` element that lives deep in the normal component tree,
// while Modal.tsx (and a couple of hand-rolled modal-like overlays —
// UserProfileModal's own card, TrackingView's screenshot lightbox,
// ImageLightbox) render via `createPortal(..., document.body)`. On Android's
// WebView, layering multiple `backdrop-filter`/`fixed` elements like this is
// known to sometimes composite in the wrong order (a GPU layer-promotion
// quirk), which is what was letting the bottom nav pill visually float on
// top of every modal instead of being covered by it — see the July 2026
// report of the pill overlapping the Employee Profile Card, the Screenshot
// viewer, and other modals.
//
// Rather than fight z-index/compositing edge cases, every modal-like overlay
// registers itself here while open, and the bottom nav simply hides itself
// while any modal is open. This sidesteps the stacking bug entirely instead
// of trying to out-z-index a rendering quirk.
type Listener = (count: number) => void;

let count = 0;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l(count));
}

export function pushModal() {
  count += 1;
  notify();
}

export function popModal() {
  count = Math.max(0, count - 1);
  notify();
}

export function getModalCount() {
  return count;
}

export function subscribeModalStack(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Convenience hook for consumers (e.g. Sidebar's bottom pill nav) that just
// need a boolean re-render whenever the open/closed count changes.
export function useAnyModalOpen(): boolean {
  const [open, setOpen] = useState(() => getModalCount() > 0);
  useEffect(() => subscribeModalStack((c) => setOpen(c > 0)), []);
  return open;
}
