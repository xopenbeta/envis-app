# UI audit 02 — Application shell (3-pane layout, nav bar, headers, footer, log panel)

Scope (11 files, read in full):

| file | lines |
| --- | --- |
| `src/pc/pages/index.tsx` | 167 |
| `src/pc/pages/nav-bar/nav-bar.tsx` | 966 |
| `src/pc/pages/nav-bar/nav-bar-item.tsx` | 186 |
| `src/pc/pages/nav-bar/settings-dialog.tsx` | 1063 |
| `src/pc/pages/nav-bar/nav-bar.md` | 8 (no UI) |
| `src/pc/pages/welcome-fragment.tsx` | 513 |
| `src/pc/pages/app-footer.tsx` | 42 |
| `src/pc/pages/update-dialog.tsx` | 147 |
| `src/pc/pages/system-monitor.tsx` | 301 |
| `src/pc/pages/log-panel/log-panel.tsx` | 351 |
| `src/pc/pages/env-panel/env-panel.tsx`, `env-panel-header.tsx` | 102, 53 |

Audited against the design language in `src/global.css` (tokens) and `tailwind.config.js` (mapping), plus the primitives
these files consume (`src/pc/components/ui/{button,dialog,alert-dialog,resizable,scroll-area,tabs,card,tooltip,input,switch,dropdown-menu,select}.tsx`).
Read-only audit; the only file written is this report.

Method note: `dist/` contains a build produced by a **different toolchain than this checkout** — it emits v4-style
`:is(.dark *)` selectors while `package.json` pins `tailwindcss: ^3.4.1` (installed 3.4.19). `dist/` is therefore *not*
used as evidence below; every claim comes from source, config and token math. Light/dark token values used:
`content1` 100%/12%, `content2` 96.5%/20%, `content3` 95%/18%, `content4` 93.3%/22%, `default` 90.2%/22%,
`divider` 95.5%/15.8%, `border` 94%/15.4%, `muted-foreground` 50.2%/59%, plus
`success`/`warning`/`danger`/`focus` from `global.css:43-47`.

### Snapshot and concurrent changes (read before acting)

The working tree was **being edited by another writer while this audit ran**. Findings are stated against the tree as of
`00:56`; the following files changed afterwards and the affected findings were re-verified at `01:02`:

| file | last write | effect |
| --- | --- | --- |
| `src/global.css` | 00:56:02 | additive: added `--radius-xs: 4px`, `--font-sans/mono`, the full type scale (`--text-3xs: 10px/14px … --text-3xl: 30px/36px`, now at `global.css:212-224`), duration `--dur-1…--dur-4` + easing. No token value used in this report changed. |
| `tailwind.config.js` | 00:56:09 | additive: `borderRadius.xs`, `fontFamily`, `fontSize` now maps every step to `var(--text-*)`/`var(--lh-*)`, `duration-400`. Line numbers in §2 moved to the new `fontSize` block (`tailwind.config.js:99-110`). |
| `src/pc/pages/system-monitor.tsx` | 00:56:57 | **F13 fixed** — `text-default dark:text-muted-foreground` → `text-muted-foreground`. |
| `src/pc/pages/nav-bar/nav-bar-item.tsx` | 01:01:17 | **F16 fixed** — `group-focus-within:opacity-100` added to the action wrapper. |
| `src/pc/components/ui/button.tsx` | 01:01:17 | focus offset colour added (`focus-visible:ring-offset-background`, now `button.tsx:8`). |

F13 and F16 are therefore **already resolved in the tree** and are kept below only as pattern evidence (the same defects
still exist elsewhere, e.g. F26/F40). The new type tokens also *strengthen* F9: `global.css:211-213` now states
"直接写 text-[10px] 只设 font-size，行高会继承父级 → 纵向节奏错乱，故立此 token。中文不得低于 12px，10/11px 只允许纯数字/英文微标签。"


---

## Summary

