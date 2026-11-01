# 01 · UI Foundation Audit (global.css / tailwind.config.js / ui primitives)

**Snapshot.** All line numbers were verified against the working tree at **2026-09-25 00:57 CST**, git
`HEAD = 8ea75f1` with a dirty tree (`git status --porcelain` → 19 modified files, `doc/design/` untracked).

```
md5(src/global.css)                        3b2c16cb766363688ef4ee10d5064360
md5(tailwind.config.js)                    216adc3ecf30d1f056e0190e30efa741
md5(src/theme.ts)                          02bbc64b9a3d84f83dbfcd4396c17804
md5(src/main.tsx)                          e49c8e0b76485872fbfcd1f37b906cb2
md5(src/pc/App.tsx)                        ad5a33d4c42c7e2e103e6c38d07b9bd9
md5(index.html)                            84b00b07fc301c2b5fb59e827c03a78d
md5(src/Loading.tsx)                       20456e93078b0ff3ec7a5e810ec00617
md5(src/pc/lib/utils.ts)                   36ba9531fe873a7a6dab5932dc0bd922
md5(src/pc/components/ui/patch.css)        960ad0385ea044a3517a61019c615783
```

> ⚠️ **The tree changed while this audit ran.** `src/global.css` grew 193 → 267 lines and ~13 primitives were
> edited by a concurrent workstream (`doc/design/UI-LANGUAGE.md` is the spec it is applying). The 193-line
> intermediate state I first read even had `--primary: var(--n-30)` with `--n-30` undefined — a transient
> mid-edit gap, **not** a bug in the current tree or in HEAD. Everything below is re-verified against the
> snapshot above; §"Resolved during this audit" lists what already got fixed.

**Method / reproducibility.** Broken-class findings are not guesswork: the Tailwind build was generated from
this exact tree and the source tokens were diffed against the emitted selectors.

```
./node_modules/.bin/tailwindcss -c tailwind.config.js -i src/global.css -o /tmp/envis-audit/out2.css
# 89,407 bytes — "a class is missing" below means: no `.escaped-class` selector exists in this output.
```

---

## Summary

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| F1 | **P0** | Dark-mode tooltip text is white on an 86 %-gray surface (≈1.4:1) — unreadable | `src/pc/components/ui/tooltip.tsx:22` |
| F2 | P1 | `Input` removes the outline and re-sets the same border colour → **zero** focus indication | `src/pc/components/ui/input.tsx:13` |
| F3 | P1 | `text-warning-600` does not exist (`warning` has no numeric shades) → class silently dropped | `src/pc/pages/ai-panel/ai-panel.tsx:554` |
| F4 | P1 | `z-100` does not exist (z-scale not extended) → app-wide loading scrim gets no z-index | `src/Loading.tsx:2` |
| F5 | P1 | 15 `prose*` classes, but `@tailwindcss/typography` is not installed/registered → Markdown unstyled | `src/pc/pages/ai-panel/ai-panel.tsx:47` |
| F6 | P1 | Checkbox/Switch/Radio checked state uses `--primary`, while `global.css:95` mandates `--focus` | `checkbox.tsx:16`, `switch.tsx:14`, `radio-group.tsx:31` |
| F7 | P1 | `Calendar` is written for react-day-picker **v8** keys; installed version is **9.13.2** → 17/22 keys dead | `src/pc/components/ui/calendar.tsx:18-56` |
| F8 | P1 | Reveal-on-hover controls have no `focus-within` equivalent → Tab lands on invisible buttons | `nav-bar-item.tsx:127`, `service-data-item.tsx:540` |
| F9 | P2 | `custom-scrollbar` class is defined nowhere | `src/pc/pages/welcome-fragment.tsx:122` |
| F10 | P2 | Latent: `bg-muted` / `border-muted` / `text-muted` cannot exist (`muted` only has `foreground`) | `tailwind.config.js:49-51` |
| F11 | P2 | Latent: numbered shades of `default|primary|content1-4|success|warning|danger|focus` cannot exist | `tailwind.config.js:25-68` |
| F12 | P2 | Surface ladder emulated with `dark:` instead of one token (141 + 24 + 7 + 6 occurrences) | `AliasesConfigView.tsx:197` et al. |
| F13 | P2 | Hardcoded `white`/`black` overlays bypass the token layer (16 + 6 + 2 + 2) | `mobile/pages/home/index.tsx:252` |
| F14 | P2 | `--overlay` identical in both themes; scrim strength 40 % vs 80 % for the same role | `global.css:97,133`; `dialog.tsx:24` vs `alert-dialog.tsx:21` |
| F15 | P2 | Three border tokens for one visual role (`border` / `border-divider` / `border-dialogBorder`) | `dialog.tsx:41`, `sheet.tsx:34`, `card.tsx:9` |
| F16 | P2 | `backdrop-blur-pop` on an already opaque dialog surface (20 px blur, no visual effect) | `src/pc/components/ui/dialog.tsx:41` |
| F17 | P2 | Motion durations outside the declared 4-tier scale; `--dur-1/2/3` are dead tokens | `sheet.tsx:34`, `accordion.tsx:33`, `global.css:227-231` |
| F18 | P2 | Radius drift: 61 bare `rounded`, `rounded-xs` unused, `rounded-t-[6px]`, scrollbar `4px` hardcoded | `drawer.tsx:43`, `global.css:179` |
| F19 | P2 | `focus:` used where `focus-visible:` is meant (rings on mouse click) | `badge.tsx:7`, `select.tsx:22`, `dialog.tsx:47`, `sheet.tsx:64`, `toast.tsx:64,79` |
| F20 | P2 | `ring-offset-*` without `ring-offset-background` → Tailwind's white `#fff` offset halo in dark | `badge.tsx:7`, `resizable.tsx:44` |
| F21 | P2 | Missing disabled styling on interactive primitives | `accordion.tsx:27`, `input-otp.tsx:33`, `calendar.tsx:23`, `slider.tsx:14` |
| F22 | P2 | 24 primitives are unused stock shadcn/ui (defaults + English strings), 0 importers | `src/pc/components/ui/*` |
| F23 | P2 | 294 redundant `dark:` variants whose base class is already theme-aware | `mobile/App.tsx:55-57` et al. |
| F24 | P2 | `dark:text-primary-foreground` hardcodes "white text" instead of a semantic foreground (15×) | `welcome-fragment.tsx:85` et al. |
| F25 | P2 | Forced-dark subtree can be escaped by Radix portals; the `.light` class has no CSS rules | `theme.ts:11,32`; `android-terminal-panel/index.tsx:39` |
| F26 | P2 | No theme bootstrap → light flash for dark-theme users; scaffold `<title>`; `lang="en"` with CJK UI | `index.html:7,11`, `mobile.html:7,11`, `useTheme.ts:11-14` |
| F27 | P2 | `--pressed` == `--default` in light but differs in dark → press feedback only exists in dark | `global.css:80,82,116,118` |
| F28 | P2 | `* { border-color }` omits `::before, ::after` → pseudo-element borders fall back to preflight gray | `global.css:136-138` |
| F29 | P2 | `[class*="backdrop-blur"]` patch is redundant (Tailwind already emits the webkit prefix) and uses `--tw-*` without fallback | `global.css:239-246` |
| F30 | P2 | 138 arbitrary `text-[10px]`-style sizes in 27 source files bypass the new type scale and drop line-height | see §F30 + inventory |
| F31 | P2 | Leftovers: stray `qqkk` class, commented-out pink debug rule, `!important` patch | `scroll-area.tsx:15`, `patch.css:1-4` |
| F32 | P2 | No z-index scale: `z-50`/`z-30`/`z-40` plus `z-[100]`, `z-[1]`, and the broken `z-100` | `toast.tsx:19`, `Loading.tsx:2` |

