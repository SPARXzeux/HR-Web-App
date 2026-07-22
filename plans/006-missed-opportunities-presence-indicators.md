# 006 — Missed opportunity: Sidebar unseen-activity dots appear with no transition

- **Severity**: Additive (not corrective — nothing is broken today, this is a
  polish suggestion)
- **Category**: Missed opportunities
- **Base commit**: unavailable (no shell access when this plan was written — run
  `git rev-parse --short HEAD` before you start and record it here)
- **Depends on**: none

## The observation

`src/components/layout/Sidebar.tsx` has four instances of a small unseen-
activity notification dot, all using the same pattern:

```tsx
<span className="h-2 w-2 rounded-full bg-rose-500" />
```

at approximately lines 225, 279, 315, and 392 (exact surrounding context varies
per nav item — confirm each by reading the file, since line numbers may drift
slightly if other plans in this set are applied first, particularly plan 004
which touches lines 216/238/311/327/382/403 in the same file — re-grep for
`bg-rose-500` and `rounded-full` after applying any earlier plan to confirm
current line numbers before editing).

These dots appear/disappear based on unseen-activity state (new message, new
task, etc.) with a hard `{condition && <span ... />}` mount — no transition at
all. This is a legitimate candidate for a small "something changed" acknowledgment
motion: a brief pop-in when a dot newly appears communicates "this just became
true" rather than the user having to notice a static element that was always
either there or not.

This passes the 4-question Gate used elsewhere in this audit:
- **Frequency**: low-to-medium (fires only when new activity arrives, not on
  every render) — appropriate for a small amount of motion budget.
- **Purpose**: communicates a genuine state change (unseen → seen tracking)
  that the user would otherwise have to notice by comparing before/after states
  themselves.
- **Speed**: a sub-200ms pop reads as immediate, doesn't block navigation.
- **Function**: purely decorative-but-communicative — doesn't gate any
  interaction, so it can't make anything feel slower.

## The fix

This should use CSS `@starting-style`, which is the correct primitive for
"animate an element's very first paint after it mounts" — it lets a freshly
mounted element transition from a `@starting-style` state to its normal state,
without needing a `useEffect`-driven class toggle (unlike Modal's exit problem
in plan 002, entrance-only animation on mount doesn't need the mount/unmount
timing dance — `@starting-style` handles exactly this case natively).

### Step 1 — Add a small utility to `globals.css`

```css
.presence-dot {
  transition: scale 200ms var(--ease-out-snappy), opacity 200ms var(--ease-out-snappy);

  @starting-style {
    scale: 0;
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .presence-dot {
    transition: none;
  }
}
```

Note: `@starting-style` has broad modern-browser support (Chrome/Edge 117+,
Safari 17.5+, Firefox 129+) as of this audit — if this project needs to support
older browsers, verify current caniuse.com support for `@starting-style` before
relying on it, since browser support tables change over time and this plan's
author cannot verify live browser-support data. If it turns out unsupported
in this project's target browser matrix, use a `useEffect`-driven mount-class
toggle instead (add a class one tick after mount, similar in shape to the
approach in plan 002 but without needing unmount-delay logic since dots don't
need an exit animation — they can just disappear instantly when the underlying
condition clears, matching how they already disappear today).

### Step 2 — Apply the class to all four dot instances

Change:
```tsx
<span className="h-2 w-2 rounded-full bg-rose-500" />
```
to:
```tsx
<span className="h-2 w-2 rounded-full bg-rose-500 presence-dot" />
```//
at each of the four locations (re-locate via grep for `bg-rose-500` inside
`Sidebar.tsx` at execution time, per the note above about line drift).

## Scope boundaries

- Only add the `.presence-dot` utility to `globals.css` and apply it to the
  four existing rose dot spans in `Sidebar.tsx`.
- Do not add an exit animation for these dots — they should still disappear
  instantly when the unseen-activity condition clears, matching current
  behavior; this plan only addresses the entrance.
- Do not apply this class to any other element in the app, even if visually
  similar (e.g. do not touch unrelated status-dot patterns in `TicketsView.tsx`
  or elsewhere) — this plan is scoped to exactly the four Sidebar instances
  identified.
- This is optional/additive — if the executing agent or reviewer decides this
  doesn't clear the bar (e.g. team decides dots shouldn't animate at all), it's
  fine to skip this plan entirely; nothing else depends on it.

## Verification

1. Trigger a new unseen-activity state (e.g. receive a new team chat message or
   task assignment while the sidebar is visible) and confirm the dot now pops
   in with a brief scale+fade rather than appearing instantly.
2. Confirm the dot still disappears instantly (no exit animation) when the
   activity is marked seen — this should be unchanged from current behavior.
3. Emulate `prefers-reduced-motion: reduce` in DevTools and confirm the dot
   still appears (just without the transition) — it must never fail to render
   under reduced motion, only skip the animation.
4. Confirm `@starting-style` actually renders correctly in the browser(s) this
   project targets — if the dev environment's browser doesn't support it, the
   dot will just appear instantly with no error, which is an acceptable and
   safe fallback, but flag it to the user if observed so they can decide
   whether the fallback JS approach (see Step 1 note) is worth implementing.