| # | Sev | Issue | Location |
| --- | --- | --- | --- |
| 1 | **P0** | Tooltip text unreadable in dark mode (light-grey bg + white text, 1.38:1) | `tooltip.tsx:22` + `global.css:102,105`; consumed at `env-panel-header.tsx:22-35` |
| 2 | **P0** | Environment rows are `div onClick` — primary navigation is not keyboard-operable | `nav-bar-item.tsx:89-97` |
| 3 | P1 | Main 3-pane splitter is invisible: `bg-content2` on a `bg-content2` root | `index.tsx:91,92` |
| 4 | P1 | Center pane hardcodes `bg-white`; AI pane `bg-white dark:bg-content3` — identical light surface, inverted dark elevation | `index.tsx:127,157` |
| 5 | P1 | Adjacent panes use different border tokens (`divider` vs `border`) | `index.tsx:127,157` |
| 6 | P1 | Log panel className has contradictory duplicates; floating layer with no `shadow-pop` and a fill equal to the app background | `log-panel.tsx:187` |
| 7 | P1 | Pane radius is the *control* radius (10px) not the design's panel radius (16px); floating layers use three radii (6/10/16) | `index.tsx:127,157`; `settings-dialog.tsx:473,124,599` |
| 8 | P1 | Elevation direction flips between themes inside cards (`bg-content3 dark:bg-content2`) | `welcome-fragment.tsx:259,388` |
| 9 | P1 | Arbitrary `text-[9px]/[10px]` bypass the new type tokens (and set size without line height); 9px has no token; ~15 of 19 `text-[10px]` sites wrap CJK/localized text, violating the repo's own "中文不得低于 12px" rule | `system-monitor.tsx:197,225,253`; `app-footer.tsx:17`; `welcome-fragment.tsx:264,280,294,308,392,436,454,499,506` |
| 10 | P1 | 11/12/13px ladder with role collisions — 12px is section label, meta *and* badge | `welcome-fragment.tsx:204,392`; `system-monitor.tsx:184,201`; `log-panel.tsx:32,43,278` |
| 11 | P1 | "Heading" rendered 3 ways across panes (12px uppercase muted / 13px medium / 16px semibold) | `welcome-fragment.tsx:204`; `settings-dialog.tsx:641`; `env-panel-header.tsx:25` |
| 12 | P1 | `text-muted-foreground` = 3.95:1 on content1 (3.66:1 on content2) light; success/danger text 3.35/3.78:1 — all sub-AA | `global.css:39,83`; used 55× in scope |
| 13 | P1 | `text-default` (a hover-border/handle token) used as an icon colour → ~1.25:1 in light — **fixed in tree at 00:56** | `system-monitor.tsx:282,289` |
| 14 | P1 | Detail-pane header `return null` when nothing is selected → layout jump, AI button disappears | `env-panel-header.tsx:14-16` |
| 15 | P1 | Detail-pane title has no `min-w-0`/`truncate`; the version is glued on with `&nbsp;` | `env-panel-header.tsx:19-30` |
| 16 | P1 | Row action buttons hidden by `opacity-0 group-hover:opacity-100`; focused children stayed invisible — **fixed in tree at 01:01** (`group-focus-within:opacity-100`) | `nav-bar-item.tsx:127` |
| 17 | P1 | Environment delete: no confirmation, from a dropdown item (service delete / quit use `AlertDialog`) | `nav-bar-item.tsx:168-174` vs `settings-dialog.tsx:110-160,590-630` |
| 18 | P1 | "Clear all" logs and `location.reload()` from ghost icon buttons — no confirmation | `log-panel.tsx:146,222,233` |
| 19 | P1 | Status collapses `unknown/active/inactive` to hardcoded English `Active`/`Inactive` although zh keys exist | `nav-bar-item.tsx:116-118`; `zh.json nav_bar_item.active/inactive` |
| 20 | P1 | The log/diagnosis panel is **always empty in release builds** | `hooks/log.ts:9`; `hooks/useRustLogger.ts:23`; exposed by `nav-bar.tsx:502-507` |
| 21 | P1 | Hardcoded Chinese shown to English users (toast fallback; backend `sizeFormatted`) | `nav-bar.tsx:168`; `settings-dialog.tsx:92`; `service_manager.rs:127,170` |
| 22 | P1 | Failure styling keyed on the literal `'计算失败'`, which the backend never emits — dead branch | `settings-dialog.tsx:86-92` |
| 23 | P1 | Log timestamp `min-w-[64px]` vs `ml-[74px]` indent — locks to the en-US 12-hour clock | `log-panel.tsx:43,57` |
| 24 | P1 | Nav search row has no `min-w-0`; below ~210px panel width the `+` button is clipped by the panel's `overflow:hidden` | `nav-bar.tsx:614-641`; `index.tsx:101` |
| 25 | P2 | Dialog surfaces differ for the same layer class (`bg-background` default vs `bg-content1` override) | `dialog.tsx:31` vs `settings-dialog.tsx:473,124,599` |
| 26 | P2 | Inset icon tiles have no fill delta from their parent card in either theme | `welcome-fragment.tsx:374` |
| 27 | P2 | Welcome root surface is a no-op over an identical parent surface | `welcome-fragment.tsx:85` + `index.tsx:127` |
| 28 | P2 | 15× `dark:text-primary-foreground` renders pure white instead of the dark label colour (86.1%) | `welcome-fragment.tsx` (13); `env-panel-header.tsx:25` |
| 29 | P2 | `text-default-400` is not in the palette (only `DEFAULT`/`foreground` exist) → no CSS emitted | `index.tsx:158`; `tailwind.config.js:45-48` |
| 30 | P2 | Dead classes: `group-hover:` with no `group`, `hover:backdrop-blur-sm` with no fill, `hover:bg-danger` == base, `text-primary-foreground` on `bg-danger` | `nav-bar.tsx:594`; `nav-bar-item.tsx:128`; `app-footer.tsx:34` |
| 31 | P2 | 6× empty `className=""`; the focus/transition chain duplicated inside one className | `nav-bar.tsx:791,800,898,952`; `settings-dialog.tsx:1047,1054` |
| 32 | P2 | Icon-button hit targets 16/24/28/32px, none 36px; 27 `title=` vs 2 `aria-label` | `app-footer.tsx:22`; `nav-bar.tsx:604,714,727` |
| 33 | P2 | Two tooltip mechanisms in one file (Radix tooltip + native `title`) with different delays | `env-panel-header.tsx:22-35,46` |
| 34 | P2 | Resize handles: 4px grab target; `duration-100` vs `duration-250`; invisible handle on the collapsed AI panel | `resizable.tsx:34-40`; `index.tsx:91,138-141`; `env-panel.tsx:87` |
| 35 | P2 | DnD feedback is an opacity change only; grip vanishes while searching; no `accessibility.announcements` | `nav-bar-item.tsx:84,100`; `nav-bar.tsx:563,672` |
| 36 | P2 | Overlay scrim strengths diverge (40% vs 80%); `overlay` used as a decorative 2% glow | `dialog.tsx:22`; `alert-dialog.tsx:21`; `welcome-fragment.tsx:89` |
| 37 | P2 | Settings dialog: empty `DialogDescription` + `onOpenAutoFocus` prevented + focus forced onto *Save* | `settings-dialog.tsx:474,478-480,331-333` |
| 38 | P2 | `ScrollArea` viewports have no `tabIndex` — keyboard access depends on the browser | `update-dialog.tsx:101`; Radix viewport impl |
| 39 | P2 | Log panel: no role/label, no Escape-to-close, mouse-only height resize | `log-panel.tsx:186-196` |
| 40 | P2 | 53 identical `X dark:X` no-op colour pairs | `welcome-fragment.tsx` (39), `system-monitor.tsx` (11), 3 others |
| 41 | P2 | Focus-ring coverage is inconsistent: page-owned raw elements bypass the app's focus language | `app-footer.tsx:32`; `welcome-fragment.tsx:253-311`; `nav-bar.tsx:857-872`; `log-panel.tsx:47` |
| 42 | P2 | Pane framing/padding not on one rhythm (8/5/10/15/16px) + 11 magic pixel sizes | `index.tsx:127,157`; `nav-bar.tsx:585,614,648,698`; `app-footer.tsx:17`; `settings-dialog.tsx:473`; `log-panel.tsx:43,57,75` |

---

## 1. Surface & elevation errors

### F1 (P0) — The tooltip is unreadable in dark mode

```tsx
// src/pc/components/ui/tooltip.tsx:22
'z-50 overflow-hidden rounded-sm bg-foreground px-3 py-1.5 text-xs text-primary-foreground shadow-pop ...'
```
```css
/* src/global.css:102,105 */
.dark { --foreground: var(--c-label-d); /* 0 0% 86.1% */ --primary-foreground: var(--n-100); /* 0 0% 100% */ }
```
`--primary-foreground` is the *label-on-primary-fill* token and stays white in both themes (`global.css:68,105`), while
`--foreground` becomes a light grey in dark mode. The pair therefore renders **white text on `#dcdcdc`**: relative
luminance of 86.1% grey = 0.712 → contrast = 1.05 / 0.762 = **1.38:1**. This is the app's only tooltip primitive and it is
used in scope at `env-panel-header.tsx:22-35`:

```tsx
// src/pc/pages/env-panel/env-panel-header.tsx:32-34
<TooltipContent>
  <p className="text-xs">{t('base_service.serv_id')}{selectedServiceData.id}</p>
</TooltipContent>
```
A visibly broken element in the shipped dark theme, not a polish issue. The fix direction is a tooltip-specific inverse
pair (e.g. `bg-foreground text-background`), not `primary-foreground`.

### F3 (P1) — The main splitter has no resting state

```tsx
// src/pc/pages/index.tsx:91-92
const resizableHandleClassName = "w-px bg-content2 hover:bg-default transition-colors duration-100";
return <div className="fixed w-screen h-screen overflow-hidden bg-content2">
```
The handle fill equals the root fill, so the **primary 3-pane splitter is invisible until hovered** — the only affordance
is a 1px line that appears on `hover:bg-default`. The inner splitter does it correctly:
`env-panel.tsx:87 <ResizableHandle className="w-px bg-border hover:bg-default transition-all duration-250" />`, matching
the primitive default (`resizable.tsx:36 bg-border`). Three treatments for the same control.

### F4 (P1) — Hardcoded pane surfaces and inverted dark elevation

```tsx
// src/pc/pages/index.tsx:127
<div style={{ width: 'calc(100% - 8px)', height: 'calc(100vh - 10px)' }}
     className="bg-white dark:bg-background flex flex-col overflow-hidden rounded-lg border border-divider">
// src/pc/pages/index.tsx:157
<div style={{ width: 'calc(100% - 5px)', height: 'calc(100% - 10px)' }}
     className="bg-white dark:bg-content3 flex flex-col overflow-hidden rounded-lg border">
```
* `bg-white` bypasses the token system (`content1` is the panel-surface token, `global.css:71`).
* The dark values disagree in *direction*: center = `background` (`n9`, the window surface), AI = `content3` (`n18`), with
  the root at `content2` (`n20`). The AI panel — a secondary surface — is painted **above** the primary content pane and
  above the app's own window surface.