Severity: **P0** = visibly broken / invisible / unreadable / silently dropped; **P1** = noticeable deviation
from the stated design language; **P2** = polish.

---

## 1 · Token integrity

**Headline: there is no undefined-token bug in the current tree.** I extracted every `var(--x)` reference from
`src/global.css`, `tailwind.config.js` and every `src/**/*.{ts,tsx}` and diffed it against every declaration
in `src/global.css`. Results:

| Referenced name | Status |
|---|---|
| all 17 `--n-*`, `--c-*`, `--shadow-pop-*`, `--radius-*`, `--font-*`, `--text-*`, `--lh-*`, `--dur-*`, `--ease-standard` | ✅ declared |
| all semantic tokens (`--background … --pressed`) | ✅ declared in both `:root` and `.dark` |
| `--tw-backdrop-blur … --tw-backdrop-sepia` | ⚠️ not authored; injected by Tailwind's backdrop utilities — see F29 |
| `--radix-accordion-content-height` | ⚠️ injected at runtime by Radix — not a bug |

`--primary` in `.dark` **does** resolve: `src/global.css:104` → `var(--n-30)`, declared at `src/global.css:24`.

### F1 (P0) · Dark-mode tooltip text is unreadable

`src/pc/components/ui/tooltip.tsx:22`
```tsx
'z-50 overflow-hidden rounded-sm bg-foreground px-3 py-1.5 text-xs text-primary-foreground shadow-pop ...'
```
`bg-foreground` = `hsl(var(--foreground))` and `text-primary-foreground` = `hsl(var(--primary-foreground))`.
They are the **same colour in light mode's inverse only**, and they collide in dark:

| theme | `--foreground` (bg) | `--primary-foreground` (text) | contrast |
|---|---|---|---|
| light (`global.css:65,68`) | `--c-label-l` = 15.3 % | `--n-100` = 100 % | ≈ 15:1 ✅ |
| dark (`global.css:101,105`) | `--c-label-d` = **86.1 %** | `--n-100` = **100 %** | **≈ 1.4:1 ❌** |

A 100 %-white label on an 86 %-gray plate is effectively invisible. `Tooltip` is imported by **13** files, so
this is user-facing, not theoretical. Fix: `text-background` (or `text-content1`) — never
`primary-foreground` for an inverted surface.

---

## 2 · Broken / non-existent Tailwind classes

