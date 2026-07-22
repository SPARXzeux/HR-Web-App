# 002 — Modal.tsx is missing an exit animation

- **Severity**: HIGH
- **Category**: Physicality & origin / Interruptibility
- **Base commit**: unavailable (no shell access when this plan was written — run
  `git rev-parse --short HEAD` before you start and record it here)
- **Depends on**: none (plans 003 and 005 depend on this one being done first —
  see `plans/README.md`)

## The problem

`src/components/ui/Modal.tsx` is the shared modal used across the app (profile
edit modals, team-chat modals, day-detail popups via `OrgCalendar.tsx`, the
avatar cropper, etc). Current relevant code:

```tsx
export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  ...
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 ...">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
      />
      <div
        className={`relative bg-white w-full shadow-2xl overflow-hidden rounded-t-2xl md:rounded-xl max-h-[92vh] md:max-h-[85vh] md:max-w-lg flex flex-col ${className || ''}`}
        style={{ animation: 'enter-modal 200ms cubic-bezier(0.23, 1, 0.32, 1) forwards' }}
        role="dialog"
        aria-modal="true"
      >
        ...
      </div>
    </div>
  );
}
```

Because the component does `if (!isOpen) return null;`, the moment a caller sets
`isOpen` to `false` the entire modal (backdrop + dialog) is **unmounted on the
same render** — there is no time window for an exit transition to play. The
entrance (`enter-modal`, 200ms) is real and correct; the exit is simply absent.
This means every modal in the app currently *snaps* shut instantly, which reads
as broken/jarring against an entrance that clearly took physicality seriously.
This is a HIGH severity, feel-breaking inconsistency: the same component enters
softly and exits like it hit a wall.

Also note: the backdrop's `transition-opacity duration-200` class is dead code
today — it can only ever transition if the backdrop's opacity actually changes
while mounted, which never happens under the current unmount-on-close logic. It
will become live once this plan wires up a real close transition.

## The fix

Give `Modal` its own internal open/closing state machine so it stays mounted for
the duration of the exit animation, then unmounts. This is the standard pattern
for an unmount-triggers-animation component with no motion library present (no
Framer Motion in this repo — confirmed in recon).

### Step 1 — Add an exit keyframe next to the existing entrance one

Open `src/app/globals.css` and find `@keyframes enter-modal` (search for that
exact string — it's already defined somewhere in the file from the current
entrance animation). Immediately after that `@keyframes enter-modal` block, add:

```css
@keyframes exit-modal {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(8px) scale(0.97);
  }
}
```

This mirrors whatever transform `enter-modal` uses on the way in (check its
`from` values — if it also animates `translateY`/`scale`, match those exact
starting values so the exit is the visual reverse of the entrance, not a
different motion path). If `enter-modal`'s `from` state turns out to be
different from `translateY(8px) scale(0.97)` — for example if it's purely
opacity-based — adjust `exit-modal`'s `to` state to mirror whatever `enter-modal`
actually does, so entrance and exit are symmetric.

### Step 2 — Rewrite Modal.tsx's mount logic

Replace the full component body with a version that tracks a `closing` state and
delays unmount:

```tsx
import { useState, useEffect, useRef } from 'react';
// ...keep all other existing imports...

const EXIT_DURATION_MS = 180; // slightly shorter than the 200ms entrance —
// closing should feel a beat quicker than opening (standard modal convention:
// exits read as "faster" even when only ~10% shorter).

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setClosing(false);
      setShouldRender(true);
    } else if (shouldRender) {
      setClosing(true);
      closeTimer.current = setTimeout(() => {
        setShouldRender(false);
        setClosing(false);
      }, EXIT_DURATION_MS);
    }
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-50 ...">{/* keep existing outer wrapper classes */}
      <div
        className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200 ${closing ? 'opacity-0' : 'opacity-100'}`}
        onClick={onClose}
      />
      <div
        className={`relative bg-white w-full shadow-2xl overflow-hidden rounded-t-2xl md:rounded-xl max-h-[92vh] md:max-h-[85vh] md:max-w-lg flex flex-col ${className || ''}`}
        style={{
          animation: closing
            ? 'exit-modal 180ms cubic-bezier(0.23, 1, 0.32, 1) forwards'
            : 'enter-modal 200ms cubic-bezier(0.23, 1, 0.32, 1) forwards',
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* ...keep everything else in here exactly as it is... */}
      </div>
    </div>
  );
}
```

Key points for whoever executes this:
- Do not change the `ModalProps` type or any prop names — `isOpen`/`onClose`
  still work exactly as every caller already expects. This is an internal-only
  change; no call site anywhere in the app needs to be touched.
- The backdrop's opacity toggle (`opacity-0`/`opacity-100`) rides the existing
  `transition-opacity duration-200` class that was already on that div (it was
  dead code before this fix; now it's live).
- `EXIT_DURATION_MS` (180) must match the number in the inline `animation`
  shorthand for `exit-modal` (180ms) — if you change one, change both.

## Scope boundaries

- Only edit `src/components/ui/Modal.tsx` and add the one `@keyframes exit-modal`
  block to `src/app/globals.css`. Do not touch any file that *calls* `<Modal>`.
- Do not add a motion library (no Framer Motion, no react-transition-group) —
  this is a ~15-line `setTimeout` state machine, not a dependency-worthy problem.
- Do not change the entrance animation, its duration, or its easing — only add
  the missing exit.
- Do not touch `AvatarCropperModal.tsx`'s internal `transformOrigin` logic — that
  file was already checked and is a deliberate, correct decision unrelated to
  this fix (it may render inside `<Modal>` but this change is transparent to it).

## Verification

1. Open any modal in the app (e.g. Profile → Edit Account Details) and close it
   via the backdrop click, the close button, and Escape (if wired) — confirm all
   three paths now show a ~180ms shrink-and-fade-out instead of an instant
   disappearance.
2. Rapid-fire test: open and immediately close the modal (click open, then
   close within 100ms) — confirm there's no visual glitch, stuck backdrop, or
   double-animation. The `useEffect`'s `clearTimeout` on re-open handles this;
   confirm it actually does by watching for a modal that gets "stuck" partially
   transparent.
3. **Feel-check**: use Chrome DevTools' Animations panel, slow to 0.25x, and
   confirm the exit genuinely looks like the reverse of the entrance (same
   transform axis, no pop or jump at the boundary between "closing" and
   "unmounted").
4. Confirm with `prefers-reduced-motion: reduce` emulated (DevTools → Rendering)
   that this doesn't yet get suppressed — that's expected and is the subject of
   plan 003, not this one. Don't add a reduced-motion branch here; that's
   deliberately deferred to keep this diff focused.
