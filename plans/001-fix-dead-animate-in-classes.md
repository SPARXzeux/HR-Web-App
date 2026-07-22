# 001 — Fix dead `animate-in` classes across 7 files

- **Severity**: HIGH
- **Category**: Missed opportunities / broken implementation (the motion was
  written but never actually ships)
- **Base commit**: unavailable (no shell access when this plan was written — run
  `git rev-parse --short HEAD` before you start and record it here)
- **Depends on**: none

## The problem

`tailwindcss-animate` (the Tailwind plugin that gives `animate-in`, `fade-in`,
`slide-in-from-*`, `zoom-in-95` classes actual CSS behind them) is **not installed**
in this project:

- Not listed in `package.json`.
- No `@plugin "tailwindcss-animate";` (or equivalent) in `src/app/globals.css`.

This project uses Tailwind v4's CSS-first config (`@import "tailwindcss";` +
`@theme inline` in `globals.css`, no `tailwind.config.*` file) — there is no config
file where the plugin could be silently registered elsewhere either. It is simply
absent.

Every className that starts with `animate-in` in this codebase therefore compiles
to **no CSS at all**. The duration modifiers (`duration-150`, `duration-200`) are
real Tailwind core utilities and do get emitted, but they set `transition-duration`
on an element that has no paired `transition` property change to animate — so even
those are inert in this usage. The net effect: every one of the following surfaces
currently has **zero entrance motion**, despite the code visibly intending one.

### Every affected location (verified by direct read, not just grep)

| # | File | Line | Current className | What it's supposed to animate |
| --- | --- | --- | --- | --- |
| 1 | `src/components/layout/TopNav.tsx` | 461 | `animate-in fade-in slide-in-from-top-2 duration-150` | Desktop search-results dropdown |
| 2 | `src/components/layout/TopNav.tsx` | 527 | `animate-in fade-in slide-in-from-top-3 duration-150` | Notification bell dropdown |
| 3 | `src/components/layout/TopNav.tsx` | 568 | `animate-in fade-in slide-in-from-top-3 duration-150` | Profile menu dropdown |
| 4 | `src/components/layout/TopNav.tsx` | 592 | `animate-in slide-in-from-top duration-200` | Mobile full-screen search overlay |
| 5 | `src/components/layout/Sidebar.tsx` | 344 | `animate-in fade-in duration-200` | Mobile nav drawer backdrop |
| 6 | `src/components/layout/Sidebar.tsx` | 350 | `animate-in slide-in-from-left duration-200` | Mobile nav drawer panel |
| 7 | `src/app/auth/page.tsx` | 158 | `animate-in fade-in duration-200` | Login page entrance |
| 8 | `src/app/(dashboard)/layout.tsx` | 352 | `animate-in fade-in duration-150` | Login-error banner |
| 9 | `src/app/(dashboard)/layout.tsx` | 919 | `animate-in fade-in duration-200` | First-run consent gate backdrop |
| 10 | `src/app/(dashboard)/layout.tsx` | 920 | `animate-in zoom-in-95 duration-150` | First-run consent gate dialog |
| 11 | `src/app/(dashboard)/hr/leaves/page.tsx` | 178 | `animate-in fade-in duration-150` | Success banner |
| 12 | `src/app/(dashboard)/hr/leaves/page.tsx` | 183 | `animate-in fade-in duration-150` | Error banner |
| 13 | `src/app/(dashboard)/hr/teams/page.tsx` | 432 | `animate-in fade-in duration-150` | Success banner |
| 14 | `src/app/(dashboard)/admin/leaves/page.tsx` | 91 | `animate-in fade-in duration-150` | Success banner |

## The fix

Do **not** install `tailwindcss-animate`. Adding a dependency for this is more
invasive than necessary, and this repo has established its own token vocabulary
(`--ease-out-snappy`, `--ease-in-out-smooth`) that a new plugin's defaults would
sit alongside inconsistently. Instead, replace every dead className with real CSS
using `@starting-style` (supported in Next.js's target browsers via
`@supports (transition-behavior: allow-discrete)` fallback isn't needed here since
none of these elements need `display: none` → visible transitions — they're all
conditionally *mounted*, not toggled via `display`).

### Step 1 — Add two small reusable utility classes to `globals.css`

Open `src/app/globals.css`. Find the existing block (around line 97-107):

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

Immediately after that block, add:

```css
/* Popover/dropdown/banner entrance — small offset + fade, matching the
   `animate-in` classNames these replace (which had no CSS behind them; see
   improve-animations plan 001). Used on menus, dropdowns, banners, and the
   mobile nav drawer. Kept intentionally subtle (6px offset) since several of
   these surfaces (bell, profile, search) are opened tens of times/day. */
.popover-enter {
  animation: popover-in 150ms var(--ease-out-snappy) both;
}
@keyframes popover-in {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Drawer/sheet entrance from an edge — for the mobile nav drawer's slide from
   the left. Distinct from .popover-enter because a drawer's spatial story is
   "slide in from the edge it's anchored to," not "grow from a point." */
.drawer-enter-left {
  animation: drawer-in-left 200ms var(--ease-out-snappy) both;
}
@keyframes drawer-in-left {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}

/* Full-screen surface fade — backdrops, the mobile search overlay, the
   first-run consent gate's backdrop layer, and simple page-level fades
   (login page, banners). */
.fade-enter {
  animation: fade-in-simple 200ms var(--ease-in-out-smooth) both;
}
@keyframes fade-in-simple {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .popover-enter, .drawer-enter-left, .fade-enter {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
```