* In light mode both panes are literally `#ffffff`, so the AI panel has no surface identity at all; the elevation
  difference exists only in dark mode. This is the classic `bg-white dark:bg-X` pair the design language forbids.

### F5 (P1) — Two adjacent panes, two border tokens

Center pane: `border border-divider` (`index.tsx:127`). AI pane: bare `border` (`index.tsx:157`), which falls through to
`global.css:136-138 * { border-color: hsl(var(--border)) }`. `divider` (`95.5%/15.8%`) and `border` (`94%/15.4%`) are
distinct tokens with distinct roles (interior hairline vs panel border, `global.css:84-86`); the pair of side-by-side
rounded panes renders one of each.

### F6 (P1) — Log panel: contradictory classes, no shadow, background-coloured

```tsx
// src/pc/pages/log-panel/log-panel.tsx:186-187
<div className="fixed bottom-0 inset-x-0 z-40 px-1 pb-1 pointer-events-none">
  <div className="bg-content2 border rounded-lg bg-content1 border border-divider rounded-2xl pointer-events-auto overflow-hidden">
```
Four conflicting declaration pairs in one string (`bg-content2`+`bg-content1`, `rounded-lg`+`rounded-2xl`, `border` twice).
The winner is decided by the emitter's rule order, not class order, so the intended `bg-content1` + `rounded-2xl` is not
guaranteed; in the build I inspected `.bg-content2` is emitted after `.bg-content1` and `.rounded-lg` after
`.rounded-2xl`, i.e. the panel renders `content2` + 10px. Consequences:
* `bg-content2` equals the root fill (`index.tsx:92`), so in dark mode (`n20` on `n20`) the panel has **no surface
  separation** from the app background; only the 1px border delimits it.
* It is a genuine floating layer (fixed, `z-40`, overlays all three panes), yet the 11 scope files contain **zero**
  `shadow-pop` usages — the design language reserves exactly one shadow for floating layers
  (`global.css:187-199`, `tailwind.config.js:80-82`). The only floating surface implemented in these files has none.
* `px-1 pb-1` insets match no other pane inset in the app (8/5/10/15px — see §3).

### F7 (P1) — Radius system collapsed; three radii for floating layers

Design intent: panel/dialog `2xl` 16, card `xl` 12, control `lg` 10, small `md`/`sm` 8/6, inline `xs` 4
(`global.css:192-198` — `--radius-xs: 4px` is line 193 — and `tailwind.config.js:71-78`).
Observed in scope: `rounded-lg` 22, `rounded-md` 14, `rounded-full` 10, `rounded-2xl` 6, `rounded-xl` 4, `rounded-xs` 0 —
i.e. the *panel/card* half of the scale (`2xl`, `xl`) is almost unused while the *control* step (`lg`) dominates, and
`rounded-full` (10 uses, pills/avatars) is not part of the token vocabulary at all.
* Both main panes — panels — use `rounded-lg` (10px = the *control* radius) instead of 16 (`index.tsx:127,157`).
* Floating layers use **three** radii:
  `DialogContent`/`AlertDialogContent` default `rounded-sm` 6px (`dialog.tsx:31`, `alert-dialog.tsx:38`) → the create-env
  dialog (`nav-bar.tsx:757`), user dialog (`:814`), update dialog (`update-dialog.tsx:87`) and contact dialog
  (`welcome-fragment.tsx:321`); `settings-dialog.tsx:473` and both alert dialogs (`:124,599`) override to `rounded-2xl`
  (16px); the log panel is 10px (`log-panel.tsx:187`). Menus and tooltips are 6px (`dropdown-menu.tsx:49`,
  `tooltip.tsx:22`).

### F8 (P1) — Elevation direction flips between themes inside cards

```tsx
// src/pc/pages/welcome-fragment.tsx:388 (identical pattern at :259)
<div className="w-6 h-6 rounded-full bg-content3 dark:bg-content2 ...">
```
The parent card is `bg-content1` (`:387`). In light the badge is `content3` 95% against a 100% card → **5% darker,
recessed**; in dark it is `content2` 20% against a 12% card → **8% lighter, raised**. The element changes role between
themes (group fill vs control fill, `global.css:70-78,106-114`) and its perceived relation to the parent inverts.

### F25 (P2) — Dialog surfaces differ for the same layer class

`dialog.tsx:31` / `alert-dialog.tsx:38` use `bg-background` (window surface); `settings-dialog.tsx:473` and the two alert
dialogs (`:124,599`) override to `bg-content1` (panel surface). The update, create-env and contact dialogs therefore sit
on a different token than the settings dialog although all six are the same Radix layer.

### F26 (P2) — Inset icon tiles never get a fill

```tsx
// src/pc/pages/welcome-fragment.tsx:372-374
className="flex items-start gap-4 p-4 rounded-xl border border-divider bg-content1 hover:bg-content2 ..."
  <div className="mt-1 p-2 rounded-lg bg-content1 dark:bg-content1/40 border border-divider ...">
```
The tile is `content1` inside a `content1` card → zero fill delta in light (white on white). `dark:bg-content1/40` is also
a no-op: `n12` at 40% alpha over `n12` composites to `n12`. Only the border distinguishes the tile.

### F27 (P2) — Welcome root surface is a no-op

`welcome-fragment.tsx:85 bg-content1 dark:bg-background` sits inside `index.tsx:127 bg-white dark:bg-background`.
Light: `#fff` inside `#fff`. Dark: `background` inside `background`. The fragment's surface declaration changes nothing in
either theme; the parent owns the surface, so the two files can drift silently.

### F29 (P2) — A utility that produces no CSS

```tsx
// src/pc/pages/index.tsx:158
<Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-default-400">...
```
`tailwind.config.js:45-48` defines `default: { DEFAULT, foreground }` only — there is no `400` step and no
`default-100..900` scale, so `text-default-400` emits nothing and the AI-panel loading state silently inherits
`text-foreground`. (A `content*-foreground` scale does exist in this repo but no scope file uses it.)

### F30 (P2) — Dead classes that look intentional

* `nav-bar.tsx:594` `group-hover:text-primary` — no ancestor in the file carries `group` (grep: the only `group` token in
  `nav-bar.tsx` is this span), so the Envis title never changes colour; only `hover:underline` fires.
* `nav-bar-item.tsx:128` `"hover:backdrop-blur-sm rounded"` on the action container — blur with no fill shows nothing.
* `app-footer.tsx:34` `bg-danger text-primary-foreground hover:bg-danger dark:bg-danger dark:hover:bg-danger` —
  `hover:bg-danger` equals the base value, so the update pill has **no hover feedback**, the dark pair is pure
  duplication, and the label token for a danger fill is `danger-foreground`, not `primary-foreground`.

### F36 (P2) — Overlay strengths diverge

`dialog.tsx:22 bg-overlay/40` vs `alert-dialog.tsx:21 bg-overlay/80` — the same modal-scrim role at two very different
strengths (80% black is far heavier than any AppKit sheet). `welcome-fragment.tsx:89` additionally uses the scrim token
as decoration: `bg-overlay/[0.02] dark:bg-content1/25 blur-[120px]`.

### F40 (P2) — 53 identical `X dark:X` no-op pairs