Build-verified (no selector emitted in `out2.css`):

### F3 (P1) · `text-warning-600`
`src/pc/pages/ai-panel/ai-panel.tsx:554`
```tsx
<div className="flex items-center space-x-2 text-xs text-warning-600">
```
`tailwind.config.js:56-59` defines `warning` as an object with only `DEFAULT` and `foreground`, so no
`warning-600` shade can be generated (`grep -c "warning-[0-9]" out2.css` → **0**). The AI-status strip
(`bg-warning/10`, `global.css:90/126`) therefore renders its label in inherited `--foreground` instead of
amber — the warning colour is silently lost. 1 live occurrence; `text-warning` / `text-warning/90` are valid.

### F4 (P1) · `z-100`
`src/Loading.tsx:2`
```tsx
<div className="fixed inset-0 z-100 flex items-center justify-center bg-overlay/40 backdrop-blur-sm">
```
`tailwind.config.js` does not extend `zIndex`, so only `z-0/10/20/30/40/50/auto` exist
(`grep -c "\.z-100" out2.css` → **0**). The `fixed inset-0` loading scrim keeps `z-index: auto` and is painted
below everything positioned: nav bar (`z-10`), dialogs/menus/popovers (`z-50`), toasts (`z-[100]`), and every
Radix portal appended to `<body>`. The sibling toast viewport in the same repo writes `z-[100]`
(`src/pc/components/ui/toast.tsx:19`) — so the intent was 100, the value just never compiled.

### F5 (P1) · `prose*` has no plugin behind it
`src/pc/pages/ai-panel/ai-panel.tsx:47`
```tsx
<div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:my-2 prose-p:text-foreground prose-pre:my-2 prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:bg-content3 prose-pre:p-3 prose-code:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-blockquote:text-muted-foreground dark:prose-invert">
```
15 `prose`-prefixed tokens. `@tailwindcss/typography` is absent from `package.json` (0 matches) and
`tailwind.config.js:135` registers only `tailwindcss-animate`; `grep -c prose out2.css` → **0**. The
`ReactMarkdown` output in the AI panel is therefore styled by browser defaults only: no heading scale, no list
indent, and — worst — the code-block framing `prose-pre:bg-content3 prose-pre:rounded-lg prose-pre:p-3`
never applies, so fenced code blocks render as bare `<pre>` on the panel background.

### F9 (P2) · `custom-scrollbar`
`src/pc/pages/welcome-fragment.tsx:122` → `className="flex-1 overflow-y-auto custom-scrollbar ..."`.
The only stylesheets in the project are `src/global.css` and `src/pc/components/ui/patch.css`; neither
declares `.custom-scrollbar`. Dead class — the element gets the global `::-webkit-scrollbar` styling anyway.

### F10/F11 (P2) · Latent traps in the colour config
* `tailwind.config.js:49-51` — `muted: { foreground: … }`. `text-muted-foreground` works (**414** uses), but
  `bg-muted`, `border-muted`, `text-muted` **cannot** be generated. No current usage, so this is a trap for the
  next author, not a live break.
* `tailwind.config.js:25-68` — `default`, `primary`, `content1-4`, `success`, `warning`, `danger` are
  object-shaped (`DEFAULT` + `foreground`). `bg-default|text-default|border-default` are valid
  (**6 / 11 / 22** uses), but every numbered shade (`text-default-400`, `text-warning-600`, …) is
  unrepresentable. 11 `text-default-*` uses existed earlier today and were converted to
  `text-muted-foreground` mid-audit; `text-warning-600` (F3) was missed.
* Positive control: **0** raw palette utilities exist anywhere in `src/`
  (`bg-blue-500`, `text-gray-400`, …) — discipline here is good. Note the config uses `extend.colors`, so the
  **entire default Tailwind palette is still generated** and there is no lint guardrail; adding one is the
  cheap way to keep the 0.

---

## 3 · Primitive-level inconsistency

### F6 (P1) · Checked controls use `--primary` instead of `--focus`
`src/pc/components/ui/checkbox.tsx:16`, `switch.tsx:14`, `radio-group.tsx:31`
```tsx
// checkbox.tsx:16
'... border border-primary ... data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground'
// switch.tsx:14
'... data-[state=checked]:bg-primary data-[state=unchecked]:bg-content2'
// radio-group.tsx:31
<CheckIcon className="h-3.5 w-3.5 fill-primary" />
```
`src/global.css:95` states the intent explicitly:
```css
--focus: var(--c-blue);         /* 焦点环 / 链接 / 选中（checkbox 等勾选用 bg-focus） */
```
So the design language wants **`bg-focus`** (macOS blue) for the "on" state. Today light mode renders a
near-black (`--n-8`) check and dark mode a 30 %-gray (`--n-30`) track with a white thumb — a checked switch
looks *disabled*, not *on*, and it is visually indistinguishable from the `--primary` button fill.

