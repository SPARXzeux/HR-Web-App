# 005 — Modal.tsx hardcodes a cubic-bezier instead of referencing its token

- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Base commit**: unavailable (no shell access when this plan was written — run
  `git rev-parse --short HEAD` before you start and record it here)
- **Depends on**: plan 002 (modal exit animation). Do plan 002 first — it
  rewrites the same inline `style={{ animation: ... }}` block this plan touches.
  If plan 002 is already done, this plan is a one-line-per-instance follow-up;
  if plan 002 is not done, do it first or you'll be editing stale code.

## The problem

`src/app/globals.css` defines two easing custom properties:

```css
--ease-out-snappy: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out-smooth: cubic-bezier(0.77, 0, 0.175, 1);
```

`Modal.tsx`'s inline animation style writes the literal value instead of
referencing the token:

```tsx
style={{ animation: 'enter-modal 200ms cubic-bezier(0.23, 1, 0.32, 1) forwards' }}
```

`cubic-bezier(0.23, 1, 0.32, 1)` is exactly `--ease-out-snappy`'s value, just
copy-pasted instead of referenced. This is a cohesion nit, not a bug — the
curve is correct today — but it means if `--ease-out-snappy` is ever tuned
(e.g. the app's motion feel is adjusted globally), `Modal.tsx` silently goes
out of sync with everything else that references the token, and nobody would
notice until a visual side-by-side comparison caught the drift.

If plan 002 has been executed first, this same hardcoded-literal pattern will
also exist in the new `exit-modal` animation branch it introduces
(`'exit-modal 180ms cubic-bezier(0.23, 1, 0.32, 1) forwards'`) — fix both.

## The fix

CSS custom properties can be read directly inside a `style` attribute's string
via `var(--token-name)` — this works identically whether the value is set via
inline style or, as here, via a stylesheet-level `:root`/`@theme` declaration,
because `var()` resolves against the cascade at paint time, not against where
it happened to be declared.

### Step 1 — locate the current code

After plan 002 is applied, `Modal.tsx` should contain (inside the dialog div's
`style` prop):

```tsx
style={{
  animation: closing
    ? 'exit-modal 180ms cubic-bezier(0.23, 1, 0.32, 1) forwards'
    : 'enter-modal 200ms cubic-bezier(0.23, 1, 0.32, 1) forwards',
}}
```

(If plan 002 has not been applied yet, the pre-002 single-branch version is:
`style={{ animation: 'enter-modal 200ms cubic-bezier(0.23, 1, 0.32, 1) forwards' }}`
— apply the same substitution to just that one line, then stop; the ternary
form only exists after 002.)

### Step 2 — replace the literal with `var(--ease-out-snappy)`

```tsx
style={{
  animation: closing
    ? 'exit-modal 180ms var(--ease-out-snappy) forwards'
    : 'enter-modal 200ms var(--ease-out-snappy) forwards',
}}
```

That's the entire change — same durations, same curve, just sourced from the
token instead of a copy-pasted literal.

## Scope boundaries

- Only touch the `animation` string(s) inside `Modal.tsx`'s inline `style` prop.
  Do not touch the keyframe percentage/transform values in `globals.css`.
- Do not rename or redefine `--ease-out-snappy` itself.
- Do not go looking for other hardcoded cubic-beziers outside `Modal.tsx` as
  part of this plan — that's a separate sweep, not scoped here (this audit
  found this one instance specifically; if others exist, they weren't part of
  this finding and shouldn't be bundled into this diff).

## Verification

1. Visually compare the modal's open/close animation before and after this
   change — it must look pixel-for-pixel identical (this is a refactor, not a
   visual change). `var(--ease-out-snappy)` resolves to the exact same
   `cubic-bezier(0.23, 1, 0.32, 1)` value.
2. Confirm in DevTools' computed styles panel that the `animation` shorthand on
   the dialog element still resolves to the same cubic-bezier values as before
   the edit.
3. Grep the repo for `cubic-bezier(0.23, 1, 0.32, 1)` and `cubic-bezier(0.77, 0, 0.175, 1)`
   after this change to confirm no other hardcoded instance of these two exact
   curves was accidentally left behind in `Modal.tsx` itself (other files having
   their own hardcoded copies is a separate, out-of-scope finding — not
   introduced or fixed by this plan).
