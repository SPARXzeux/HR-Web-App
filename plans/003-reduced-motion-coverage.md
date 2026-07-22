# 003 — `prefers-reduced-motion` coverage gap (Modal + Toast)

- **Severity**: MEDIUM
- **Category**: Accessibility
- **Base commit**: unavailable (no shell access when this plan was written — run
  `git rev-parse --short HEAD` before you start and record it here)
- **Depends on**: plan 002 (modal exit animation). This plan adds a
  reduced-motion branch to the `enter-modal`/`exit-modal` animations plan 002
  introduces — do 002 first.

## The problem

A repo-wide grep for `prefers-reduced-motion` turns up exactly **one** match:
the `.stagger-item` rule in `src/app/globals.css`:

```css
.stagger-item {
  animation: stagger-in 320ms var(--ease-out-snappy) both;
}

@media (prefers-reduced-motion: reduce) {
  .stagger-item {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
```

(Plan 001 also adds reduced-motion coverage for its new `.popover-enter`,
`.drawer-enter-left`, `.fade-enter`, and `.dialog-enter` classes as part of its
own scope — so once plan 001 lands, those are covered too. This plan closes the
two remaining gaps plan 001 doesn't touch.)

Every other animated surface in the app ignores the user's OS-level
"reduce motion" preference entirely. The two most load-bearing offenders:

1. **`Modal.tsx`** — the `enter-modal`/`exit-modal` animation (200ms/180ms,
   scale + translate) plays unconditionally, on every single modal open/close
   in the app, for users who have explicitly told their OS they want reduced
   motion.
2. **`src/components/ui/ToastNotification.tsx`** — has a working symmetric
   enter/exit transition:
   ```tsx
   className={`transition-all duration-300 transform ${visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
   ```
   This also ignores `prefers-reduced-motion` completely. (Note: the toast
   bell icon's `animate-bounce` is a *separate*, continuous animation that is
   explicitly out of scope for this audit — see `plans/README.md`'s "Not
   planned" section; that's an existing-animation-intensity concern for
   `review-animations`, not a reduced-motion gap this plan should touch.)

## The fix

### Step 1 — Modal.tsx

This depends on plan 002 already being applied, since that's what introduces
the `closing` state and the `exit-modal` keyframe. After 002 (and optionally
005, which just swaps the literal cubic-bezier for `var(--ease-out-snappy)` —
either order works here), `Modal.tsx`'s dialog div looks like:

```tsx
style={{
  animation: closing
    ? 'exit-modal 180ms var(--ease-out-snappy) forwards'
    : 'enter-modal 200ms var(--ease-out-snappy) forwards',
}}
```

Add a media query check and branch the animation off entirely when reduced
motion is requested. Since this is an inline `style` (not a className), the
cleanest fix is a small hook at the top of `Modal.tsx`:

```tsx
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}
```

Then inside the `Modal` component, call `const reducedMotion = usePrefersReducedMotion();`
and change the `style` to:

```tsx
style={
  reducedMotion
    ? undefined
    : {
        animation: closing
          ? 'exit-modal 180ms var(--ease-out-snappy) forwards'
          : 'enter-modal 200ms var(--ease-out-snappy) forwards',
      }
}
```

Since `shouldRender`/`closing` state timing (the `EXIT_DURATION_MS` timeout from
plan 002) is independent of whether the CSS animation actually plays, the modal
will still unmount correctly after the timeout even with no animation running —
it'll just appear/disappear instantly, which is exactly the desired reduced-
motion behavior (matches the `.stagger-item` precedent: `opacity: 1; transform:
none` — i.e., present immediately, no motion).

If you'd rather keep this in pure CSS instead of a JS hook (more consistent
with how `.stagger-item` does it), an equivalent alternative is to move the
inline `animation` into a className-driven approach and add:

```css
@media (prefers-reduced-motion: reduce) {
  [data-modal-panel] {
    animation: none !important;
  }
}
```
and add `data-modal-panel` as an attribute on the dialog div. Either approach is
acceptable — pick whichever fits better once you're looking at the post-002
code; the JS hook is more explicit and testable, the CSS attribute selector is
fewer lines. Do not do both.

### Step 2 — ToastNotification.tsx

Read the current transition line:
```tsx
className={`transition-all duration-300 transform ${visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
```

Add a `motion-reduce:` Tailwind variant (Tailwind v4 ships this modifier out of
the box — no plugin needed, it maps to `@media (prefers-reduced-motion: reduce)`
under the hood) to zero out the duration and transform distance:

```tsx
className={`transition-all duration-300 transform motion-reduce:transition-none motion-reduce:transform-none ${visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
```

This is simpler than Modal's fix because Tailwind's `motion-reduce:` variant
does the media-query work for you — no JS hook needed here. Confirm `opacity`
still toggles (so the toast still appears/disappears, just without sliding) by
checking that `motion-reduce:transform-none` only cancels the translate, not
the opacity classes already present in the ternary.

## Scope boundaries

- Only touch `Modal.tsx` and `ToastNotification.tsx`.
- Do not touch the toast bell's `animate-bounce` — explicitly out of scope (see
  `plans/README.md`).
- Do not add a global reduced-motion CSS reset (e.g. a blanket
  `* { animation: none !important; }` under the media query) — that's broader
  than this finding and would also suppress `.stagger-item`'s already-correct
  handling and anything plan 001/004 add; keep the fix scoped per-component.
- Do not change `duration-300` or any color/opacity values on the toast — only
  add the `motion-reduce:` variants.

## Verification

1. In Chrome DevTools → Rendering, enable "Emulate CSS media feature
   prefers-reduced-motion: reduce".
2. Open and close a modal — confirm it now appears/disappears instantly with no
   scale/translate motion, while still functioning correctly (backdrop click,
   close button, and any focus-trap behavior still work).
3. Trigger a toast notification (e.g. save a profile edit) — confirm it now
   appears/disappears without the slide, but still fades via opacity (or
   appears instantly if you chose to cancel opacity too — re-check the ternary
   to see which you kept; the plan above only cancels the transform, so opacity
   motion should remain unless you deliberately extended `motion-reduce:` to
   `opacity` classes too, which is not required by this plan).
4. Turn the emulation back off and confirm both surfaces animate exactly as
   they did after plans 001/002/005 (no regression to the normal-motion path).