### F7 (P1) · `Calendar` targets react-day-picker v8, v9.13.2 is installed
`src/pc/components/ui/calendar.tsx:18-56` uses the v8 `classNames` contract. Valid v9 keys are enumerated in
`node_modules/react-day-picker/dist/cjs/UI.d.ts` / `SelectionState` / `DayFlag`:
`root, chevron, day, day_button, caption_label, dropdowns, dropdown, dropdown_root, footer, month_grid,
month_caption, months_dropdown, month, months, nav, button_next, button_previous, week, weeks, weekday,
weekdays, week_number, week_number_header, years_dropdown` + flags `disabled/hidden/outside/focused/today` +
selection `selected/range_start/range_middle/range_end`.

| calendar.tsx key | line | v9 status |
|---|---|---|
| `caption`, `nav_button`, `nav_button_previous`, `nav_button_next` | 20, 23, 27, 28 | ❌ removed (`month_caption`, `button_previous/next`) |
| `table`, `head_row`, `head_cell`, `row`, `cell` | 29-33 | ❌ renamed (`month_grid`, `weekdays`, `weekday`, `week`, `day`) |
| `day_range_start/end/middle`, `day_selected`, `day_today`, `day_outside`, `day_disabled`, `day_hidden` | 43-52 | ❌ renamed (`range_*`, `selected`, `today`, `outside`, `disabled`, `hidden`) |
| `components.IconLeft` / `IconRight` | 56-57 | ❌ v9 uses a single `Chevron` component |

17 of 22 entries are silently ignored, so the only styling left is the stock v9 CSS (no `bg-primary`
selected day, no caption layout, default chevrons). The mistake is **masked from the compiler** by
`src/pc/types/shims.d.ts:3-6`:
```ts
declare module 'react-day-picker' { export const DayPicker: any; export default DayPicker }
```
`Calendar` currently has 0 importers, which is why nobody noticed — but it ships as a working-looking
primitive.

### F12 (P2) · The content ladder is emulated with `dark:` in call sites
`src/pc/pages/env-panel/service-data-panel/custom-service/AliasesConfigView.tsx:197`
```tsx
className="h-7 px-2 text-xs bg-content1 dark:bg-content1/40 border-divider"
```
| pattern | count | problem |
|---|---|---|
| `bg-content1 dark:bg-content1/40` | **141** | in dark this is 40 % α of `--content1`, not the opaque surface the token means |
| `bg-content2 dark:bg-content3` | 24 | both are already the "control fill" level per `global.css:70`; the dark override changes 20 % → 18 % |
| `bg-content3 dark:bg-content4` | 7 | ladder applied twice |
| `bg-background dark:bg-content3` | 6 | input/select/button fill should be one token (`--content2`) |

`global.css:70` claims `content1..content4` already encode the ladder; 178 call-site overrides say it does
not. Every one of these is a place where a token change will not propagate.

### F13 (P2) · Hardcoded light/dark overlays bypass the token layer
* `dark:hover:bg-white/5` × **16**, `dark:hover:bg-white/10` × **6**, `dark:group-hover:border-white/10` × 2,
  `dark:hover:border-white/5` × 1 — e.g. `src/pc/pages/env-panel/service-data-list/service-data-item.tsx:431`,
  `mariadb-service/index.tsx:1040,1070`.
* `src/mobile/pages/home/index.tsx:252` and `:293` → `bg-black/45` for a modal scrim instead of
  `bg-overlay/45`.

These are exactly the "`dark:` exists only because a literal colour was used" pattern: there is no
`--hover-surface` / `--scrim` token, so hover and scrim states are re-invented per call site.

### F14 (P2) · `--overlay` / backdrop handling
`src/global.css:97` and `:133` declare `--overlay: 0 0% 0%` **identically in both themes**, and scrim strength
is inconsistent for the same modal role:

| component | line | scrim |
|---|---|---|
| `Dialog` | `dialog.tsx:24` | `bg-overlay/40 backdrop-blur-sm` |
| `AlertDialog` | `alert-dialog.tsx:21` | `bg-overlay/80` |
| `Sheet` | `sheet.tsx:24` | `bg-overlay/80` |
| `Drawer` | `drawer.tsx:28` | `bg-overlay/80` |
| `Loading` | `Loading.tsx:2` | `bg-overlay/40 backdrop-blur-sm` |
| decorative glow | `welcome-fragment.tsx:89` | `bg-overlay/[0.02] … dark:bg-content1/25` |

Two different modal scrims (0.4 vs 0.8) mean the same interaction reads as two different depths. Either give
`--overlay` a dark value and pick one scrim token, or expose `--scrim-strong` / `--scrim-soft`.

### F15 (P2) · Three border tokens for one role
`dialog.tsx:41` + `alert-dialog.tsx:39` use `border border-dialogBorder`; `sheet.tsx:34`, `drawer.tsx:43`,
`popover.tsx:24`, `dropdown-menu.tsx:66`, `context-menu.tsx:65`, `menubar.tsx:96`, `tooltip.tsx:22` (no border
at all), `card.tsx:9` use bare `border` (= `--border`). `--divider`, `--border` and `--dialog-border` are
three near-identical grays (`--n-95 / --n-94 / --n-95` light, `--n-16 / --n-15 / --n-13` dark) chosen ad hoc.