Counted pairs where the base and dark utility are byte-identical: `welcome-fragment.tsx` `text-focus` 13,
`text-muted-foreground` 12, `text-warning` 8, `text-success` 4, `text-danger` 2; `system-monitor.tsx` `text-foreground` 8,
`text-focus`/`text-success`/`text-warning` 3; `app-footer.tsx:17`; `env-panel-header.tsx:27`; `nav-bar-item.tsx:116`.
All are dead, and they hide real defects: `welcome-fragment.tsx:426` is
`"shrink-0 text-focus hover:text-focus dark:text-focus dark:hover:text-focus"` — four states, one value.

---

## 2. Typography hierarchy

### F9 (P1) — Arbitrary micro-sizes bypass the type tokens (and set size without line-height)

The repo now defines an explicit type scale as tokens — `global.css:210-228` with the rule quoted verbatim:
"直接写 text-[10px] 只设 font-size，行高会继承父级 → 纵向节奏错乱，故立此 token。中文不得低于 12px，10/11px 只允许纯数字/英文微标签。"
(`--text-3xs: 10px/14px`, `--text-2xs: 11px/16px`, `--text-xs: 12px/16px`, `--text-sm: 13px/20px`, `--text-md: 14px/20px`,
`--text-base…3xl`), mapped at `tailwind.config.js:99-110`. Every arbitrary pixel size below is therefore both a
token bypass *and* a line-height bug (the class sets only `font-size`):

* `text-[9px]` ×3 — `system-monitor.tsx:197,225,253`, the value inside each 40px donut
  (`<span className="text-[9px] font-bold text-focus dark:text-focus">`). 9px is below the smallest token (`3xs` 10px):
  no token exists for it, it must move to at least `text-2xs`, and it is a numeric readout so the "micro-label" exemption
  could apply — but the exemption is 10px, not 9px.
* `text-[10px]` ×19 — `welcome-fragment.tsx` 9, `system-monitor.tsx` 8, `app-footer.tsx` 2; all should be `text-3xs`.
  **~15 of these wrap localized / CJK text, which the rule forbids below 12px**:
  `app-footer.tsx:17` (the whole bar, including `t('app_footer.update_available')`),
  `system-monitor.tsx:201,205,229,233,257,261,280,287` (`t('system_monitor.system'|'user'|'used'|'total'|'upload'|'download')`
  → 系统/用户/已用/总计/上传/下载), `welcome-fragment.tsx:264,280,294,308` (community descriptions),
  `:392` (every getting-started step description), `:436,454,499,506` (warning bodies and dismiss links).
* `text-[11px]` ×17 — should be `text-2xs`; 13 sites are `log-panel.tsx:58,278,279,282,283,285,297,301,310,314,323,328,336`
  (JSON dumps and English debug keys — within the exemption), but `welcome-fragment.tsx:420,432,485,495` wrap translated
  prose and therefore break the ≥12px rule.
* `text-3xl` (30px) ×1 — `welcome-fragment.tsx:128 <h1 className="text-3xl font-bold ...">Envis</h1>`; `3xl` *is* the top
  token, but a 30px wordmark over a 12px section label is a 2.5× jump with nothing between it and `text-lg`.


### F10 (P1) — A one-pixel ladder cannot carry the hierarchy

`text-xs` (12px) is the most frequent size (54 uses) and simultaneously carries:
* **section labels** — `welcome-fragment.tsx:204` and `system-monitor.tsx:184`
  `"text-xs font-medium text-muted-foreground uppercase tracking-wider px-1"` (the only 4 `uppercase` + `tracking-wider`
  uses in scope);
* **secondary/meta text** — `welcome-fragment.tsx:392` (`text-[10px]`), `system-monitor.tsx:201,205,229` (`text-[10px]`),
  `log-panel.tsx:43` (timestamp `text-xs`), `log-panel.tsx:278` (`text-[11px]`);
* **badges / state words** — `log-panel.tsx:32` `LevelBadge` `text-xs font-medium`,
  `nav-bar-item.tsx:116` status `text-xs truncate font-mono`, `nav-bar.tsx:830` VIP chip;
* **body copy** — `nav-bar.tsx:654` vs `:655` use `text-sm` and `text-xs` for two lines of the same empty state.

Because 9/10/11/12/13px are all in active use, size alone can never signal role, and weight is used inconsistently to
compensate (`text-sm font-medium` 22×, bare `text-sm` 18×, bare `text-xs` 37×, `text-xs font-medium` 14×).

### F11 (P1) — "Heading" is three different things

| role | treatment | location |
| --- | --- | --- |
| pane/service title | `text-base font-semibold` (16/600) | `env-panel-header.tsx:25` |
| dialog title | `text-lg font-semibold` (18/600) | `settings-dialog.tsx:477`; `dialog.tsx:74` default |
| section header (welcome, monitor) | `text-xs font-medium uppercase tracking-wider text-muted-foreground` (12/500) | `welcome-fragment.tsx:204,238,251`; `system-monitor.tsx:184` |
| section header (settings) | `text-sm font-medium` + 16px `text-primary` icon (13/500) | `settings-dialog.tsx:641,700,748,819` |
| card title | `text-sm font-medium` (13/500) | `welcome-fragment.tsx:228,378`; `system-monitor.tsx:189` |

The same semantic slot is 12px/lower-contrast/uppercase in the welcome + monitor panes and 13px/foreground in settings.
Inside the welcome pane the group label (`:204`) is *smaller and lighter* than the item titles it labels (`:228`), so the
grouping reads as metadata — hierarchy is carried by colour, and that colour is the sub-AA muted token (F12).

### F12 (P1) — `text-muted-foreground` and the semantic colours are sub-AA in light mode

`--muted-foreground: var(--c-label2-l)` = `0 0% 50.2%` (`global.css:39,83`; dark 119). Relative luminance 0.216 → contrast:
* on `content1` (100%) → **3.95:1**
* on `content2` (96.5%) → **3.66:1**
* on `content4` (93.3%, the hovered/selected row) → **3.40:1**

WCAG AA for normal text is 4.5:1, and 13/12/11/10px are all normal text, so every muted label in the shell fails:
nav empty states (`nav-bar.tsx:650-655`), app footer (`app-footer.tsx:17`), log timestamps (`log-panel.tsx:43`),
monitor labels (`system-monitor.tsx:202-263`). Dark mode passes (59% on `n12` = **5.55:1**).
The same class of problem affects semantic text: `success` `hsl(142 76% 36%)` = 3.35:1 on white (the 12px `Active`
label, `nav-bar-item.tsx:116`), `danger` `hsl(0 84% 60%)` = 3.78:1 (13px delete menu item, `nav-bar-item.tsx:170`;
delete button, `settings-dialog.tsx:116-119`), and 10px white on `bg-danger` (`app-footer.tsx:34`) = 3.78:1.

### F13 (P1) — A border token used as a text colour — **fixed in tree 00:56:57**

