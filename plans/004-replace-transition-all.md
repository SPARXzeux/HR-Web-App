# 004 — Replace `transition-all` with named-property transitions

- **Severity**: MEDIUM
- **Category**: Performance
- **Base commit**: unavailable (no shell access when this plan was written — run
  `git rev-parse --short HEAD` before you start and record it here)
- **Depends on**: none

## The problem

`transition-all` (Tailwind's `transition-property: all`) forces the browser to
watch every animatable CSS property on the element for changes each frame,
instead of just the ones that actually change. On elements that also have
`hover:` color/shadow/border changes plus layout-affecting properties nearby,
this is needless per-frame work, and it makes it impossible to reason about
what's actually animating from the className alone — a maintainer has to check
every property on the element to know what `transition-all` is doing.

Confirmed instances (verified by direct file read, not just grep):

| # | File | Line | Context |
| --- | --- | --- | --- |
| 1 | `src/components/layout/TopNav.tsx` | 480 | Desktop search `<input>` |
| 2 | `src/components/layout/TopNav.tsx` | 602 | Mobile search overlay `<input>` |
| 3 | `src/components/layout/Sidebar.tsx` | 216 | Nav item link (desktop) |
| 4 | `src/components/layout/Sidebar.tsx` | 238 | Nav item link (collapsed/icon-only variant) |
| 5 | `src/components/layout/Sidebar.tsx` | 311 | Nav item link (mobile) |
| 6 | `src/components/layout/Sidebar.tsx` | 327 | Sub-nav item link |
| 7 | `src/components/layout/Sidebar.tsx` | 382 | Collapse/expand toggle button |
| 8 | `src/components/layout/Sidebar.tsx` | 403 | User/profile footer row |
| 9 | `src/components/ui/OrgCalendar.tsx` | 190 | Calendar day cell |
| 10 | `src/app/page.tsx` | 18 | Root landing/redirect page element |

Also part of `ToastNotification.tsx`'s transition (already being touched by
plan 003 for its `motion-reduce:` variant) — that file's `transition-all
duration-300 transform` is left as-is by this plan since plan 003 already has
an open edit there; do not touch `ToastNotification.tsx` in this plan to avoid
a merge conflict between the two plans. If plan 003 hasn't been applied yet
when you execute this plan, still skip `ToastNotification.tsx` — it's
intentionally reserved for plan 003, not because it's out of scope, but to
keep the two diffs non-overlapping.

## The fix

For each location, inspect what's actually changing between states (usually via
a `hover:` variant) and replace `transition-all` with the specific Tailwind
transition-property utility that covers exactly that set: `transition-colors`
(background/text/border/fill/stroke color), `transition-transform`, `transition-opacity`,
`transition-shadow`, or a combination via arbitrary property syntax
`transition-[background-color,transform]` if genuinely more than one
non-adjacent category changes.

### Step-by-step per location

For each of the 9 locations in `TopNav.tsx`/`Sidebar.tsx`/`OrgCalendar.tsx`/`page.tsx`:

1. Open the file at the given line.
2. Read the full className string on that element and every `hover:`/`focus:`/
   state-conditional variant applied to it in the surrounding component logic
   (e.g. an active/selected state class computed via a ternary).
3. Categorize what changes: if only `hover:bg-*`/`hover:text-*`/`hover:border-*`
   classes exist alongside `transition-all`, the fix is
   `transition-colors duration-150` (this repo's existing convention — check a
   few of the app's already-correct `transition-colors` usages elsewhere, e.g.
   button hover states in `Modal.tsx`'s close button, to confirm the duration
   convention used elsewhere is 150ms for simple hover feedback; use that same
   duration for consistency rather than inventing a new one).
4. If the element also has a `hover:scale-*` or `hover:translate-*` class,
   include `transform` in the property list:
   `transition-[color,background-color,border-color,transform] duration-150`
   (Tailwind v4 arbitrary-property transition syntax) — or, more simply, use
   both `transition-colors` and `transition-transform` as separate utility
   classes side by side, which Tailwind allows and is more readable than one
   long arbitrary-property list. Prefer the two-separate-classes form unless
   more than 2 categories are involved.
5. Do not add `transition-shadow` unless a `hover:shadow-*` class is actually
   present on that specific element — don't add categories preemptively.
6. Replace only the `transition-all` token — leave `duration-*`, `ease-*`, and
   every other class untouched unless the file has no duration at all (in which
   case add `duration-150` to match the repo convention, since `transition-all`
   alone with no duration class actually falls back to Tailwind's default
   150ms, so behavior stays identical either way — this is a safe, no-visual-
   change refactor per location, confirm by checking whether a duration class
   already existed before assuming you need to add one).

### `src/app/page.tsx:18`

This is a root-level page element (confirm on read whether it's a loading
spinner, redirect placeholder, or similar) — apply the same procedure: read
what actually changes on this element and swap `transition-all` for the
specific property list.

## Scope boundaries

- Do not touch `ToastNotification.tsx` — reserved for plan 003.
- Do not change any duration values that already exist on these elements — only
  add a duration if none exists today (see step 6) and even then, match the
  existing 150ms hover-feedback convention rather than inventing a new number.
- Do not change hover/focus color or transform values themselves — only the
  `transition-*` property utility.
- Do not touch any element in these files that does not currently use
  `transition-all` — this plan is scoped to exactly the 10 listed instances.

## Verification

1. For each of the 10 locations, hover/interact with the element in the browser
   before and after the change — the visual transition must look identical
   (same speed, same properties animating). This is a performance refactor, not
   a visual change; any visible difference is a bug in the fix.
2. Open Chrome DevTools → Performance, record a hover interaction over the
   Sidebar nav items before and after the change, and confirm the "Recalculate
   Style"/"Composite Layers" time per interaction is equal or lower after the
   fix (should be a small but real reduction since fewer properties are being
   watched).
3. Grep the four touched files afterward for `transition-all` to confirm zero
   remaining instances outside `ToastNotification.tsx` (which is deliberately
   left for plan 003).
4. Feel-check: nothing here should feel different to a user — if any hover
   state suddenly feels different in timing or smoothness, that's a sign a
   duration or property was dropped incorrectly; re-check that specific
   location's className against its pre-change version.