### F16 (P2) · Pointless blur on dialog content
`src/pc/components/ui/dialog.tsx:41` ends with `rounded-sm backdrop-blur-pop` (`backdropBlur.pop = 20px`,
`tailwind.config.js:83-85`) while the same element is `bg-background` (98 % opacity light / 9 % **opaque**
dark). A 20 px backdrop filter under a fully opaque background cannot be seen; it only forces a compositing
layer on every dialog.

### F17 (P2) · Motion scale is declared but not enforced
`src/global.css:226-231` defines `--dur-1..4` (100/150/250/400 ms) and `--ease-standard`;
`tailwind.config.js:112-118` maps only `duration-250` (literal `'250ms'`, not `var(--dur-3)`) and
`duration-400` (var). Off-scale durations remain in primitives:

| location | class |
|---|---|
| `alert-dialog.tsx:39`, `dialog.tsx:41` | `duration-200` |
| `accordion.tsx:33`, `resizable.tsx:30` | `duration-200` |
| `pie-chart.tsx:52`, `navigation-menu.tsx:52` | `duration-300` |
| `sheet.tsx:34` | `data-[state=closed]:duration-300 data-[state=open]:duration-500` |
| `input-otp.tsx:42` | `duration-1000` |

`grep -rn "dur-1\|dur-2\|dur-3" src/ tailwind.config.js` → only the three declarations; `--dur-1/2/3` are
referenced by nothing, and `duration-400` has **0** usages. So the four-tier scale is documentation today.

### F18 (P2) · Radius drift
* `tailwind.config.js:70-78` + `global.css:192-199` now define `xs 4 / sm 6 / md 8 / lg 10 / xl 12 / 2xl 16`.
* `grep -rn "rounded-xs" src/` → **0** usages (the `xs` tier was added to replace bare `rounded`).
* **61** bare `rounded` occurrences survive, and bare `rounded` is *not* a token: `extend.borderRadius` keeps
  Tailwind's default `DEFAULT: 0.25rem` (4 px) — it happens to match `--radius-xs`, by accident.
* `drawer.tsx:43` → `rounded-t-[6px]` duplicates `rounded-t-sm` with an arbitrary value.
* `global.css:179` → `border-radius: 4px` hardcoded on `::-webkit-scrollbar-thumb`.

### F19 (P2) · `focus:` where `focus-visible:` is intended
Ring appears on mouse click, not only keyboard: `badge.tsx:7`, `select.tsx:22`, `dialog.tsx:47`,
`sheet.tsx:64`, `toast.tsx:64,79`. Contrast the correct form in `button.tsx:8`, `checkbox.tsx:16`,
`switch.tsx:14`, `tabs.tsx:32`, `input-otp.tsx:34`.

### F20 (P2) · Ring offset without an offset colour
`badge.tsx:7` → `focus:ring-2 focus:ring-ring focus:ring-offset-2` and `resizable.tsx:44` →
`focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1`, neither with
`ring-offset-background`. Tailwind's default offset colour is `#fff`, so in dark mode these two produce a
white halo; `button.tsx:8`, `switch.tsx:14`, `tabs.tsx:32`, `dialog.tsx:47`, `select.tsx:22` all pair them
correctly.

### F22 (P2) · 24 unused stock shadcn primitives
Importers counted across `src/` (excluding `components/ui/` itself) — **0 importers**:

```
aspect-ratio  avatar  breadcrumb  calendar  carousel  command  context-menu  drawer  form
hover-card  input-otp  menubar  navigation-menu  pagination  popover  radio-group  sheet
skeleton  slider  toggle  toggle-group  toast  toaster  use-toast
```
Live ones for comparison: `button 36, label 24, input 25, dialog 14, tooltip 13, alert 12, dropdown-menu 5,
switch 5, accordion 1, table 1`. The dead set is essentially unmodified shadcn/ui (e.g. `card.tsx:18 p-6`,
`table.tsx:63 h-10`, `calendar.tsx` above) and includes hardcoded English strings that no i18n layer reaches:
`pagination.tsx:60,72,85` ("Previous", "Next", "More pages"), `carousel.tsx:200,228`
("Previous slide", "Next slide"), `breadcrumb.tsx:88` ("More"). They will contradict the retuned language the
moment one is imported. `toast.tsx` → `toaster.tsx` → `use-toast.ts` is a fully dead legacy toast stack; the
live one is `sonner.tsx` (1 importer).

### F31 (P2) · Leftovers
* `src/pc/components/ui/scroll-area.tsx:15` → `cn('relative qqkk overflow-hidden', className)` — `qqkk` is a
  stray token with no meaning (grep: 1 hit in the whole repo).
* `src/pc/components/ui/patch.css:4` → `/* background-color: pink !important; */` — commented-out debug rule.
* `src/pc/components/ui/patch.css:1-3` → structural fix with two `!important`s keyed on a private class
  `ScrollAreaViewportPatch` (used once, `scroll-area.tsx:18`).

---

## 4 · Focus / disabled / hover / active coverage