This gives every location in the table above a real, working, reduced-motion-aware
replacement, using durations that match what the dead classNames already specified
(150ms for popovers/banners, 200ms for drawers/overlays) so the *intended* timing
is preserved exactly — only the mechanism changes from "dead plugin class" to
"real keyframe."

### Step 2 — Replace each className

For every row in the table above, remove the `animate-in ... duration-XXX` tokens
and add the matching new class. Leave every other className on the element
untouched. Examples:

**`TopNav.tsx:461`** (search results dropdown) — change:
```
className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-[60vh] overflow-y-auto divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2 duration-150"
```
to:
```
className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-[60vh] overflow-y-auto divide-y divide-slate-100 popover-enter"
```

**`TopNav.tsx:527`** and **`TopNav.tsx:568`** — same pattern, replace
`animate-in fade-in slide-in-from-top-3 duration-150` with `popover-enter`.

**`TopNav.tsx:592`** (mobile search overlay, full-screen) — replace
`animate-in slide-in-from-top duration-200` with `fade-enter` (a full-screen panel
sliding down from off-screen doesn't read as "anchored to a trigger" the way the
small dropdowns do; a fade reads cleaner here and matches the other full-screen
surfaces in row 9).

**`Sidebar.tsx:344`** (drawer backdrop) — replace `animate-in fade-in duration-200`
with `fade-enter`.

**`Sidebar.tsx:350`** (drawer panel) — replace
`animate-in slide-in-from-left duration-200` with `drawer-enter-left`.

**`auth/page.tsx:158`** — replace `animate-in fade-in duration-200` with
`fade-enter`.

**`layout.tsx:352`** (login-error banner) and the three success-banner locations
(`hr/leaves/page.tsx:178`, `hr/teams/page.tsx:432`, `admin/leaves/page.tsx:91`) and
the error-banner at `hr/leaves/page.tsx:183` — replace `animate-in fade-in
duration-150` with `fade-enter` in each.

**`layout.tsx:919`** (consent gate backdrop) — replace `animate-in fade-in
duration-200` with `fade-enter`.

**`layout.tsx:920`** (consent gate dialog) — this one is a scale-in
(`zoom-in-95`), not a plain fade or the small popover offset — it's a full-screen,
rare (first-login-only), higher-emotional-weight surface, so it earns its own
small scale treatment rather than reusing `.popover-enter`'s 6px/0.98 (too subtle
to register on a full dialog) or `.fade-enter` (loses the "growing into view"
feel appropriate for a first-run gate). Add one more class to the same
`globals.css` block from Step 1:

```css
.dialog-enter {
  animation: dialog-in 250ms var(--ease-out-snappy) both;
}
@keyframes dialog-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```//
(add this inside the same `@media (prefers-reduced-motion: reduce)` block from
Step 1 too — append `, .dialog-enter` to that selector list)

Then replace `animate-in zoom-in-95 duration-150` with `dialog-enter` at
`layout.tsx:920`.

## Scope boundaries

- Do **not** touch any other className on these elements (positioning, color,
  border, shadow classes stay exactly as-is).
- Do **not** install `tailwindcss-animate` or any other dependency.
- Do **not** change the JSX structure, conditional-mount logic (`{isOpen && ...}`),
  or any event handlers on these components.
- Do **not** touch `Modal.tsx` — its entrance animation already works (see plan
  002 for its separate, real issue).

## Verification

1. Run the dev server (`npm run dev`).
2. For each of the 14 locations: trigger it (open the search bar and type, click
   the bell, click the profile avatar, open the mobile nav on a narrow viewport,
   submit an action that shows a success/error banner, log in as a first-time
   employee to see the consent gate) and confirm you now see actual motion —
   previously there was none.
3. **Feel-check**: open Chrome DevTools → Rendering → enable "Emulate CSS media
   feature prefers-reduced-motion: reduce" and re-trigger each surface — confirm
   they now appear instantly with no animation (the reduced-motion override from
   Step 1 should suppress all of them).
4. Slow down and eyeball each one at 0.25x via DevTools' "Animations" panel
   (Chrome) — confirm the popover/drawer entrances feel quick and don't overshoot
   (no bounce was added, so this should already hold), and confirm the consent
   dialog's scale-in doesn't look like it's "growing from nothing" (0.95 is
   subtle on purpose — if it looks too subtle in person, that's a legitimate call
   to bump to 0.92, but don't go below that without a reduced-motion recheck).