```tsx
// src/pc/pages/system-monitor.tsx:282,289 — as audited
<ArrowUp   className={`w-3 h-3 ${displayInfo.network.upload   > 0 ? ' text-focus' : ' text-default dark:text-muted-foreground'}`} />
<ArrowDown className={`w-3 h-3 ${displayInfo.network.download > 0 ? ' text-success' : ' text-default dark:text-muted-foreground'}`} />
// current tree: ' text-muted-foreground' in both branches
```
`global.css:80` documents `--default` as "hover 边框/把手" (`controlHoverBorder`), 90.2% in light. As an icon colour on the
`bg-content1` network card (`system-monitor.tsx:271`) it was **~1.25:1** — effectively invisible; only the `dark:` override
keeps the idle arrow visible in dark mode. The tree now uses `text-muted-foreground`, which is the correct token.
The same token misuse still exists in the sibling service panels, where hover *reduces* contrast:
`text-muted-foreground hover:text-muted-foreground dark:hover:text-default` at
`mysql-service/index.tsx:1543`, `mariadb-service/index.tsx:1513`, `postgresql-service/index.tsx:1535`,
`mongodb-service.tsx:1615` — in dark mode that lands on `--default` = `n22` over a `content1` `n12` card ≈ **1.4:1**, so
the icon disappears on hover.

### F28 (P2) — `dark:text-primary-foreground` (15 uses)

`text-foreground dark:text-primary-foreground` (`welcome-fragment.tsx:85,128,228,259,263,279,293,307,339,348,357,378,388,391`;
`env-panel-header.tsx:25`) resolves in dark mode to the *primary-button label* token — pure white (`global.css:105`) —
instead of the dark-mode label colour `n86.1` (`global.css:102`). `text-foreground` is already theme-correct, so the
override hard-codes a brighter, off-system colour on 15 text nodes.

---

## 3. Layout / spacing

### F24 (P1) — The nav search row overflows its panel at the allowed minimum width

```tsx
// src/pc/pages/index.tsx:96-102
<ResizablePanel ref={navPanelRef} defaultSize={navPanelWidthRatio} collapsedSize={0} collapsible={true} minSize={10} className="min-w-0" ...
```
```tsx
// src/pc/pages/nav-bar/nav-bar.tsx:614-641
<div className="flex items-center gap-2 pl-[10px] pr-[4px]">
  <div className="relative flex-1"> ... <Input className={`pl-8 ... h-8 text-sm`} /> ... </div>
  <Button size="sm" variant="outline" ... className="h-8 w-8 p-0 flex-shrink-0"><Plus className="h-4 w-4" /></Button>
```
The wrapper `relative flex-1` has no `min-w-0`, so its automatic minimum size is the `<input>`'s intrinsic ~20-character
width (`input.tsx:13` sets `w-full` but no `min-width:0`). At `minSize={10}` (10% of a 1200px window ≈ 120px) the row needs
≈210px, and every `ResizablePanel` carries an inline `overflow: hidden`
(`node_modules/react-resizable-panels/dist/react-resizable-panels.browser.cjs.js:1445`), so the **"+ create environment"
button is clipped and unreachable** at widths the layout explicitly permits. `nav-bar-item.tsx:92` and the list wrapper
(`nav-bar.tsx:648`) do carry `min-w-0`, so the fix is known in this codebase but not applied here.

### F14 (P1) — A pane header that unmounts

```tsx
// src/pc/pages/env-panel/env-panel-header.tsx:14-16
if (!selectedServiceData) { return null }
```
The detail pane's entire header (and its `border-b border-divider`) disappears whenever the dashboard is shown, so the
right pane's content shifts up by the header height and the AI-assistant button (`:41-49`) vanishes — an affordance that
comes and goes with selection state, and the only entry point to the AI panel from that pane.

### F15 (P1) — A header that cannot truncate

```tsx
// src/pc/pages/env-panel/env-panel-header.tsx:19-30
<div className="p-2 border-b border-divider flex items-center justify-between">
  <div className="flex items-center ml-2">
    <div className="flex flex-col">
      <h2 className="text-base font-semibold ... cursor-default hover:underline underline-offset-4">
        {selectedServiceData.name}
        <span className="text-xs text-muted-foreground ...">&nbsp;&nbsp;{selectedServiceData.version}</span>
```
No `min-w-0` on the left cluster and no `truncate` on the name (contrast `nav-bar-item.tsx:112-113`, which does both), so
a long service name or a longer localized version label pushes the `justify-between` row's AI button out. The version is
joined with non-breaking spaces instead of a layout gap. The name also carries `hover:underline` while being
`cursor-default` — a link affordance on a non-interactive element.

### F42 (P2) — Inconsistent pane framing, off-scale paddings, magic numbers

| pane | padding | frame |
| --- | --- | --- |
| nav | header `p-[15px] pr-[6px]` (`nav-bar.tsx:585`); search/list `pl-[10px] pr-[4px]` (`:614,648`); footer `h-[38px] pl-2 pt-1` (`:698`) | none |
| service list | header `p-2` + `ml-2` (`service-data-list.tsx:116,134`); list `p-[10px]` (`:190`) | none |
| detail | header `p-2` + `ml-2` (`env-panel-header.tsx:19-20`) | none |
| center | 8px inset / −10px height via inline `calc()` (`index.tsx:127`) | `rounded-lg border border-divider` |
| AI | **5px** inset / −10px height (`index.tsx:157`) | `rounded-lg border` |

Left content insets across the columns are 15px, 10px, 8px (nav list) and 16px (detail header) — four values for one
visual role, with the two side-by-side header rows misaligned. Magic numbers in scope:

| value | location |
| --- | --- |
| `w-[22px] h-[22px]` | `nav-bar.tsx:591` (app icon) |
| `h-[38px]` | `nav-bar.tsx:698` (nav footer) |
| `h-[32px]` | `app-footer.tsx:17` (app status bar — 6px shorter than the nav footer) |
| `min-w-[140px]` | `nav-bar.tsx:733` (overflow menu) |
| `max-w-[640px]` | `nav-bar.tsx:814` (user dialog) |
| `max-h-[260px]` | `nav-bar.tsx:910` (uploaded JSON list) |
| `sm:max-w-[625px] h-[500px]` | `settings-dialog.tsx:473` |
| `w-[1000px] h-[500px]` | `welcome-fragment.tsx:89` (decorative glow) |
| `min-w-[64px]`, `ml-[74px]` | `log-panel.tsx:43,57` |
| `224` default / `minH 120` / `maxH -80` | `log-panel.tsx:75,110,111` |
| `px-2.5 py-0.5` | `app-footer.tsx:34` (update pill, 10px text in a 32px bar) |

Two more spacing smells: `welcome-fragment.tsx:123` sets `max-w-2xl px-6` on the column and `:155` repeats
`w-full max-w-2xl mx-auto mt-6` on a child, so the network-error banner gets the parent's `gap-8` **plus** `mt-6` (56px)
while every sibling uses 32px; and `welcome-fragment.tsx:136` (Discord chip: `h-7 px-2.5 ... mr-2`, no icon) sits beside
`:144` (GitHub chip: `px-3 py-1.5`, icon + text + arrow) — two chips in one row, different heights and anatomy.
`env-panel-header.tsx:40` also uses `space-x-2` **and** `mr-1` on the same button (`:45`), giving 12px where every other
toolbar uses 8px.

---

## 4. Interaction states

### F2 (P0) — The primary navigation is mouse-only