### F2 (P1) · `Input` has no focus indicator at all
`src/pc/components/ui/input.tsx:13`
```tsx
'... border border-divider bg-background dark:bg-content3 px-3 py-1 text-sm ... focus-visible:outline-none focus:border-divider disabled:cursor-not-allowed disabled:opacity-50'
```
`focus-visible:outline-none` deletes the UA outline and `focus:border-divider` re-applies the colour the border
**already has**. Net effect on focus: nothing changes. `Input` is imported by **25** files — this is the single
most-used form control in the app and the keyboard user gets no feedback. Compare `textarea.tsx:12`, which does
it correctly with `focus-visible:ring-1 focus-visible:ring-ring`, and `select.tsx:22` with
`focus:ring-2 focus:ring-focus`.

Same class of defect (outline removed, no compensating ring):
* `command.tsx:49` → `outline-none` only, no ring on the command-palette input.
* `accordion.tsx:27` → no focus styling whatsoever (`hover:underline` only).
* `navigation-menu.tsx:38` → `focus:bg-content2` (bg change only, no `--ring`).
* `badge.tsx:7` → `focus:ring-*` on a `div` (`badge.tsx:30`), so it can never receive focus.

### F8 (P1) · Reveal-on-hover without a keyboard equivalent
`src/pc/pages/nav-bar/nav-bar-item.tsx:127` and `src/pc/pages/env-panel/service-data-list/service-data-item.tsx:540`
```tsx
"opacity-0 group-hover:opacity-100",     // container of real <Button>s
```
Tab reaches those buttons (they are focusable) while their container stays at `opacity: 0`, so focus lands on
an invisible control. `toast.tsx:79` shows the correct pattern in the same codebase:
`opacity-0 … focus:opacity-100 group-hover:opacity-100`. Add `focus-within:opacity-100` here.

### F21 (P2) · Missing disabled styling
Radix/react-resizable-panels elements that accept a disabled state but have no styling for it:
`accordion.tsx:27` (no `data-disabled:`), `input-otp.tsx:33`, `calendar.tsx:23-25` (v8 key anyway), `slider.tsx:14`
(Root has no `disabled:`, only the Thumb at `:20`), `dialog.tsx:47` / `sheet.tsx:64` (`disabled:pointer-events-none`
only — no opacity/colour change). Covered correctly: `button.tsx:8`, `input.tsx:13`, `textarea.tsx:12`,
`checkbox.tsx:16`, `radio-group.tsx:25`, `switch.tsx:14`, `select.tsx:22`, `tabs.tsx:32`, `toggle.tsx:10`,
`command.tsx:49`, `label.tsx:10`.

### Active / hover consistency (P2)
`button.tsx:12-18` applies `active:scale-95` to **all six** variants including `link` — a springy scale on a
text link is not AppKit behaviour, and the only press-feedback token (`--pressed`, `global.css:82,118`) is
used just twice (`nav-bar.tsx:714,727`). Menus do use Radix roving focus properly
(`focus:bg-content2` in `dropdown-menu.tsx:85`, `context-menu.tsx:83`, `menubar.tsx:114`) — that part is fine
because focus *is* the pointer inside a menu.

---

## 5 · Theme-switching risks

### F23 (P2) · 294 `dark:` variants that duplicate an already theme-aware base class
Total `dark:` tokens in `src/`: **598** (`grep -ro "dark:" src/ | wc -l`); **294** of the class-string tokens have
their un-prefixed twin in the same class string and the twin is already driven by an existing token
(294 + 303 non-redundant = 597 tokens found inside class strings; the 1-token delta is the `darkMode` string). Top offenders:

| redundant variant | count | example |
|---|---|---|
| `dark:text-muted-foreground` | 42 | `src/mobile/App.tsx:57` → `text-muted-foreground … dark:text-muted-foreground` |
| `dark:text-warning` | 41 | `DnsmasqConfigView.tsx:166` → `text-warning … dark:text-warning` |
| `dark:text-foreground` | 30 | `src/mobile/App.tsx:55` |
| `dark:text-focus` | 28 | `mariadb-service/index.tsx:1311` |
| `dark:border-divider` | 23 | `src/mobile/App.tsx:56` |
| `dark:bg-warning/10` | 17 | `DnsmasqConfigView.tsx:165` |
| `dark:text-success` / `dark:text-danger` | 10 / 6 | `service-data-item.tsx:485` |

`.dark` already flips the variables, so these overrides are no-ops that make the codebase *look* like it
themes via `dark:` rather than via tokens. `mobile/App.tsx:55` is the clearest artefact:
`bg-background text-foreground dark:bg-background dark:text-foreground`.

### F24 (P2) · `dark:text-primary-foreground` hardcodes "white in dark" (15×)
`src/pc/pages/welcome-fragment.tsx:85`
```tsx
className="... bg-content1 dark:bg-background text-foreground dark:text-primary-foreground ..."
```
`--primary-foreground` is `--n-100` in both themes, i.e. this is a literal white. It bypasses
`--foreground`/`--content*-foreground`; used in `welcome-fragment.tsx` (6), `env-panel-header.tsx:25`,
`nav-bar.tsx`, etc.

### F25 (P2) · Forced-dark subtree and the `.light` class
* Forced-dark works: `src/mobile/pages/android-terminal-panel/index.tsx:39` puts `dark` on a plain `div`, and
  Tailwind emits `.dark\:x:is(.dark *)` (verified in `out2.css:3823+`), so subtree theming is real.
* **Portal escape (latent):** every Radix overlay (`dialog`, `alert-dialog`, `select`, `dropdown-menu`,
  `context-menu`, `menubar`, `popover`, `hover-card`, `tooltip`, `sheet`, `drawer`, `command`) renders through
  `*Primitive.Portal` → `document.body`, i.e. *outside* the forced-dark subtree. Anything portaled from
  inside `android-terminal-panel` would paint with light tokens. Today `src/mobile/**` imports none of them
  (verified), so this is a trap, not a live bug.
* `src/theme.ts:11,22,26,32` adds a `light` class on `documentElement`, but **no `.light` rule exists** in
  `global.css` or `tailwind.config.js` (`grep "\.light\b"` → 0). Consequences: (a) the class is dead weight;
  (b) there is no way to force a *light* subtree inside a dark root — `global.css:158-160` gives `.dark`
  `color-scheme: dark`, but nothing gives a light subtree `color-scheme: light` back for scrollbars/controls.

### F26 (P2) · No theme bootstrap, scaffold metadata
* `index.html:11-12` and `mobile.html:11-12` ship an empty `#root` with no inline bootstrap; the theme is
  applied in `src/pc/hooks/useTheme.ts:11-14` inside a `useEffect` **after** settings load → a light flash for
  dark-theme users.
* `index.html:7` and `mobile.html:7` are still `<title>Tauri + React + Typescript</title>`.
* `index.html:2` / `mobile.html:2` are `lang="en"` while the UI is bilingual (zh/en via i18next).

### F27 (P2) · `--pressed` is a no-op in light mode
| token | light | dark |
|---|---|---|
| `--default` | `--n-90` (`global.css:80`) | `--n-22` (`:116`) |
| `--pressed` | `--n-90` (`:82`, identical) | `--n-27` (`:118`) |

`active:bg-pressed` (`nav-bar.tsx:714,727`) therefore shows a visible press state in dark mode and **none**
in light mode. `--overlay` is likewise declared twice with the same value (`:97`, `:133`).

---

## 6 · Global CSS hygiene