```tsx
// src/pc/pages/nav-bar/nav-bar-item.tsx:88-97
<div ref={setNodeRef} style={style} className="mb-2 min-w-0">
  <div className={cn("group relative flex items-center p-2 rounded-lg cursor-pointer ... hover:bg-content4",
                     isSelected && "bg-content4", isDragging && "z-50")}
       onClick={() => onSelect(environment)}>
```
No `role`, no `tabIndex`, no `onKeyDown`, no `aria-selected`, no focus style. Selecting an environment — which switches
the entire detail pane — cannot be done from the keyboard. Inside the row the only focusable elements are the drag handle
(dnd-kit's `useDraggable` attributes set `tabIndex = 0`, `@dnd-kit/core/dist/core.cjs.development.js:3404`) and the two
action buttons, which are invisible while focusable (F16). Selection itself is conveyed by fill only (`bg-content4`):
93.3% on a 96.5% sidebar in light (3.2 L) and 22% on 20% in dark (**2 L**, effectively invisible).

### F16 (P1) — Hover-only controls are focus-invisible — **fixed in tree 01:01:17**

```tsx
// src/pc/pages/nav-bar/nav-bar-item.tsx:125-130 — as audited
"absolute right-3 top-1/2 transform -translate-y-1/2",
"flex items-center transition-all duration-250",
"opacity-0 group-hover:opacity-100",
"hover:backdrop-blur-sm rounded"
// current tree line 127: "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
```
The wrapper was `opacity-0` until the *mouse* hovered the row, so a keyboard-focused child kept it at `opacity: 0` and its
focus ring (`button.tsx:8 focus-visible:ring-2 focus-visible:ring-focus`) was invisible. `group-focus-within:opacity-100`
is now present, which resolves it. What remains: row hover and button hover paint the same `content4`/`content2` fills, so
on a hovered row the play/stop button is still indistinguishable from the row fill; and `hover:backdrop-blur-sm` on
`:130` is still a no-op (no fill, F30).

### F17 (P1) — Destructive actions use three different confirmation policies

* **No confirmation, immediate:** environment delete from a dropdown item —
  `nav-bar-item.tsx:168-174 <DropdownMenuItem onClick={... onDelete(...)} className="text-danger">`, directly under
  Export in the same menu. The only guard is that an *active* environment is refused (`nav-bar.tsx:183-187`). No undo.
* **Confirmed:** installed-service delete uses a full `AlertDialog` with a warning icon, a permanence sentence, a
  disabled state and a spinner (`settings-dialog.tsx:110-160`); quit-app uses the same pattern (`:590-630`).

### F18 (P1) — Two unconfirmed destructive controls in the log panel

* "Clear all" (`log-panel.tsx:146 clearAll = () => setEntries([])`, wired at `:222`) discards up to 1000 entries
  (`store/log.ts MAX_LOG_ENTRIES = 1000`) from a 28px ghost icon button with no confirmation.
* Refresh (`log-panel.tsx:233 onClick={() => location.reload()}`) reloads the entire webview — discarding all in-memory
  UI state — from an identical ghost icon button placed immediately left of Close, with no confirmation and no
  distinction in weight from Copy/ascending/pause.
* Both sit in the row `<div className="flex items-center gap-1">` (`:204`) where Close is the same size and style, so the
  only signal of destructiveness is the icon glyph.

### F41 (P2) — Focus-ring coverage is inconsistent; page-owned raw elements bypass it

The shared `Button` provides `focus-visible:ring-2 ring-focus` (`button.tsx:8`) and the settings dialog repeats it
verbatim, but page-owned interactive elements are raw and unmanaged: the update pill `app-footer.tsx:32-37` (raw
`<button>`), the community rows `welcome-fragment.tsx:253-311` (`<div onClick>` — not focusable at all), the VIP plan cards
`nav-bar.tsx:857-872` (raw `<button>` whose selected state is `border-primary bg-primary/5` — border + tint only), the log
meta toggle `log-panel.tsx:47-53`, and the dismissable banner buttons (`welcome-fragment.tsx:424,487`). Two of these do
carry `aria-label` (`:427,490`), so the gap is consistency of the focus language rather than total absence.

### F32 (P2) — Missing accessible names and mismatched hit targets

* Icon-only buttons named only by `title`: 27 `title=` vs 2 `aria-label` in scope — nav footer actions
  (`nav-bar.tsx:715,728`), nav close (`:605`), log panel actions (`log-panel.tsx:210,216,219,222,228,233,236`), env header
  AI button (`env-panel-header.tsx:46`). `title` does supply an accessible-name fallback but is not shown on keyboard
  focus and is inconsistent with `welcome-fragment.tsx:427,490`.
* **No name at all:** the two floating buttons on the welcome screen — `welcome-fragment.tsx:97-108` and `:109-119` are
  `Button size="icon"` wrappers around `<PanelLeft>` / `<Bot>` with no `aria-label`/`title`/`sr-only`, i.e. two unnamed
  buttons that are the only way to open the nav and AI panels from that screen (contrast `dialog.tsx:47`, which does
  include `<span className="sr-only">Close</span>`).
* Hit targets: `h-4 w-4` 16px (`app-footer.tsx:22` — a 16×16 console button in a 32px bar), `h-6 w-6` 24px
  (`nav-bar.tsx:628`), `h-7 w-7` 28px (6×), `h-8 w-8` 32px (5×), `h-9 w-9` 36px (0×).

### F33 (P2) — Two tooltip mechanisms in one header

`env-panel-header.tsx:22-35` wraps the service name in a Radix `Tooltip`/`TooltipProvider` (styled, `shadow-pop`, 12px,
default 700ms delay) while `:46` gives the adjacent AI button `title={t('dashboard.ai_assistant')}` (native, unstyled,
~1s delay, not shown on focus). The same pattern repeats for all 27 `title=` usages in the shell.

### F31 (P2) — Empty and duplicated classNames

`className=""` appears 6× (`nav-bar.tsx:791,800,898,952`, `settings-dialog.tsx:882`, `update-dialog.tsx:126`).
`settings-dialog.tsx:1047` and `:1054` each contain the full
`transition-all duration-250 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2`
chain **twice** in one string.

---

## 5. Status semantics

### F19 (P1) — Environment status: binary, hardcoded English, sub-AA colour

```tsx
// src/pc/pages/nav-bar/nav-bar-item.tsx:116-118
<span className={cn("text-xs truncate font-mono flex items-center gap-1.5",
      currentStatus === 'active' ? " text-success dark:text-success" : " text-muted-foreground")}>
  {currentStatus === 'active' ? 'Active' : 'Inactive'}
</span>
```
* `EnvironmentStatus` has three values (`Unknown`, `Active`, `Inactive` — `types/index.ts:27-31`), but the row renders a
  binary, so `unknown` is displayed as "Inactive" — a false state rather than an absence of one.
* The strings are hardcoded English although the translations already exist: `zh.json nav_bar_item.active = "运行中"`,
  `.inactive = "未运行"` (and `en.json` equivalents) — Chinese users see English.
* One field, two representations: the icon uses `EnvironmentStatus.Active` (`:140`) while the text compares `'active'`
  (`:116,117`).
* Status is green text (measured 3.35:1, F12) plus a word; there is no icon, spinner, error or pending state for
  environments, even though the data model distinguishes four `ServiceStatus` values and eight `DownloadStatus` values.
* The toggle button shows `Square` (stop) vs `Play` (`:140-144`) with no independent state styling.
Good counter-example in scope: `log-panel.tsx:24-33 LevelBadge` maps levels to `danger/warning/success/focus` tokens *and*
prints `[LEVEL]`, so it is not colour-only — except `debug → text-focus`, borrowing the focus/selection blue for severity.
Also minor: the status word is set in `font-mono` (`:116`), but the new font-family token reserves mono for
"路径/命令/日志/配置/端口/版本号/ID" (`global.css:200-206`) — a status word is none of those.

### F20 (P1) — The user-facing log/diagnosis panel is always empty in release builds

```ts
// src/pc/hooks/log.ts:9
const shouldRecordLogs = !import.meta.env.PROD
// src/pc/hooks/useRustLogger.ts:23
if (isProduction) { return }
```
Both writers into `logEntriesAtom` are disabled in production and no other writer exists (grep for
`appendLogAtom|logEntriesAtom` finds only these two plus the panel itself). Yet the nav bar ships a "diagnosis" action
(`nav-bar.tsx:502-507`, `t('nav_bar.diagnosis')` → `FlaskConical`) that opens the panel, whose only possible end-user
state is `log-panel.tsx:245-246 t('log_panel.no_logs')`. If the gating is intentional the button should be dev-only;
otherwise diagnostics cannot be collected from users.

### F22 (P1) — Failure styling keyed on a literal the backend never emits

`settings-dialog.tsx:86` gates the spinner on `service.sizeFormatted === '计算中...'` and `:89` gates the danger colour on
`=== '计算失败'`. A repo-wide grep of `src-tauri/crates` finds only `计算中` (`service_manager.rs:127`); the core emits
`"未知"` for a missing service (`:170`), never `计算失败`. The "failed" styling is therefore dead code, and the loading
state is coupled to an untranslated backend literal.

---

## 6. Drag & drop / resize affordances

### F34 (P2) — Resize handles

* Visual line 1px, grab target 4px: `resizable.tsx:34-40`
  (`w-px` + `after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2`) — roughly half the ~8px
  AppKit divider affordance, and `focus-visible:ring-1` is applied to a 1px element.
* The outer splitter is invisible at rest (F3) and uses `duration-100` (`index.tsx:91`) while the inner one uses
  `duration-250` (`env-panel.tsx:87`). Both are token durations (`global.css:227-230`: `--dur-1 100ms` = press feedback,
  `--dur-3 250ms` = overlays/panels), so this is a *role* mismatch rather than an off-scale value: `duration-100` is the
  press-feedback step applied to a hover colour change, and it disagrees with the sibling splitter, which uses the
  250ms hover/panel step. `--dur-2 150ms` (the documented hover/focus step) has no Tailwind utility — the config only
  maps `250` and `400` (`tailwind.config.js:112-115`) — so the intended hover duration is not reachable from a class name.
* `index.tsx:138-141` always renders the AI-panel handle, including when that panel is collapsed to 0
  (`collapsedSize={0}`), producing a 4px `cursor-ew-resize` strip at the window's right edge with no visual
  (`bg-content2` on `bg-content2`) and no indication of what it resizes.

### F35 (P2) — Drag & drop feedback

* `nav-bar-item.tsx:81-85` — the only drag feedback is `opacity: isDragging ? 0.5 : 1`; no `DragOverlay`, no drop
  indicator, no shadow, so the dragged item stays in flow instead of becoming a floating layer.
* Sorting is silently disabled while searching (`nav-bar.tsx:563 const isDragEnabled = searchTerm.trim() === ''`) and
  `nav-bar-item.tsx:100 {isDragEnabled && ( ...grip... )}` removes the grip entirely — typing in the search box shifts
  every row's text left/right by 24px with no explanation.
* The grip is a bare `div` carrying dnd-kit attributes (`:101-109`) — focusable (`tabIndex 0`, F2) but with no
  `focus-visible` style, and named only by `title`.
* `nav-bar.tsx:672-676 DndContext` passes no `accessibility={{ announcements }}`, so keyboard sorting announces dnd-kit's
  built-in **English** strings in a zh-CN application.
* `log-panel.tsx:132-139` makes the whole header row the resize gesture (`cursor-ns-resize`), excluding only
  `target.closest('button')` — a press in the tab strip's padding starts a resize; the gesture is mouse-only
  (`onMouseDown`, no keyboard equivalent, no visible handle, `title` as the only hint).

---

## 7. i18n rendering risk

### F21 (P1) — Hardcoded Chinese in user-facing paths

```ts
// src/pc/pages/nav-bar/nav-bar.tsx:168
toast.error(res.message || '环境停用失败')
```
```tsx
// src/pc/pages/nav-bar/settings-dialog.tsx:90-92
{service.sizeFormatted === '计算中...' ? t('settings.calculating') :
 service.sizeFormatted === '计算失败' ? t('settings.calc_failed') :
 service.sizeFormatted}
```
`service.sizeFormatted` comes from the Rust core and is rendered verbatim
(`service_manager.rs:127 size_formatted: "计算中...".to_string()`, `:170 "sizeFormatted": "未知"`), so an English user sees
`计算中...` / `未知` in the services table.

### F23 (P1) — Log columns lock to the en-US 12-hour clock

```tsx
// src/pc/pages/log-panel/log-panel.tsx:43,57
<span className="text-muted-foreground min-w-[64px]">{formatTime(entry.time)}</span>
...
<div className="mt-1 ml-[74px] pl-2 border-l border-divider">
```
`formatTime` uses `new Date(ts).toLocaleTimeString()` (`:19-22`) — the *OS* locale, not the app language — and
`min-w-[64px]` is sized for `10:23:45` (8 chars ≈ 55px at 13px). en-US `toLocaleTimeString()` yields `"10:23:45 PM"`
(≈70px at 13px), so the column grows past its minimum while the expanded-metadata indent stays fixed at `ml-[74px]` and
the JSON block no longer aligns with the message text. One markup, two layouts depending on locale.

### F21b (P2) — Hardcoded English inside the log panel

`log-panel.tsx:334 <AccordionTrigger className="py-2 text-xs">Log ({t('log_panel.meta_info')})</AccordionTrigger>` mixes a
literal with a translation, and the state tab prints raw English identifiers as labels (`:278,282` `appSettings` /
`systemSettings`; every row at `:286-338`, e.g. `isLeftPanelOpen: {String(isNavPanelOpen)}`).

### F21c (P2) — No missing-key gaps

All 318 static `t('...')` keys used across the 11 files exist in both `en.json` and `zh.json` (the only "misses" are
regex false positives from `closest('button')` and `split('/')`), and the dynamic `user_dialog.plan_*` keys resolve. The
i18n problems in the shell are *bypasses* (F19, F21, F21b), not missing translations.

---

## 8. Accessibility (remaining items)

* **F2 / F16** keyboard-inoperable nav rows and focus-invisible controls (P0/P1).
* **F38 (P2)** `update-dialog.tsx:101` puts the release notes in `ScrollArea className="h-48 rounded-md border border-border p-3"`.
  Radix's viewport is a plain `div` with no `tabIndex` (the module contains no `tabIndex` at all: `node_modules/@radix-ui/react-scroll-area/dist/index.mjs`),
  so keyboard scrolling relies on the browser's focusable-scroller behaviour, which is not guaranteed in the WKWebView
  that Tauri uses. The same construct carries the nav environment list (`nav-bar.tsx:647`) and the log state tab
  (`log-panel.tsx:270`).
* **F37 (P2)** `settings-dialog.tsx:471-481`: `onOpenAutoFocus={(e) => e.preventDefault()}` removes Radix's initial focus
  and `:331-333` then focuses the **Save** button after 100ms — a screen reader enters the dialog on the primary action
  instead of the title — and `DialogDescription` (`:478-480`) is an empty element that Radix still wires as
  `aria-describedby`.
* **F39 (P2)** The log panel is a fixed overlay (`log-panel.tsx:186`) with no `role`/`aria-label`, no Escape-to-close
  (unlike every Radix dialog here), and while open it covers the app footer, which is rendered at the bottom of the
  welcome pane (`welcome-fragment.tsx:318`).
* All in-scope dialogs do have `DialogTitle` + `DialogDescription` (`nav-bar.tsx:758-765,815-818`, `update-dialog.tsx:88-96`,
  `welcome-fragment.tsx:322-327`, `settings-dialog.tsx:476-481`); the missing-name problem is limited to the welcome
  floating buttons (F32).
* No `prefers-reduced-motion` handling for the 37 `transition-all` / 33 `duration-250` / accordion animations in scope.

---

## Typography ladder (measured)

Counts = occurrences of the class inside quoted `className` literals in the 11 in-scope files. The repo's token scale
(`global.css:210-228` / `tailwind.config.js:99-110`) is the reference ladder; the design brief's expected set
(13 base, 11, 12, 14, 16, 18) is a subset of it.

| class used | px (token) | weight combos (count) | total | verdict |
| --- | --- | --- | --- | --- |
| `text-3xl` | 30 (`--text-3xl`) | `font-bold` (1) | 1 | top token, but a 2.5× jump over the next used size |
| `text-lg` | 18 (`--text-lg`) | `font-semibold` (1) | 1 | on-ladder; settings title + `DialogTitle` default |
| `text-base` | 16 (`--text-base`) | `font-semibold` (2) | 2 | on-ladder; pane/service titles (`env-panel-header.tsx:25`, `nav-bar.tsx:594`) |
| `text-sm` | 13 (`--text-sm`) | inherited (18), `font-medium` (22), `font-semibold` (1) | 41 | base size, also used for card titles → collides with body |
| `text-xs` | 12 (`--text-xs`) | inherited (37), `font-medium` (14), `font-semibold` (2), `font-bold` (1) | 54 | **most used**; section labels, meta, badges, body — role collision (F10) |
| `text-[11px]` | 11 (token exists: `2xs`) | inherited (17) | 17 | token bypass; also sets no line height. Log JSON/debug keys are within the documented micro-label exemption, the 4 `welcome-fragment.tsx` sites are translated prose and are not |
| `text-[10px]` | 10 (token exists: `3xs`) | inherited (19) | 19 | token bypass; **~15 sites wrap CJK/localized text**, which the token comment forbids below 12px (F9) |
| `text-[9px]` | 9 (**no token**) | `font-bold` (3) | 3 | off-scale even against the token ladder; donut values (`system-monitor.tsx:197,225,253`) |

Unused steps: `text-md` (14px) and `text-xl`/`2xl` (20/24px) appear **zero** times in scope, while 8 distinct sizes are in
use. 138 size declarations across 8 sizes in a 21px range, with four steps between 9 and 13. 10 distinct size+weight
combinations. Weights in use: 400 (inherited), 500, 600, 700; `font-semibold` appears 6× and `font-bold` 4×, i.e. heavy
weights are used ornamentally (donut numbers, wordmark, step numbers) rather than to build levels. Ancillary:
`leading-tight` 12×, `leading-relaxed` 6×, `uppercase` 4× (always with `tracking-wider`), `tracking-tight` 1×.

## Spacing inventory (measured)

Counts = occurrences across the 11 in-scope files.

**Padding**
`p-2` 23 · `p-3` 22 · `p-0` 9 · `p-4` 7 · `p-6` 1 · `p-1` 1 · `p-1.5` 1 · `p-0.5` 1 · **`p-[15px]` 1** (`nav-bar.tsx:585`)
`px-2` 11 · `px-3` 6 · `px-1` 5 · `px-2.5` 2 · `px-6` 1 · `px-4` 1
`py-2` 10 · `py-1` 2 · `py-0.5` 2 · `py-8` 1 · `py-1.5` 1 · `py-4` 1
`pl-6` 5 · `pl-2` 2 · **`pl-[10px]` 2** (`nav-bar.tsx:614,648`)
`pr-1` 1 · `pr-8` 1 · `pr-0` 1 · **`pr-[4px]` 2** (`nav-bar.tsx:614,648`) · **`pr-[6px]` 1** (`nav-bar.tsx:585`)
`pt-4` 3 · `pt-1` 2 · `pt-2` 2 · `pb-4` 4 · `pb-0` 4 · `pb-1` 1

**Gaps / stacks**
`gap-2` 30 · `gap-3` 16 · `gap-4` 7 · `gap-1` 5 · `gap-1.5` 2 · `gap-8` 1
`space-y-2` 24 (17 of them in `settings-dialog.tsx`) · `space-y-4` 13 · `space-y-3` 13 · `space-y-0.5` 6 · `space-y-1` 6 ·
`space-y-6` 1 · `space-y-1.5` 1 · `space-x-2` 3 · `space-x-1` 1

**Margins**
`mt-1` 9 · `mt-2` 6 · `mt-0.5` 2 · `mt-12` 1 · `mt-6` 1 · `mb-2` 7 · `mb-1` 5 · `mb-4` 2 · `mb-1.5` 1 · `mb-6` 1 ·
`mr-2` 24 · `mr-1` 2 · `ml-1` 1 · `ml-2` 1 · **`ml-[74px]` 1** (`log-panel.tsx:57`) · `mx-auto` 4 · `my-0` 1

Only 5 arbitrary spacing values exist (`p-[15px]`, `pl-[10px]`, `pr-[4px]`, `pr-[6px]`, `ml-[74px]`), and they sit exactly
in the files that own the shell's horizontal rhythm (`nav-bar.tsx`, `log-panel.tsx`) — i.e. where alignment with the
`p-2`/`p-3`/`px-4` panels matters. `p-2`(8px)/`gap-2`(8px) dominate, while the nav header uses 15px and the three panes'
body insets are 10/10/16px. `space-y-*` (margin) and `gap-*` (flex) are mixed for the same purpose —
`settings-dialog.tsx` uses `space-y-2` 17× while sibling panes use `gap-3`, and `welcome-fragment.tsx` uses both.

**Radius** (context for §1): `rounded-lg` 22 · `rounded-md` 14 · `rounded-full` 10 · `rounded-2xl` 6 · `rounded-xl` 4 ·
`rounded-xs` 0. Token steps defined: 4 (`xs`) / 6 (`sm`) / 8 (`md`) / 10 (`lg`) / 12 (`xl`) / 16 (`2xl`).
**Motion**: `transition-all` 37 · `duration-250` 33 · `transition-colors` 20 · `duration-100` 1 · `transition-transform` 1.
Token steps defined: 100 / 150 / 250 / 400 ms (`--dur-1…4`), of which only 250 and 400 have utility mappings.

---

## What is already consistent (do not "fix" these)

* Semantic state colours are used instead of raw colours in `log-panel.tsx:24-33 LevelBadge` and in the banners
  `welcome-fragment.tsx:415,480,156` (`border-focus/30 bg-focus/10`, `border-warning/30 bg-warning/10`,
  `border-danger/30 bg-danger/10`).
* `env-panel.tsx:87` is the correct splitter idiom (`bg-border hover:bg-default transition-all duration-250`) — the
  pattern F3 should follow.
* Panel size constraints are sane: `index.tsx:123 minSize={20}`, `env-panel.tsx:83,90`.
* Long-name handling exists where it was remembered: `nav-bar-item.tsx:88,112-113` (`mb-2 min-w-0`, `min-w-0 truncate`).
* All in-scope dialogs carry `DialogTitle` + `DialogDescription`, and the Radix close button has an `sr-only` label.
* `nav-bar.tsx:514-548` degrades footer actions into a "more" menu instead of overflowing.