**Already correct in the current tree** (these were on the brief's worry-list and are now present — no action):
`color-scheme` per theme (`global.css:155-160`), `::selection` (`:162-165`), reduced-motion
(`:258-267`), per-OS font stack **with CJK fallbacks** (`:205-208`), 13 px base body size
(`:143-144`), monospace token (`:207-208`), tabular-nums helper (`.nums`, `:249-251`), full type scale with
paired line-heights (`:215-224`).

**Remaining:**

### F28 (P2) · `* { border-color }` omits `::before, ::after`
`src/global.css:136-138`
```css
* {
  border-color: hsl(var(--border));
}
```
Tailwind preflight sets `*, ::before, ::after { border-color: theme('borderColor.DEFAULT') }` (gray-200).
This narrower rule re-declares only the bare `*`, so pseudo-element borders keep the preflight light gray and
**do not follow the theme**. Real usages exist: `resizable.tsx:44` (`after:w-1 after:inset-y-0`, no explicit
colour), `input.tsx:13` (`file:*`), `placeholder:*`. Add `*, ::before, ::after` (or drop the rule and let
preflight use `--border`).

### F29 (P2) · The `backdrop-blur` webkit patch is redundant and fragile
`src/global.css:239-246`
```css
[class*="backdrop-blur"] {
  -webkit-backdrop-filter: var(--tw-backdrop-blur) var(--tw-backdrop-brightness) ...;
}
```
Verified against this build: Tailwind (plus autoprefixer) already emits `-webkit-backdrop-filter` for every
backdrop utility — `grep -c "\-webkit-backdrop-filter" out2.css` → **7**, e.g. `.backdrop-blur-sm` at
`out2.css` contains both `-webkit-backdrop-filter` and `backdrop-filter`. The patch is therefore dead weight,
and because it sits later in source order at equal specificity it *overrides* Tailwind's own declaration with
an identical value. It also references `--tw-backdrop-*` without a fallback, so any non-Tailwind element that
merely has `backdrop-blur` in its class string would get an invalid declaration.

### F30 (P2) · 139 arbitrary font sizes bypass the brand-new scale
`global.css:215-224` and `tailwind.config.js:99-110` now define `--text-3xs … --text-3xl` **with** line-heights,
and `tailwind.config.js:96-97` explicitly forbids arbitrary sizes ("禁止在业务代码里写 text-[10px]"). The tree
still contains (counts from `grep -rnoE "text-\[[0-9.]+(px|rem)\]" src/`; the `text-[10px]` figure includes the
one occurrence inside the `global.css:212` comment that states the rule):

| arbitrary size | count |
|---|---|
| `text-[10px]` | 98 |
| `text-[11px]` | 33 |
| `text-[9px]` | 3 |
| `text-[0.8rem]` | 3 (`form.tsx:127`, `form.tsx:149`, `calendar.tsx:31`) |
| `text-[15px]` | 1 (`ai-panel.tsx:535`) |
| `text-[12px]` | 1 (`HostManagementView.tsx:440`) |

`text-[Npx]` sets only `font-size`, so line-height is inherited from the parent — exactly the vertical-rhythm
bug the token comment warns about. Adoption of the new tiers is near zero: `text-3xs` × 4, `text-2xs` × 1,
`text-md` × 1, versus `text-xs` × 516. (Mechanical migration: `text-[10px]` → `text-3xs`,
`text-[11px]` → `text-2xs`, `text-[12px]` → `text-xs`, `text-[0.8rem]` → `text-xs`/`text-2xs`.)

### F32 (P2) · No z-index scale
Used values across `src/`: `z-50` × 23, `z-10` × 7, `z-30` × 2, `z-40`, `z-20`, `z-0`, `z-[100]`
(`toast.tsx:19`), `z-[1]` (`navigation-menu.tsx:100`), and the broken `z-100` (`Loading.tsx:2`). Since
`zIndex` is not extended, the numeric ones come from Tailwind's default scale and the two arbitrary ones are
hand-rolled; the "loading above everything" case used the one spelling that does not compile (F4).

---

## Inventory (raw counts, verified commands)

| Fact | Count |
|---|---|
| Undefined `var(--x)` colour/semantic references in `src/**` + config | **0** (only runtime-injected `--tw-*`, `--radix-*`) |
| Broken classes (not emitted by this config) | `text-warning-600` ×1, `z-100` ×1, `prose*` ×15 tokens, `custom-scrollbar` ×1 |
| `text-default-300/400/500/600` (fixed mid-audit) | 0 remaining (was 11) |
| `text-muted-foreground` | 414 |
| `bg-default` / `text-default` / `border-default` (valid) | 6 / 11 / 22 |
| Raw Tailwind palette utilities (`bg-blue-500`, `text-gray-400`, …) | **0** |
| Hardcoded `bg-white` / `text-white` / `bg-black` | 33 / 2 / 2 (33 `bg-white` all paired with a `dark:` twin) |
| `dark:` tokens total / redundant | 598 / 294 |
| `dark:bg-content1/40` | 141 |
| `dark:hover:bg-white/5` + `/10` | 16 + 6 |
| `--dur-1/2/3` references outside their declaration | 0 |
| Off-scale `duration-200/300/500/1000` | 10 / 5 / 1 / 1 |
| `duration-400` (mapped tier) usages | 0 |
| bare `rounded` (Tailwind default 4 px, not a token) | 61 |
| `rounded-xs` usages | 0 |
| `text-[Npx]` / `text-[0.8rem]` usages | 135 / 3 (`grep -rnoE "text-\[[0-9.]+(px\|rem)\]" src/` = 139, minus 1 inside a `global.css:212` comment) |
| `text-3xs` / `text-2xs` / `text-md` usages | 4 / 1 / 1 |
| `text-xs` usages | 516 |
| Primitives with 0 importers | 24 of 48 (47 `.tsx` + `use-toast.ts`) |
| `shadow-pop` usages | 22 (+ `--shadow-pop-l/d` declarations) |
| Non-`shadow-pop` shadows (`shadow-sm/md/lg/xl/2xl/inner`) | **0** ✅ |
| `--n-*` ramp declared | 17 steps (`n-8 … n-100`) |

### Resolved during this audit (present at HEAD or in the earlier worktree, gone now)
* `--n-30` missing while `--primary: var(--n-30)` was referenced (transient mid-edit state) → now
  `src/global.css:24` + `:104`.
* 11 live `text-default-300/400/500/600` occurrences (in `ai-panel.tsx`, `pages/index.tsx`) →
  converted to `text-muted-foreground`.
* `color-scheme`, `::selection`, `prefers-reduced-motion`, CJK font stack, 13 px base body size → all added.
* Menus/popovers/dialogs were emitting `rounded-md` / `sm:rounded-lg` / `rounded-t-[10px]` → now
  `rounded-sm` / `rounded-t-[6px]`.
* `--radius-xs` (4 px) added to the scale, `dialogBorder` / `pressed` exposed as utilities.

### Suggested fix order
1. **F1** (`text-background` on tooltip) — one line, currently unreadable in dark.
2. **F4 / F3 / F5** — `z-[100]` (or add a `zIndex` scale), `text-warning`, install
   `@tailwindcss/typography` (or drop the 15 `prose*` classes).
3. **F2 / F8 / F20** — focus visibility on `Input`, `focus-within` on hover-reveal groups, `ring-offset-background`.
4. **F6 / F7** — checked-state `bg-focus`; rewrite `Calendar` for v9 (and delete the `react-day-picker` shim so
   the compiler catches it next time).
5. **F12 / F13 / F23 / F24** — collapse the 141 `dark:bg-content1/40` and the 294 redundant `dark:` twins into tokens.
6. F17 / F18 / F30 — finish migrating durations, bare `rounded`, and arbitrary font sizes onto the new scales.
