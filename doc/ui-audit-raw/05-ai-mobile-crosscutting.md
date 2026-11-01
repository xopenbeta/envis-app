# UI Audit — AI Panel, Mobile Build, and Cross-Cutting Inventories

**Scope:** `src/pc/pages/ai-panel/ai-panel.tsx`, `src/pc/pages/log-panel/log-panel.tsx` (typography / monospace / tokens only), `src/mobile/**`, `src/main-mobile.tsx`, `mobile.html`, `src/Loading.tsx`, plus whole-repo sweeps (a)–(h).
**Audited against:** `src/global.css` tokens + `tailwind.config.js` — `content1/2/3/4`, `divider/border/dialog-border`, `default`, `muted-foreground`, `success/warning/danger`, `focus/ring`, `overlay`; radii sm 6 / md 8 / lg 10 / xl 12 / 2xl 16; single `shadow-pop` on floating layers only; base 13px (`text-sm`); `.dark` as a **plain class selector**.
**Method:** read-only `grep` / `read`. A fresh Tailwind build was produced with `./node_modules/.bin/tailwindcss -i src/global.css -o /tmp/envis-audit/out2.css --content "./src/**/*.{ts,tsx},./index.html,./mobile.html"` to verify *which classes actually emit CSS*. `dist/assets/index-Dm_3_pKY.css` is **stale** (it predates `min-h-[80px]` in `ai-panel.tsx`), so it was not used as evidence. No repo file was modified except this report.

> ### ⚠ Snapshot & concurrent-modification notice — read this first
>
> **All counts and findings below describe the working tree at `HEAD=8ea75f1` as of `2026-09-24T16:59Z`, which contained 22 uncommitted modified files.**
>
> A **concurrent refactor was in flight while this audit ran** (`git status` lists modified `src/global.css`, `tailwind.config.js`, `src/pc/pages/ai-panel/ai-panel.tsx`, `src/pc/pages/index.tsx`, and 13 `components/ui/*` files). Three findings were **resolved mid-audit** and are marked `FIXED-IN-TREE` rather than deleted, because the numbers they invalidated are still quoted in the sections that follow. Every count in this report was re-run against the snapshot above; if you re-run the commands in §10 and get different numbers, the tree has moved again.
>
> Nothing under `src/mobile/**`, `src/main-mobile.tsx`, `mobile.html`, `src/Loading.tsx`, `src/pc/pages/log-panel/**` or `src/pc/i18n/**` was touched by that refactor, so **every mobile, log-panel and i18n finding below is unaffected.**

> **Two corrections to the brief, both verified in the fresh build:**
> 1. `content1-foreground … content4-foreground` **do** exist and **do** emit CSS (`src/global.css:71-77,107-113`; `tailwind.config.js:29-44`). `text-content1-foreground` is therefore valid, not dead.
> 2. `default` **does** emit `background-color/color: hsl(var(--default))` (`tailwind.config.js:45-48`), but **there is no `default-100…900` scale**. This was 12 dead declarations when the audit started and is now **1** (see F5).

---

## 0. Fixes that landed during this audit (`FIXED-IN-TREE`)

The concurrent refactor added a real token layer to `src/global.css` / `tailwind.config.js`. These three findings are **resolved in the working tree** and should not be re-filed:

| finding | was | now | evidence |
|---|---|---|---|
| **F1** dark `--primary` invalid | `--n-30` undefined → `hsl(var(--primary))` invalid → `bg-primary` rendered `transparent` in dark mode | **FIXED** — `--n-30: 0 0% 30%;` defined | `src/global.css:24`; `grep -oE '\-\-n-30: *[^;]*' /tmp/envis-audit/out2.css` → `--n-30: 0 0% 30%` |
| **F5** dead token-scale classes | 12 declarations emitting no CSS | **PARTIAL** — 11 replaced with `text-muted-foreground`; **1 remains** | `grep -rnE '(text\|bg\|border)-…-[0-9]{2,3}\b' src` → only `ai-panel.tsx:554` (`text-warning-600`); `index.tsx:158` is now `text-muted-foreground` |
| **F21** `prefers-reduced-motion` absent | 0 occurrences | **FIXED** — global kill-switch added | `src/global.css:263-273` (`@media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration: .01ms !important; … } }`) |

Also newly available in the tree (relevant to, but not resolving, findings below): `--radius-xs: 4px` + `borderRadius.xs` (`global.css:193`, `tailwind.config.js:69`) — **used 0 times**, so F30 stands; a full `fontSize` scale with paired line-heights (`--text-3xs…--text-3xl`, `--lh-3xs…--lh-3xl`); `fontFamily.sans/mono` with explicit CJK families; `transitionTimingFunction.standard`; `transitionDuration.400`; `::selection`; `color-scheme: light/dark`; `.nums { font-variant-numeric: tabular-nums }`; and **`body { overflow-wrap: break-word }`** (`global.css:148`), which incidentally mitigates F15 (see below) because `overflow-wrap` is inherited.

---

## Summary

| # | Sev | Issue | Location |
|---|-----|-------|----------|
| F1 | ~~**P0**~~ **FIXED-IN-TREE** | `--primary: var(--n-30)` in `.dark` while `--n-30` was undefined → `hsl(var(--primary))` invalid → **every `bg-primary` (all primary buttons) rendered `transparent` in dark mode**. Fixed mid-audit by defining `--n-30` | was `src/global.css:103` (refs); now defined at `src/global.css:24` |
| F2 | **P0** | AI panel markdown has **no typography at all**: `@tailwindcss/typography` is not installed, so all 15 `prose*` classes emit zero CSS; headings/code/blockquote fall back to raw UA defaults | `src/pc/pages/ai-panel/ai-panel.tsx:47`; `package.json:84-85`; `tailwind.config.js:135`; `grep -c prose /tmp/envis-audit/out2.css` → `0` |
| F3 | **P1** | Mobile is **not** a permanently-dark subtree. Only `AndroidTerminalPanel` mounts `dark`; the shell calls `setAppTheme('system')`, so a light-mode device renders a **light Home/Content page wrapping a dark terminal** | `src/mobile/App.tsx:16,55-62`; `src/mobile/pages/content/index.tsx:84,113`; `src/mobile/pages/android-terminal-panel/index.tsx:39`; `src/theme.ts:19-30` |
| F4 | **P1** | Code blocks in AI answers are completely unstyled **and cannot scroll**: (a) no highlight.js theme CSS is imported anywhere, so `hljs-*` spans are colourless; (b) `prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:bg-content3 prose-pre:p-3` are all dead (typography plugin absent) | `src/pc/pages/ai-panel/ai-panel.tsx:47,49`; `grep -rn hljs src` → 0 |
| F5 | **P2** (was P1) | 11 of 12 dead token-scale classes were fixed mid-audit. **1 remains**: `text-warning-600` emits no CSS, so the AI status-strip label inherits full-contrast `foreground` while only its `bg-warning` dot carries the amber | `ai-panel.tsx:554` (surviving); fixed: `:47,62,531,542,559,568,569,570,594,612`, `index.tsx:158` |
| F6 | **P1** | Every interactive element in the mobile build is **below the 44×44 touch minimum** — most are 19–28 px tall (e.g. `连接` ≈ 25 px, chevron toggle 24×24, `返回`/`状态` ≈ 24 px) | `home/index.tsx:147,156,166,191,213,273,283,328,334`; `content/index.tsx:88,106`; `android-terminal-panel/index.tsx:85,92` |
| F7 | **P1** | Zero mobile platform integration: no `env(safe-area-inset-*)`, no `viewport-fit=cover`, no `visualViewport`/keyboard avoidance, no orientation handling, no `inputMode`/`enterKeyHint`/`autoComplete`/`autoCorrect`, no `touch-action`/`overscroll`/`-webkit-tap-highlight` | `mobile.html:6`; whole of `src/mobile/**` (grep returns nothing — see §4.7) |
| F8 | **P1** | Mobile bypasses i18n entirely (0 `useTranslation`, 0 `i18n` import). 49 JSX-literal/attribute strings are hardcoded repo-wide, **16 of them in the mobile scope**, plus the shipped debug banner | `src/mobile/pages/home/index.tsx:180,181,224,238,254,255,261,268,295,296,302,308,316,322`; `content/index.tsx:90,108`; `App.tsx:57,58` |
| F9 | **P1** | `dark:` variants that exist only to compensate for a hardcoded light-mode colour: 40 non-semantic colour utilities (`bg-white` ×10, `bg-white/5` ×16, `bg-white/10` ×6, `bg-white/[0.03]` ×1, `text-white` ×2, `border-white/10` ×2, `border-white/5` ×1, `bg-black/45` ×2) each carrying a mirror `dark:` override | list in §2.2 |
| F10 | **P1** | Focus rings get a **white** 2 px offset in dark mode: `Button` base has `focus-visible:ring-offset-2` but `--tw-ring-offset-color` defaults to `#fff` and is never overridden | `src/pc/components/ui/button.tsx:8`; `out2.css:25,79` (`.--tw-ring-offset-color: #fff`) |
| F11 | **P1** | AI panel has **no copy**, **no regenerate**, and **no scroll-to-bottom affordance**, and **zero ARIA attributes** (`grep -n 'aria-\|role='` → 0 hits). The custom `userHasScrolledRef` logic silently stops auto-scroll with no way back other than manual scrolling | `ai-panel.tsx:95-96,120-144` (`scrollToBottom`), whole file |
| F12 | **P1** | `z-100` is not a Tailwind class (default scale stops at `z-50`), so the full-screen loading overlay renders at `z-index: auto` while the log panel is `z-40` and dialogs/toaster are `z-50`. The repo already uses the bracketed form `z-[100]` for exactly this layer, so the intent was `z-[100]` | `src/Loading.tsx:2` (dead) vs `src/pc/components/ui/toast.tsx:19` (`z-[100]`); `log-panel.tsx:186` (`z-40`); `src/pc/App.tsx:26-28` |
| F13 | **P2** | Log panel: contradictory duplicate utilities on one element — `bg-content2` **and** `bg-content1`, `rounded-lg` **and** `rounded-2xl`, two `border` declarations. CSS order decides (bg-content2 wins, rounded-2xl wins), so the written intent is unreadable | `log-panel.tsx:187` |
| F14 | **P2** | Log panel typography drift: the panel's own body copy is `text-xs` (12 px) and its metadata is `text-[11px]` ×13, `leading-tight` ×10 — vs the declared 13 px base. It is also the repo's worst `rounded` (4 px, off-scale) offender at 18 occurrences | `log-panel.tsx:32,41,58,214,246,274,278-338` (11 px), `49,58,279,283,286,287,298,299,301,311,312,314,324,325,326,328,337,338` (4 px radius) |
| F15 | **P2** (mitigated in-tree) | Assistant bubble lacks `break-words` while the user bubble has it. The literal asymmetry remains, but the refactor's `body { overflow-wrap: break-word }` is inherited, so long assistant tokens now do break; the user bubble's explicit `break-words` is now redundant rather than the assistant's being a bug | `ai-panel.tsx:587` vs `:591`; mitigation at `src/global.css:148` |
| F16 | **P2** | AI error state is an ordinary assistant bubble with the same `bg-content2` surface, same avatar-less layout, no danger colour/icon, no retry | `ai-panel.tsx:467-473`, surface from `:584` |
| F17 | **P2** | `Textarea` is `resize-none` with `min-h-[80px] max-h-[200px]` and **no auto-resize implementation** → the `max-h` is unreachable dead CSS; the box can never grow past 80 px | `ai-panel.tsx:647-648` |
| F18 | **P2** | AI panel header close button is icon-only with **no accessible name** (no `aria-label`, no `title`, no `sr-only`) — while its sibling clear button *does* have a `title` | `ai-panel.tsx:527-534` vs `:538-547` |
| F19 | **P2** | Mobile host expand/collapse is a 24×24 icon-only `<button>` with no accessible name and no `aria-expanded` | `src/mobile/pages/home/index.tsx:190-196` |
| F20 | **P2** | Focus-visible coverage is thin and inconsistent: 23 `focus-visible:` occurrences across 13 files vs 58 `outline-none`; 73 plain `focus:` utilities. Mobile inputs rely on `outline-none focus:border-focus`; every mobile `<button>` has no authored focus style at all | §4.5 |
| F21 | ~~**P2**~~ **FIXED-IN-TREE** | `prefers-reduced-motion` was absent repo-wide; the refactor added a global kill-switch. `motion-safe:`/`motion-reduce:` variants are still unused, and 66 `transition-all` + 20 `animate-in/out` still rely on the global override rather than per-utility intent | was whole repo; fixed at `src/global.css:263-273` |
| F22 | **P2** | `animate-caret-blink` is undefined (`tailwind.config.js:119-131` defines only accordion keyframes) → the OTP caret does not blink | `src/pc/components/ui/input-otp.tsx:42` |
| F23 | **P2** | 476 of the repo's 597 `dark:` occurrences are **redundant no-ops** because the token already redeclares itself under `.dark` (e.g. `text-warning dark:text-warning` ×41) — pure noise that hides the 121 that matter | §4.4 |
| F24 | **P2** | `text-xs` (12 px) outnumbers `text-sm` (13 px) **515 : 177**; the declared 13 px base is not the de-facto base font. The refactor added a tokenised `fontSize` scale (`--text-xs`/`--text-sm` + paired line-heights), so the scale now *exists*, but usage is unchanged | §1 |
| F25 | **P2** | i18n: `en.json` has a **duplicate top-level `"welcome"` key** (lines 530 and 645) and `zh.json` duplicates `advanced_options`/`use_prebuilt`/`compile_from_source` (lines 374-376 vs 377-379). `JSON.parse` keeps the last, so the first block is dead | `src/pc/i18n/locales/en.json:530,645`; `zh.json:374,375,376,377,378,379` |
| F26 | **P2** | Time stamps are formatted with locale-less `toLocaleTimeString()` / `toLocaleString()` → they do not follow the i18n locale | `log-panel.tsx:21`; `ai-panel.tsx:613`; `src/pc/store/ai.ts:31`; `src/pc/utils/logger.ts:32`; `nav-bar.tsx:917` |
| F27 | **P2** | Log panel resize handle is mouse-only (`onMouseDown` on a `<div>` with `cursor-ns-resize`); no `role="separator"`, no keyboard path, no ARIA | `log-panel.tsx:190-197,132-139` |
| F28 | **P2** | Shipped developer banner inside the mobile UI prints the detected platform and touch capability in English, at `text-[11px]` | `src/mobile/App.tsx:57-59` |
| F29 | **P2** | Dead code / duplicated class lists: `Separator` imported but never rendered (JSX commented out); the send button's focus-visible class list is copy-pasted **twice inside the same template literal**, and `bg-danger hover:bg-danger/90` appears twice | `ai-panel.tsx:3` vs `:633`; `ai-panel.tsx:654-657` |
| F30 | **P2** | 61 bare `rounded` (0.25 rem = **4 px**) utilities — a radius step absent from the declared 6/8/10/12/16 scale. The refactor added `rounded-xs` (4 px) as the sanctioned replacement, but **`rounded-xs` is used 0 times** and no bare `rounded` was migrated | worst: `log-panel.tsx` ×18; next `ca-install-guide.tsx` ×9; mobile `home/index.tsx:191`; new token unused at `global.css:193`, `tailwind.config.js:69` |

**Things that hold up (no finding):**
* Only one shadow exists in the whole repo: `shadow-pop` ×19, and **zero** `shadow-sm/md/lg/xl/2xl/inner`. The "one shadow, floating layers only" rule is respected.
* Zero Tailwind palette colours (`gray-*`, `blue-*`, `red-*`, …) and zero hex colour literals in any `.tsx`/`.ts`.
* Both locale files are **key-complete**: 1412 leaf keys each, 0 keys missing in either direction (§5).
* `Button`'s base class does carry a real `focus-visible:ring-2 focus-visible:ring-focus` ring (`button.tsx:8`), so the Radix-based PC controls are not ring-less.
* Mobile correctly relies on the *plain-class* `.dark` mechanism where it uses it: `android-terminal-panel/index.tsx:39` puts `dark` on its own root and re-declares the tokens for its whole subtree.

---

## 1. TYPOGRAPHY INVENTORY (complete, counted, reproducible)

Base font is 13 px. When the audit started, `tailwind.config.js` overrode only `fontSize.sm = ['13px','20px']` and `text-xs` kept Tailwind's 12 px/16 px. The concurrent refactor replaced that with a full tokenised scale (all counts below are unchanged by it, because the resolved pixel values are the same):

```js
// tailwind.config.js (current)
fontSize: {
  '3xs': ['var(--text-3xs)', 'var(--lh-3xs)'],   // 10px / 14px
  '2xs': ['var(--text-2xs)', 'var(--lh-2xs)'],   // 11px / 16px
  xs:    ['var(--text-xs)',  'var(--lh-xs)'],    // 12px / 16px
  sm:    ['var(--text-sm)',  'var(--lh-sm)'],    // 13px / 20px  ← declared base
  md:    ['var(--text-md)',  'var(--lh-md)'],    // 14px / 20px
  base:  ['var(--text-base)','var(--lh-base)'],  // 16px / 24px
  …
}
```

with the values in `src/global.css:205-215` under a comment that says "中文不得低于 12px，10/11px 只允许纯数字/英文微标签" (CJK must not go below 12 px; 10/11 px only for numeric/ASCII micro-labels). **The token now exists — but the 97 `text-[10px]` and 33 `text-[11px]` call sites were not migrated to it, and the mobile build (whose CJK copy is entirely at `text-xs`/`text-[11px]`) was not touched at all.**

### 1.1 Named text sizes — 704 occurrences

```bash
grep -rhoE '\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl)\b' src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn
```

| class | px / line-height | count | share | locations |
|---|---|---|---|---|
| `text-xs` | 12 / 16 | **515** | 73.2 % | repo-wide (51 files) |
| `text-sm` | **13 / 20 (the declared base)** | **177** | 25.1 % | repo-wide |
| `text-lg` | 18 / 28 | 7 | 1.0 % | `components/ui/{alert-dialog.tsx:67, sheet.tsx:92, drawer.tsx:71, dialog.tsx:75}`, `nav-bar/settings-dialog.tsx:477`, **`ai-panel.tsx:569`**, **`mobile/pages/home/index.tsx:140`** |
| `text-base` | 16 / 24 | 4 | 0.6 % | `service-data-list.tsx:134`, `env-panel-header.tsx:25`, `nav-bar.tsx:594`, **`mobile/pages/android-terminal-panel/index.tsx:43`** |
| `text-3xl` | 30 / 36 | 1 | 0.1 % | `welcome-fragment.tsx:128` |

No `text-xl`/`2xl`/`4xl`+ anywhere. **`text-xs` : `text-sm` = 515 : 177 = 2.91 : 1** — the app's de-facto body size is 12 px, one step *below* the declared base (F24).

### 1.2 Arbitrary text sizes — 138 occurrences (16.4 % of all text sizing)

```bash
grep -rhoE '\btext-\[[^]]+\]' src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn
```

| class | count | locations |
|---|---|---|
| `text-[10px]` | **97** | `java-service.tsx` ×15, `services-dashboard.tsx` ×11, `nodejs-service/index.tsx` ×10, `welcome-fragment.tsx` ×9, `system-monitor.tsx` ×8, `PipConfigView.tsx` ×6, `postgresql-service/index.tsx` ×6, `mysql-service/index.tsx` ×6, `mongodb-service.tsx` ×6, `mariadb-service/index.tsx` ×6, `rust-service.tsx` ×3, `VenvView.tsx` ×3, `ProjectDirectoryView.tsx` ×2, `app-footer.tsx` ×2, `PathConfigView.tsx`, `EnvironmentVariablesView.tsx`, `AutoChdirView.tsx`, `AliasesConfigView.tsx` ×1 each |
| `text-[11px]` | **33** | `log-panel.tsx` ×13, `mobile/pages/home/index.tsx` ×5, `welcome-fragment.tsx` ×4, `java-service.tsx` ×4, `mobile/pages/content/index.tsx` ×1, `mobile/App.tsx` ×1, `redis-service/index.tsx` ×1, `postgresql-service/index.tsx` ×1, `mysql-service/index.tsx` ×1, `mongodb-service.tsx` ×1, `mariadb-service/index.tsx` ×1 |
| `text-[9px]` | 3 | `system-monitor.tsx:197,225,253` (CPU / memory / disk percentage labels) |
| `text-[0.8rem]` | 3 | `components/ui/calendar.tsx:31`, `components/ui/form.tsx:127,149` |
| `text-[15px]` | 1 | `ai-panel.tsx:535` (panel title) |
| `text-[12px]` | 1 | `env-panel/service-data-panel/host-service/HostManagementView.tsx:440` |

**134 of the 138 are `px` values, and 133 of those are below the 13 px base** (9/10/11/12 px). `text-[10px]` alone is 70 % of the arbitrary sizing and 10 px is 77 % of the base size. None of these carry a line-height, so their line-height is inherited (unitless 1.5 from Tailwind preflight) rather than the type scale's — verified in the fresh build:

```
.text-\[10px\] { font-size: 10px; }      # no line-height
.text-\[11px\] { font-size: 11px; }      # no line-height
```

### 1.3 Font weights — 273 occurrences

```bash
grep -rhoE '\bfont-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b' src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn
```

`font-medium` 206 · `font-semibold` 48 · `font-normal` 14 · `font-bold` 5. No `font-light`/`thin`/`black`. Only 4 weight steps in use — consistent.

### 1.4 Line-height — 41 occurrences

```bash
grep -rhoE 'leading-[a-zA-Z0-9-]+' src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn
grep -rhoE 'leading-\[[^]]*\]'     src --include=*.tsx --include=*.ts   # → 0
```

`leading-relaxed` 19 · `leading-tight` 12 · `leading-none` 8 · `leading-5` 2. No arbitrary `leading-[…]` exists. But because 136 arbitrary font sizes omit a line-height, these 41 declarations cover only 4.8 % of text-size utilities.

### 1.5 Letter spacing — 25 occurrences

```bash
grep -rhoE 'tracking-[a-zA-Z0-9-]+' src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn
```

`tracking-wider` 14 · `tracking-tight` 5 · `tracking-widest` 4 · `tracking-wide` 2. No arbitrary `tracking-[…]`.

### 1.6 Font family — 37 occurrences

```bash
grep -rhoE '\bfont-(mono|sans|serif)\b' src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn
```

`font-mono` 36 · `font-sans` 1 · `font-serif` 0.

**Monospace usage by file (the log-panel requirement):**

```bash
grep -rc 'font-mono' src --include=*.tsx --include=*.ts | grep -v ':0$'
```

`log-panel.tsx` contains **no** `font-mono` at all. Its two JSON `<pre>` blocks (`log-panel.tsx:58`, `:279`, `:283`, `:301`, `:314`, `:328`) inherit monospace only from Tailwind preflight's `pre { font-family: theme(fontFamily.mono) }`, at `text-[11px] leading-tight`. Mobile terminal:
* output pane — `font-mono text-xs leading-5` = **12 px / 20 px** (`android-terminal-panel/index.tsx:56`)
* command input — `font-mono text-sm` = **13 px** (`:85`)
* submit button — `text-sm` *without* `font-mono` (`:92`)

So the terminal mixes a 12 px output and a 13 px input, and the Send button is not monospaced while its input is.

### 1.7 Text size/weight summary per in-scope file

| file | sizes actually used |
|---|---|
| `ai-panel.tsx` | `text-[15px]` (title), `text-lg` (empty title), `text-sm` (bubbles, textarea), `text-xs` (status strip, timestamps, hint) |
| `log-panel.tsx` | `text-xs` (log body, tab triggers, accordion triggers), `text-[11px]` ×13 (meta + full State tab) |
| `mobile/App.tsx` | `text-[11px]` ×1 (debug banner) |
| `mobile/pages/home/index.tsx` | `text-lg` (h1 "Envis"), `text-sm`, `text-xs`, `text-[11px]` ×5 |
| `mobile/pages/content/index.tsx` | `text-xs`, `text-[11px]` |
| `mobile/pages/android-terminal-panel/index.tsx` | `text-base` (h2), `text-xs`, `text-sm` |

---

## 2. COLOR INVENTORY (complete, counted, reproducible)

### 2.1 Non-semantic colour utilities — 40 occurrences across 8 distinct classes

```bash
grep -rhoE '\b(bg|text|border|ring|from|to|via|fill|stroke|divide|outline|shadow|caret|accent|placeholder|decoration)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(-[0-9]{2,3})?(/[0-9.]+|/\[[^]]*\])?' src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn
```

```
  16 bg-white/5
  10 bg-white
   6 bg-white/10
   2 text-white
   2 border-white/10
   2 bg-black/45
   1 border-white/5
   1 bg-white/[0.03]
```

Total **40 occurrences / 8 distinct tokens**. Verified absent:
* `grep` for `-(gray|slate|zinc|neutral|stone|blue|indigo|…)-[0-9]{2,3}` → **0 hits** (no Tailwind palette scale leaks in).
* `grep -rnoE '#[0-9a-fA-F]{3,8}\b' src --include=*.tsx --include=*.ts` → **0 hits** (no hex literals in code).
* `grep -rnoE '#[0-9a-fA-F]{3,8}\b' src --include=*.css index.html mobile.html` → **0 hits**.

### 2.2 Hardcoded light-mode colours that force a compensating `dark:` variant (F9)

Every one of the 40 above is paired with a `dark:` mirror, i.e. it is a light-mode literal plus a token-based dark patch instead of a single token:

| literal | `dark:` patch | representative location |
|---|---|---|
| `bg-white` ×10 | `dark:bg-background`, `dark:bg-content3`, `dark:bg-content1/40` | `src/pc/pages/index.tsx:127` (`bg-white dark:bg-background`), `:157` (`bg-white dark:bg-content3`), `ssl-service/index.tsx:222` (`bg-white dark:bg-content1/40`), `ca-install-guide.tsx:39,82,126`, `certificate-list.tsx:113`, `NginxConfigView.tsx:409,423`, `HostManagementView.tsx:430` |
| `bg-white/5` ×16 | paired with `hover:bg-content2` / `hover:bg-background` | `service-data-item.tsx:431`; `mongodb-service.tsx:1450,1631,1752,1867`; `mariadb-service/index.tsx:1040,1236,1352,1525`; `mysql-service/index.tsx:829,943,1555`; `postgresql-service/index.tsx:1070,1264,1377,1546` |
| `bg-white/10` ×6 | same pattern | `mongodb-service.tsx:1479`; `ssl-service/index.tsx:250`; `mariadb-service/index.tsx:1070`; `mysql-service/index.tsx:1345,1375`; `postgresql-service/index.tsx:1099` |
| `text-white` ×2 | `hover:text-foreground dark:hover:text-white` | `welcome-fragment.tsx:104,116` |
| `border-white/10` ×2, `border-white/5` ×1 | `group-hover:border-default dark:group-hover:border-white/10` | `welcome-fragment.tsx:224,374`; `VenvView.tsx:281` |
| `bg-white/[0.03]` ×1 | `dark:hover:bg-white/[0.03]` with `hover:bg-background` | `VenvView.tsx:281` (`border border-transparent hover:border-divider dark:hover:border-white/5`) |
| `bg-black/45` ×2 | none (scrim) — token `overlay` exists and is unused here | `src/mobile/pages/home/index.tsx:252,293` |

`overlay` **is** a token (`global.css:96,132`; `tailwind.config.js:65`) and `bg-overlay/40`, `/80`, `/30`, `/[0.02]` are used elsewhere (2 + 3 + 2 + 1 occurrences), so the mobile scrims at `home/index.tsx:252,293` are a plain deviation, not a missing token.

### 2.3 Dead token-scale classes — **1 remaining** (12 when the audit started; F5)

```bash
grep -rnE '\b(text|bg|border|ring|from|to|via|fill|stroke|divide|placeholder|outline|shadow)-(default|warning|success|danger|primary|focus|content1|content2|content3|content4)-[0-9]{2,3}\b' src --include=*.tsx --include=*.ts
```

```
ai-panel.tsx:554  text-warning-600
```

`grep -c 'warning-600' /tmp/envis-audit/out2.css` → `0`. The other 11 sites recorded at the start of the audit (`ai-panel.tsx:47,62,531,542,559,568,569,570,594,612` and `pages/index.tsx:158`) were replaced with `text-muted-foreground` by the concurrent refactor and now emit CSS. Only the status-strip label still renders at full-contrast `foreground` instead of amber.

### 2.4 Slash-alpha on token colours (works — recorded to close the question)

`bg-content1/40` ×141, `bg-warning/10` ×36, `bg-focus/10` ×35, `border-warning/30` ×33, `border-focus/30` ×27, `bg-danger/10` ×23, `bg-content2/30` ×20, `bg-warning/90` ×18, `bg-content2/50` ×14, and ~50 more distinct forms.

Verified in the fresh build that Tailwind 3.4 **does** emit valid CSS for these despite the `hsl(var(--x))` form:

```
.bg-content1\/95 { background-color: hsl(var(--content1) / .95); }
.bg-overlay\/40  { background-color: hsl(var(--overlay) / .4); }
```

So alpha modifiers on tokens are **not** a defect. (Worth noting only because the 141 `dark:bg-content1/40` uses are a workaround for `content1` being too close to `background` in dark mode — `n-12` on `n-9` — which is why they exist at all.)

---

## 3. ARBITRARY VALUE INVENTORY

```bash
# total bracket-value tokens
grep -rhoE '\b[a-z-]+-\[[^]"'"'"'` ]*\]' src --include=*.tsx --include=*.ts | wc -l          # 467
# Radix/group state variants (not "arbitrary values" in the design sense)
grep -rhoE 'data-\[[^]"'"'"'` ]*\]'  src --include=*.tsx --include=*.ts | wc -l            # 235
grep -rhoE 'group-\[[^]"'"'"'` ]*\]' src --include=*.tsx --include=*.ts | wc -l            # 18
# genuine arbitrary-value utilities
grep -rhoE '\b[a-z-]+-\[[^]"'"'"'` ]*\]' src --include=*.tsx --include=*.ts | grep -vE '^(data|group)-' | sort | uniq -c | sort -rn   # 214
```

**467 bracket tokens total; 253 are `data-*`/`group-*` state variants; 214 are genuine arbitrary values.**

### 3.1 Complete list of the 214 genuine arbitrary values

```
 97 text-[10px]          6 min-w-[8rem]            3 text-[9px]        3 text-[0.8rem]
  2 translate-y-[2px]    2 translate-y-[-50%]      2 translate-x-[-50%] 2 top-[50%]
  2 slide-out-to-top-[48%] 2 slide-in-from-top-[48%] 2 pr-[4px]        2 pl-[10px]
  2 p-[1px]              2 max-w-[80%]             2 left-[50%]        2 h-[500px]
  1 z-[100]  1 z-[1]  1 w-[var(--radix-navigation-menu-viewport-width)]  1 w-[calc(100%-8px)]
  1 w-[22px] 1 w-[1px] 1 w-[100px] 1 w-[1000px] 1 translate-y-[-3px]
  1 translate-x-[var(--radix-toast-swipe-move-x)] 1 translate-x-[var(--radix-toast-swipe-end-x)]
  1 top-[60%] 1 top-[1px] 1 top-[-20%] 1 text-[15px] 1 text-[12px]
  1 rounded-t-[6px] 1 rounded-[inherit] 1 right-[4px] 1 pt-[77px] 1 pr-[6px]
  1 p-[15px] 1 p-[10px] 1 ml-[74px]
  1 min-w-[var(--radix-select-trigger-width)] 1 min-w-[64px] 1 min-w-[140px] 1 min-w-[12rem]
  1 min-h-[80px] 1 min-h-[60px]
  1 max-w-[640px] 1 max-w-[625px] 1 max-w-[420px] 1 max-w-[200px]
  1 max-h-[90vh] 1 max-h-[400px] 1 max-h-[300px] 1 max-h-[260px] 1 max-h-[200px]
  1 h-[var(--radix-select-trigger-height)] 1 h-[var(--radix-navigation-menu-viewport-height)]
  1 h-[38px] 1 h-[32px] 1 h-[22px] 1 h-[1px] 1 blur-[120px]
  1 bg-[size:24px_24px]
  1 bg-[linear-gradient(to_right,hsl(var(--default)/0.07)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--default)/0.07)_1px,transparent_1px)]
```

### 3.2 In-scope arbitrary values

| location | literal |
|---|---|
| `ai-panel.tsx:535` | `text-[15px]` — panel title, between `text-sm` (13) and `text-lg` (18); off the scale |
| `ai-panel.tsx:582` | `max-w-[80%]` — user bubble |
| `ai-panel.tsx:605` | `max-w-[80%]` — assistant/typing bubble |
| `ai-panel.tsx:647` | `min-h-[80px] max-h-[200px]` — textarea (see F17) |
| `log-panel.tsx:43` | `min-w-[64px]` — timestamp gutter |
| `log-panel.tsx:57` | `ml-[74px]` — meta indent, hard-tied to `min-w-[64px]` + `gap-2` + `pl-2` |
| `log-panel.tsx:58` | `text-[11px]` + `max-h-32` |
| `log-panel.tsx:278-338` | `text-[11px]` ×12 |
| `mobile/App.tsx:57` | `text-[11px]` — debug banner |
| `mobile/pages/home/index.tsx:142,207,213,224,238` | `text-[11px]` ×5 |
| `mobile/pages/content/index.tsx:95` | `text-[11px]` |

### 3.3 Off-scale radii (design language: 6 / 8 / 10 / 12 / 16 only)

```bash
grep -rhoE '\brounded(-[a-z0-9]+)?\b' src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn
```

```
  91 rounded-lg      (var(--radius-lg) = 10px)
  66 rounded-md      (var(--radius-md) = 8px)
  61 rounded         ← 0.25rem = 4px, NOT in the declared scale
  60 rounded-xl      (12px)
  48 rounded-full    (9999px)
  31 rounded-sm      (6px)
  13 rounded-2xl     (16px)
   5 rounded-r  4 rounded-l  2 rounded-t  1 rounded-tl  1 rounded-b
```

`rounded` (4 px) is a real off-scale step used **61 times**, 18 of them in `log-panel.tsx` (the single worst file). `rounded-[inherit]` and `rounded-t-[6px]` add 2 more arbitrary radii.

### 3.4 z-index scale

```bash
grep -rhoE '\bz-\[?[0-9]+\]?' src --include=*.tsx | sort | uniq -c | sort -rn
```
`z-50` 23 · `z-10` 7 · `z-30` 2 · `z-40` 1 · `z-20` 1 · `z-100` **1 (emits nothing — F12)** · `z-[100]` 1 · `z-[1]` 1 · `z-0` 1.

---

## 4. A11Y

### 4.1 Focus-visible coverage (e)

```bash
grep -rn 'focus-visible' src --include=*.tsx | wc -l                                  # 23
grep -rn 'focus-visible' src --include=*.tsx | awk -F: '{print $1}' | sort | uniq -c  # 13 files
grep -rho 'outline-none' src --include=*.tsx | wc -l                                  # 58
grep -rhoE '\bfocus:[^ "'"'"'`]+' src --include=*.tsx | sort | uniq -c | sort -rn
```

`focus-visible:` appears **23 times across 13 files** — `settings-dialog.tsx` ×9, `ai-panel.tsx` ×2, `components/ui/{tabs,toggle,textarea,switch,slider,resizable,radio-group,input,checkbox,button}.tsx` ×1 each, `mongodb-service.tsx` ×1.

By contrast: 58 `outline-none`, and 73 plain `focus:` utilities, of which the largest are `focus:bg-content2` ×15, `focus:text-foreground` ×14, `focus:outline-none` ×8, `focus:border-primary` ×7, `focus:border-focus` ×7.

**What has a ring:**
* Every `<Button>` — `button.tsx:8`: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2`.
* `<Textarea>` — `textarea.tsx:12`: `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring`.
* `<Input>`, `<Checkbox>`, `<Switch>`, `<Slider>`, `<RadioGroup>`, `<Resizable>`, `<Toggle>`, `<Tabs>` (1 each).

**What does not:**
* **`<Input>` loses its indicator by design**: `input.tsx:13` = `placeholder:text-muted-foreground focus-visible:outline-none focus:border-divider` — the focused border colour is *the same token as the resting border*, so the ring-less Input has no visible focus change. (`ai-panel.tsx:647` patches the textarea's border with `focus:border-primary` on top of the base ring, producing two competing indicators.)
* **All 14 mobile `<button>`s** — `home/index.tsx:146,155,165,190,198,212,227,272,283,327,334` (11), `content/index.tsx:85,100` (2), `android-terminal-panel/index.tsx:90` (1) — carry no authored focus style. They keep the UA default ring (no `outline-none`), but it is unstyled and not on the token `focus` colour.
* **All 3 mobile `<input>`s** — `home/index.tsx:257,263,298,304,311,318` and `android-terminal-panel/index.tsx:85` — use `outline-none focus:border-focus`. This is a *border* change only (1 px at the token blue), not a ring; and `focus:` fires on mouse click, not just keyboard.
* **`log-panel.tsx:47`** group-expand button — no focus class (relies on UA).
* **Non-focusable interactive elements**: `log-panel.tsx:190-197` drag-to-resize `<div onMouseDown>` with `cursor-ns-resize` — mouse-only, not in the tab order, no `role="separator"`/`aria-label`/keyboard handler (F27).

### 4.2 Ring offset colour is white in dark mode (F10)

`button.tsx:8` uses `focus-visible:ring-offset-2` but never sets a ring-offset colour, and Tailwind's default is white. Verified in the fresh build:

```
 25:  --tw-ring-offset-color: #fff;
 79:  --tw-ring-offset-color: #fff;
```

In dark mode every focused button therefore gets a 2 px **white** halo, which does not exist in the token set (`global.css` has no ring-offset token, and `tailwind.config.js:20-69` does not map one).

### 4.3 Icon-only buttons with no accessible name (f)

Method: a purpose-written read-only JSX scanner extracted every `<Button>`, `<button>` and `<a>`, stripped tags and balanced `{…}` groups, and flagged elements with **no literal text**, **no `{t(…)}`/string expression**, **no `aria-label`/`aria-labelledby`/`title`**, and **no `sr-only`**. Script: `/tmp/envis-audit/scan3.py` + refinement (56 results).

Baseline: `sr-only` ×6, `aria-label` ×7 in the entire `src/`, vs 56 icon-only/nameless controls.

**In-scope, verified by reading the source — these are certain:**

| element | literal code | why unnamed |
|---|---|---|
| AI panel close | `ai-panel.tsx:527-534` — `<Button onClick={onClose} size="sm" variant="ghost" className="h-7 text-default-500 …"><X className="h-4 w-4" /></Button>` | no `aria-label`, no `title`, no `sr-only`; its sibling at `:538-547` **does** set `title`, proving the pattern was known |
| AI panel `MarkdownMessage` link | `ai-panel.tsx:51-58` — `<a {...props} className="text-primary hover:underline" …/>` | name comes only from the markdown source (acceptable), but it has **no focus-visible ring and no `sr-only` "opens in new window"** despite `target="_blank"` |
| Mobile host expand/collapse | `home/index.tsx:190-196` — `<button className="rounded p-1 text-muted-foreground hover:bg-content2" onClick={…}>{expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>` | no name, no `aria-expanded`, no `aria-controls`; 24×24 px |
| Log panel drag handle | `log-panel.tsx:190-197` — `<div className={cn('flex items-center justify-between px-2 py-1 border-b select-none','cursor-ns-resize')} onMouseDown={onHeaderMouseDown} title={t('log_panel.drag_resize')}>` | has a `title`, but is a non-focusable `<div>`, so the resize is unreachable by keyboard (F27) |

**Repo-wide (machine-assisted, 56 hits)** — the largest clusters, all outside my scope but reported because the sweep is cross-cutting:

```
7  src/pc/pages/env-panel/service-data-panel/ssl-service/certificate-list.tsx   (142,200,208,228,236,256,264)
6  src/pc/pages/env-panel/service-data-panel/ssl-service/ca-install-guide.tsx    (47,63,90,106,135,152)
6  src/pc/pages/env-panel/service-data-panel/mongodb-service.tsx                 (1269,1283,1307,1321,1802,1916)
3  src/pc/pages/env-panel/service-data-panel/services-dashboard.tsx              (248,262,276)
3  src/pc/pages/env-panel/service-data-panel/python-service/VenvView.tsx         (209,292,303)
3  src/pc/pages/env-panel/service-data-panel/custom-service/ProjectDirectoryView.tsx (209,224,239)
2  ai-panel.tsx (527, and the link at 52) · 2 nav-bar.tsx (624,634) · 2 welcome-fragment.tsx (97,109)
2  mariadb-service/index.tsx · 2 mysql-service/index.tsx · 2 postgresql-service/index.tsx
2  host-service/HostManagementView.tsx (464,474) · 2 nodejs-service/index.tsx (404,416)
1  each: nav-bar/settings-dialog.tsx:112, nav-bar-item.tsx:149, java-service.tsx:654,
   rust-service.tsx:98, issue-certificate-dialog.tsx:139, app-footer.tsx:20,
   service-data-list.tsx:154, service-data-item.tsx:582, pagination.tsx:35,
   custom-service/{AliasesConfigView.tsx:234, EnvironmentVariablesView.tsx:192, PathConfigView.tsx:161}
```

Caveat, stated for honesty: the scanner counts *literal* text and `{t(…)}`-style expressions; a button whose only child is a bare identifier expression (e.g. `{title}`) is excluded, so the true count is at least these 56 and the four in-scope items above are hand-verified.

### 4.4 `dark:` variant usage (d)

```bash
grep -rhoE 'dark:[^ "'"'"'`]+' src --include=*.tsx --include=*.ts | wc -l     # 597 occurrences
grep -rhoE 'dark:[^ "'"'"'`]+' src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn
grep -rc 'dark:' src --include=*.tsx --include=*.ts | grep -v ':0$'            # lines-with-dark per file
```

**597 `dark:` occurrences** (per-line counts: `welcome-fragment.tsx` 66, `mongodb-service.tsx` 41, `postgresql/mysql/mariadb-service` 35 each, `java-service.tsx` 35, **`mobile/pages/home/index.tsx` 29**, `nodejs-service` 22, `settings-dialog.tsx` 16, `redis-service` 16, `system-monitor.tsx` 13, …).

Top targets:

```
141 dark:bg-content1/40      48 dark:text-muted-foreground   41 dark:text-warning
 30 dark:text-foreground     28 dark:text-focus              24 dark:border-divider
 24 dark:bg-content3         17 dark:bg-warning/10           16 dark:hover:bg-white/5
 15 dark:text-primary-foreground  15 dark:border-warning/30  15 dark:bg-content2
  6 dark:hover:bg-white/10    2 dark:hover:text-white         2 dark:group-hover:border-white/10
  2 dark:hover:bg-white/[0.03] 1 dark:hover:border-white/5
```

**Categorisation:**

**(i) Compensating for a hardcoded light-mode colour — defective (F9), 40 occurrences.** All the `bg-white*` / `text-white` / `border-white*` / `bg-black/45` pairs listed in §2.2. These exist *only* because a raw literal was written instead of a token. Concrete proof that this is not a "genuine token need": `src/pc/pages/index.tsx:127` writes `bg-white dark:bg-background` on a panel whose token for the same surface (`bg-content1`) already resolves to near-white in light and `n-12` in dark — one token, no variant.

**(ii) Compensating for the surface scale — hacky but explained, 141+24 occurrences.** `dark:bg-content1/40` (141) and `dark:bg-content3` (24) appear because the light value (`content1` = `n-100` pure white) is far from `background` (`n-98`) while the dark value (`content1` = `n-12`) is close to `background` (`n-9`). The author patched this per-instance instead of adding a step. Example: `mongodb-service.tsx:1144` `bg-content1 dark:bg-content1/40`.

**(iii) Pure redundancy — 476 occurrences.** A token that already redeclares itself under `.dark` gains nothing from a `dark:` twin. Verified by the token table in `global.css:99-133`: `--foreground`, `--muted-foreground`, `--warning`, `--success`, `--danger`, `--focus`, `--divider`, `--border`, `--background`, `--content1..4`, `--primary` all change value under `.dark`. Counting the `dark:` targets that name exactly those tokens:

```bash
grep -rhoE 'dark:[^ "'"'"'`]+' src --include=*.tsx --include=*.ts \
 | grep -E '^dark:(text|border|bg)-(foreground|muted-foreground|warning|success|danger|focus|divider|background|content1|content2|content3|content4|primary)(/[0-9]+)?$' | wc -l
# → 476        (597 total dark: occurrences → 121 that are not pure redundancy)
```

Literal example of the anti-pattern (`welcome-fragment.tsx:489`): `text-warning hover:text-warning dark:text-warning dark:hover:text-warning` — four declarations where two suffice, and the light/dark pair is identical by construction.

### 4.5 Focus-visible: which interactive elements have one, which do not

See §4.1 for the data. Summary table:

| element | has ring? | evidence |
|---|---|---|
| `<Button>` (all Radix/PC buttons) | ✅ `ring-2 ring-focus` | `button.tsx:8` |
| `<Input>` | ⚠️ ring removed, replaced by `focus:border-divider` = resting colour | `input.tsx:13` |
| `<Textarea>` | ✅ `ring-1 ring-ring` | `textarea.tsx:12` |
| `<Checkbox>/<Switch>/<Slider>/<RadioGroup>/<Toggle>/<Tabs>/<Resizable>` | ✅ 1 each | component files |
| AI panel `<Textarea>` | ✅ base + conflicting `focus:border-primary` | `ai-panel.tsx:647` |
| AI panel send/interrupt `<Button>` | ✅ (restated inline, twice) | `ai-panel.tsx:654-657` |
| AI panel close `<Button>` | ✅ via base (but unnamed — F18) | `ai-panel.tsx:527` |
| `ai-panel.tsx:51` markdown `<a>` | ❌ no focus class at all | `ai-panel.tsx:52-57` |
| `log-panel.tsx:47` meta toggle | ❌ UA default only | `log-panel.tsx:47-53` |
| `log-panel.tsx` resize header | ❌ not focusable (mouse-only) | `log-panel.tsx:190-197` |
| all mobile `<button>` (14 sites) | ❌ UA default only | `mobile/**` — see §4.1 |
| all mobile `<input>` (7 sites) | ⚠️ `outline-none focus:border-focus` | `mobile/**` |

### 4.6 Animation / transition inventory (g)

```bash
grep -rhoE '\btransition(-[a-z]+)?\b' src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn
grep -rhoE '\bduration-[a-z0-9]+'     src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn
grep -rhoE '\bease-[a-z-]+'            src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn
grep -rhoE '\banimate-[a-z0-9-]+'      src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn
grep -rn 'prefers-reduced-motion' src tailwind.config.js index.html mobile.html      # → no matches
grep -rn 'motion-safe\|motion-reduce' src --include=*.tsx --include=*.ts             # → no matches
```

| property | counts |
|---|---|
| transition property | `transition-all` 66 · `transition-colors` 48 · `transition-transform` 6 · `transition` 6 · `transition-opacity` 3 · `transition-none` 1 |
| duration | `duration-250` 47 · `duration-200` 10 · `duration-300` 5 · `duration-500` 1 · `duration-150` 1 · `duration-1000` 1 · `duration-100` 1 |
| easing | `ease-in-out` 4 (the only easing token in use — 4 declarations for 130 transitions) |
| animation | `animate-spin` 61 · `animate-out` 20 · `animate-in` 20 · `animate-pulse` 3 · `animate-caret-blink` 1 (**undefined — F22**) · `animate-accordion-up` 1 · `animate-accordion-down` 1 |

**`prefers-reduced-motion` was respected nowhere when this audit began; the concurrent refactor added a global override** (`src/global.css:263-273`, `FIXED-IN-TREE`):

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important; animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important; scroll-behavior: auto !important;
  }
}
```

`motion-safe:` / `motion-reduce:` variants remain **0**, so the reduction is blanket rather than per-utility — acceptable, but it also means the `duration-250` / `duration-150` token intent is discarded wholesale under `reduce`.

Durations are otherwise disciplined: `duration-250` (a custom token, `tailwind.config.js`) is used 47 times and is the house default, and the refactor added `duration-400` + `transitionTimingFunction.standard` (`cubic-bezier(0.2,0,0,1)`). `ease-in-out` is declared in only 4 places, and `ease-standard` is currently used **0 times**, so the vast majority of transitions still run on Tailwind's default `cubic-bezier(0.4,0,0.2,1)`.

### 4.7 Mobile platform integration (checked explicitly)

Every one of these greps returns **nothing** over `src/mobile/**`, `mobile.html`, `index.html`, `src/global.css`:

```bash
grep -rn "safe-area\|viewport-fit\|visualViewport\|orientationchange\|100dvh\|-webkit-fill-available" …
grep -rn "inputMode\|autoComplete\|enterKeyHint\|autoCapitalize\|autoCorrect\|virtualkeyboard" src/mobile src/Loading.tsx
grep -rn "select-none\|tap-highlight\|touch-action\|overscroll" src/mobile src/global.css
grep -rn "onTouch\|pointerdown\|onPointer" src/mobile      # only hit: platform/adapter.ts:22 ('ontouchstart' in window)
```

`mobile.html:6` is verbatim:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

— no `viewport-fit=cover`, no `interactive-widget=resizes-content`, no `maximum-scale`. See F7 for the consequences.

---

## 5. i18n

`src/pc/i18n/config.ts` — `i18next` + `react-i18next` + `LanguageDetector`; resources `en` and `zh`; `fallbackLng: 'en'`; detection order `['navigator','htmlTag','path','subdomain']`, cached in `localStorage`. Only two locales exist.

### 5.1 Key completeness — PASS

```bash
python3 -c "…flatten both JSON files, diff leaf keys…"
```

* `en.json` — **1412** leaf keys
* `zh.json` — **1412** leaf keys
* keys in `en` missing from `zh` — **0**
* keys in `zh` missing from `en` — **0**

The two locale files are key-complete. 28 keys hold identical values in both, and all 28 are legitimately language-neutral technical terms (`JAVA_HOME`, `API Base URL`, `API Key`, `CPU`, `VIP`, `Discord`, `GitHub`, `-Xmx1024m -Xms512m`, `/path/to/maven`, `ENVIS_HOME`, …). No action needed.

### 5.2 Duplicate JSON keys — a real defect (F25)

Detected with `json.load(..., object_pairs_hook=…)`:

```
DUP src/pc/i18n/locales/en.json: 'welcome'                                  ← lines 530 and 645
DUP src/pc/i18n/locales/zh.json: 'advanced_options'  'use_prebuilt'  'compile_from_source'
```

```json
// src/pc/i18n/locales/en.json
530:  "welcome": {                       ← entirely shadowed, dead
531:    "github_star": "If you like Envis, give us a Star on GitHub",
...
645:  "welcome": {                       ← this one wins
646:    "github_star": "Star on GitHub",
```

```json
// src/pc/i18n/locales/zh.json:374-379
374:    "advanced_options": "高级选项",
375:    "use_prebuilt": "使用预编译包",
376:    "compile_from_source": "从源码编译",
377:    "advanced_options": "高级选项",      ← duplicate key in the same object
378:    "use_prebuilt": "使用预编译包",
379:    "compile_from_source": "从源码编译",
```

Because `JSON.parse` keeps the **last** value, `en.welcome.github_star` resolves to `"Star on GitHub"` and the block at 530-644 is unreachable. The key counts still match (1412/1412) precisely because both duplicates happen to carry the same key names — so a key-count check cannot detect this class of bug.

### 5.3 Hardcoded UI strings that bypass i18n

**Mobile has no i18n wiring at all:**

```bash
grep -rn 'useTranslation\|i18n' src/mobile src/main-mobile.tsx      # → no matches
grep -rn 'i18n\|useTranslation' src/main-mobile.tsx                  # → no matches
```

`src/main-mobile.tsx:1-5` imports only React, ReactDOM, `global.css` and `MobileApp` — the mobile entry never initializes i18next.

CJK-in-JSX-text scan (`grep`-equivalent python over `src/**/*.tsx`, excluding comments and `i18n/locales`), counting only **literal JSX text or hardcoded attributes**:

```
TOTAL CJK-containing source lines: 962
JSX literal text / hardcoded attribute: 49
```

| file | count | lines |
|---|---|---|
| `env-panel/service-data-panel/host-service/HostManagementView.tsx` | 14 | 421,422,455,503,508,513,518,523,528,538,542,554,561,572 |
| **`mobile/pages/home/index.tsx`** | **14** | 180,181,224,238,254,255,261,268,295,296,302,308,316,322 |
| `env-panel/.../nginx-service/NginxConfigView.tsx` | 7 | 362,370,380,390,400,447,448 |
| `env-panel/.../dnsmasq-service/DnsmasqConfigView.tsx` | 4 | 170,235,241,248 |
| `env-panel/.../mariadb-service/index.tsx` | 3 | 1206,1538,1550 |
| `env-panel/.../mongodb-service.tsx` | 2 | 141,1240 |
| **`mobile/pages/content/index.tsx`** | **2** | 90,108 |
| `env-panel/.../ssl-service/certificate-list.tsx` | 1 | 136 |
| `nav-bar/settings-dialog.tsx` | 1 | 30 |
| `pc/pages/ai-panel/ai-panel.tsx` | 1 | 132 (inside a `//` -less inline comment on a code line — scanning artifact, not UI text) |

Literal mobile examples:

* `mobile/pages/home/index.tsx:152` — `退出`
* `mobile/pages/home/index.tsx:161` — `登录`
* `mobile/pages/home/index.tsx:171` — `添加`
* `mobile/pages/home/index.tsx:180` — `<p className="text-sm text-foreground dark:text-foreground">还没有主机，先点击右上角添加</p>`
* `mobile/pages/home/index.tsx:217` — `连接`
* `mobile/pages/home/index.tsx:238` — `<span className="text-[11px] text-muted-foreground dark:text-muted-foreground">进入环境</span>`
* `mobile/pages/home/index.tsx:254` — `<h3 className="text-sm font-semibold">账号登录</h3>`
* `mobile/pages/home/index.tsx:283,334` — `登录` / `保存`
* `mobile/pages/home/index.tsx:302` — `placeholder="主机名称，例如 我的办公机"`
* `mobile/pages/content/index.tsx:90` — `<ArrowLeft className="h-3.5 w-3.5" /> 返回`
* `mobile/pages/content/index.tsx:108` — `<RefreshCw className="h-3.5 w-3.5" /> 状态`

**Not counted above but also user-facing and hardcoded** (they are inside `{…}`, i.e. `toast.*`/`throw new Error` arguments):
`mobile/api/auth.ts:16` `throw new Error('账号和密码不能为空')`; `mobile/api/environment.ts:54` `'环境名不能为空'` and `:82` `'目标环境在桌面端不存在'`; `mobile/pages/home/index.tsx:117` `setAddError('请填写完整的主机信息')`; `mobile/pages/content/index.tsx:42,44` (`已进入环境 …` / `环境 … 不可用，已降级为普通 SSH 连接`); `mobile/hooks/useMobileHome.ts:23,30` seed host names `'办公主机'` / `'实验主机'`.

**Hardcoded English in mobile** (not caught by the CJK scan): `mobile/App.tsx:58` `Mobile platform: {platform.platform} | Touch: {platform.isTouchDevice ? 'yes' : 'no'}`; `android-terminal-panel/index.tsx:43` `Android SSH Terminal`; `:45` `Session ID:`; `:59` `No terminal output yet.`; `:88` `placeholder="Type command and press Enter"`; `:95` `Send`; `home/index.tsx:46` `` `${props.hosts.length} hosts` ``.

**AI panel hardcoded Chinese that reaches the user**: the system prompt and its injected Chinese notices are literals — `ai-panel.tsx:243`, `:261` `'…[内容过长，中间部分已省略]…'`, `:272`, `:284` — plus the raw error strings at `:321` `API请求失败: …`, `:330` `AI返回了空响应`, `:343` `无法获取响应流`. The error text is then interpolated into the translated `ai_panel.error_message` template, so the UI shows a translated wrapper around an untranslated Chinese payload.

`log-panel.tsx` hardcodes English identifiers into the State tab: `appSettings` (`:278`), `selectedEnvironmentId` (`:298`), `environmentsCount` (`:299`), `selectedServiceDataId` (`:311`), `selectedEnvServDatasCount` (`:312`), `isAIPanelOpen` (`:324`), `isAIResponseLoading` (`:325`), `chatMessagesCount` (`:326`), `logEntriesCount` (`:337`), `autoScroll` (`:338`), and `Log (` at `:334` (concatenated with `t('log_panel.meta_info')` but the word `Log` itself is a literal).

---

## 6. Findings — mobile dark subtree (report item 1)

### F3 — Mobile is *not* a permanently-dark subtree; only the terminal panel is `P1`

**Claim in the brief:** "The mobile terminal is a permanently-dark subtree that mounts a `dark` class on its own root so it can redeclare the tokens."
**Verified result:** only the *second half* is true, and only for one component.

`src/mobile/pages/android-terminal-panel/index.tsx:37-39`:

```tsx
  // 恒定深色子树：根挂 dark 类（global.css 的 .dark 是普通类选择器，子树上重声明变量生效）
  return (
    <div className="dark h-full w-full bg-background text-foreground flex flex-col">
```

That is the **only** `dark` class mount in `src/mobile/**`:

```bash
grep -rn 'className="dark\|"dark \| dark"' src/mobile/src 2>/dev/null   # → 1 hit, the line above
grep -rn 'classList.add' src/mobile src/main-mobile.tsx src/theme.ts    # → only src/theme.ts
```

The shell does **not** force dark. `src/mobile/App.tsx:14-17`:

```tsx
  // 跟随系统主题（激活全局 dark: 变体）
  useEffect(() => {
    setAppTheme('system')
  }, [])
```

and `src/theme.ts:19-30` writes the class onto `<html>`, choosing `light` when the OS prefers light:

```ts
    if (theme === 'system') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const systemTheme = mediaQuery.matches ? 'dark' : 'light'
        root.classList.add(systemTheme)
```

`mobile.html` ships `<html lang="en">` with no class, and `main-mobile.tsx` adds none.

**Consequences on a light-mode device (the common case):**

1. `src/mobile/App.tsx:55-62` — the shell and its wrapper use `bg-background`, `bg-content1`, `border-divider` with `dark:*` twins that never fire: `<div className="fixed inset-0 overflow-hidden bg-background text-foreground dark:bg-background dark:text-foreground">` and `<div className="h-full overflow-hidden rounded-2xl border border-divider bg-content1  dark:border-divider dark:bg-background">`. Under `:root` those resolve to `n-98` / `n-100` — a **white** mobile chrome.
2. `src/mobile/pages/content/index.tsx:84` — the terminal page header is `bg-content1/95 dark:bg-content2/95` → near-white header, at the same time as
3. `src/mobile/pages/content/index.tsx:113` → `rounded-2xl border border-divider bg-content1 dark:border-divider dark:bg-background`, which contains `AndroidTerminalPanel`, whose own root (line 39) declares `dark` → `bg-background` = `n-9`.
4. The result is a **near-white header strip above a permanently dark terminal pane** on a light-mode phone, and a light-mode Home screen, i.e. the mobile build renders in whatever the OS theme is while the terminal stays dark. This is a hard seam, not a designed state.

**Which `dark:` variants inside `src/mobile/**` would break?** Inside the terminal panel's own `dark` subtree, descendant `dark:` variants *do* apply (Tailwind 3.4 emits `.dark\:X:is(.dark *)`, a *descendant* selector — verified in the fresh build: `.dark\:bg-content1:is(.dark *)`). `android-terminal-panel/index.tsx` contains no `dark:` variants, so nothing inside it breaks. The 29 `dark:` variants in `home/index.tsx`, 7 in `content/index.tsx` and 6 in `App.tsx` are the ones that silently no-op in light mode — and they are exactly the ones doing the light→dark surface patching (`dark:bg-content2`, `dark:bg-content2/95`, `dark:hover:bg-content2`), so in light mode those components lose their intended hover/pressed contrast as well.

**Note on the `.dark` mechanism itself:** the plain-class requirement from `global.css:58-59` is respected (`global.css:99` and `:180` are `.dark`, not `html.dark`), and the terminal's subtree override works. The defect is the *missing* mount on the mobile shell, not the mechanism.

---

## 7. Findings — AI panel (report item 2)

**Answers to each question, with evidence.**

| question | answer | evidence |
|---|---|---|
| Message bubble surfaces — which content step? | Panel = `content1`; **both** assistant and typing bubbles = `content2`; user bubble = `primary`. `content2` is the *control-fill* step, not a message surface; `content3`/`content4` are unused. | root `ai-panel.tsx:523` `bg-content1`; assistant `:584` `bg-content2 text-foreground`, typing `:605`, loading `:621`; user `:583` `bg-primary text-primary-foreground` |
| User vs assistant differentiation — colour-only? | **No** — it is colour **and** alignment (`justify-end` vs `justify-start`), so it survives greyscale. But the light-mode contrast between `content1` (`n-100`) and `content2` (`n-96`) is only 4 % lightness, so the assistant bubble is nearly invisible against its own panel. | `:579` `${message.role === 'user' ? 'justify-end' : 'justify-start'}`; `:583-584` |
| Markdown typography — defined prose scale or arbitrary? | **Neither.** There is no prose scale at all: the plugin is missing so every `prose*` class is dead, and no substitute scale exists. Headings/code/blockquote fall back to browser defaults. | F2, `grep -c prose /tmp/envis-audit/out2.css` → `0` |
| Code block styling | **None.** No highlight.js theme CSS is imported (`grep -rn hljs src` → 0), and the only intended styling is on dead `prose-pre:*` variants; `rehypeHighlight` still emits `hljs-*` spans, which are colourless. | F4 |
| Streaming / typing indicator | Present and reasonable: pulsing block caret + `animate-pulse` label, plus a separate `animate-spin` row when `isLoading && !typingMessage`. The status strip is `bg-warning/10` with a pulsing `bg-warning` dot. **But** its label colour is dead (`text-warning-600`) so only the dot is amber. | `:552-562` (strip), `:608-610` (caret), `:619-628` (spinner) |
| Scroll-to-bottom affordance | **None.** `scrollToBottom()` is called on send and on each chunk and is gated on `userHasScrolledRef`; once the user scrolls up, auto-scroll stops permanently until they scroll back to within 5 px of the bottom. There is no "jump to latest" button and no new-message badge. | `:95-96` (`userHasScrolledRef`), `:120-125`, `:128-144`, `:233`, `:383-385` |
| Input area — auto-resize, enter-to-send discoverability, disabled while streaming | **No auto-resize** (`resize-none`, fixed `rows={3}`, `min-h-[80px]`, `max-h-[200px]` that can never be reached). Enter-to-send exists and correctly respects IME composition; Shift+Enter for newline is discoverable only from the placeholder text. Disabled state is correct: `disabled={!isAIReady || isLoading}` and the send button flips to an interrupt button. | `:638-649`, `:491-499`, `:646`, `:650-665` |
| Copy / regenerate affordances | **Both absent.** No copy control anywhere in the panel, no regenerate, no per-message actions. The only copy affordance in the app is the log panel's `copyAll`. | `grep -n "copy\|Copy\|regenerate" ai-panel.tsx` → only `Copy`-free hits (`scrollToBottom`) |
| Empty state | Present and translated (`Bot` icon + title + description), gated on `chatMessages.length === 0`. But the icon colour is dead (`text-default-300`) so it renders at full `foreground` weight, and it is **not** gated on `isLoading`, so a cleared-and-restarted conversation can show the empty state under the spinner. | `:566-573` |
| Error state | **Indistinguishable from a normal answer**: the error is pushed as an ordinary `role:'assistant'` message (`:470-473`) and rendered with the same `bg-content2` bubble, no danger colour, no icon, no retry. A toast also fires, but the persistent record looks like an answer. The interpolated payload is raw Chinese (`:321,330,343`). | `:457-475` |
| Long-message overflow | User bubble has `break-words`; **assistant bubble does not** — it is `whitespace-pre-wrap` with no `overflow-wrap`, so a long unbroken token (URL, hash, path) in AI output overflows the `max-w-[80%]` box. | `:587` vs `:591` |
| Code block horizontal scroll | **Broken.** The only scroll affordance is `prose-pre:overflow-x-auto` (`:47`), which is dead; there is no non-variant `overflow-x-auto` on any code element. | F4 |

### F2 — Markdown has no typography scale at all `P0`

`src/pc/pages/ai-panel/ai-panel.tsx:45-47`:

```tsx
function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:my-2 prose-p:text-foreground prose-pre:my-2 prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:bg-content3 prose-pre:p-3 prose-code:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-blockquote:text-default-600 dark:prose-invert">
```

15 typography-plugin classes, and `dark:prose-invert` (the 16th). The plugin is not installed:

```bash
grep -n 'typography' package.json tailwind.config.js     # → no matches
sed -n '108p' tailwind.config.js                          # → plugins: [require('tailwindcss-animate')]
grep -c 'prose' /tmp/envis-audit/out2.css                  # → 0
grep -oE '\.prose[^ ,{]*' /tmp/envis-audit/out2.css | sort -u   # → (empty)
```

The class names that *are* valid (`prose`, `prose-sm`, `max-w-none`) either do nothing without the plugin or collapse to a single `max-width: none`. Only `max-w-none` has any effect. Consequently `prose-p:my-2`, `prose-pre:bg-content3`, `prose-pre:p-3`, `prose-pre:rounded-lg`, `prose-code:text-foreground`, `prose-headings:text-foreground`, `prose-blockquote:text-default-600` and `prose-strong:text-foreground` are **all** no-ops, and the explicit `blockquote` override at `:59-64` and `a` override at `:51-58` are the only markdown element styling that actually reaches the DOM (`text-default-600` there is also dead — see F5).

### F4 — AI code blocks are unstyled and cannot scroll horizontally `P1`

Two independent causes:

1. `rehype-highlight` (`ai-panel.tsx:13,49`) emits `hljs-keyword`/`hljs-string`/… spans, but **no highlight.js stylesheet is shipped**:
   ```bash
   grep -rn "highlight" src/main.tsx src/pc/App.tsx src/pc/pages/index.tsx   # → only the package.json dep
   grep -rn "hljs" src --include=*.tsx --include=*.ts --include=*.css         # → 0 hits
   ```
   So syntax highlighting produces uncoloured text.
2. The only background/padding/radius/scroll for `pre` lives on dead `prose-pre:*` variants (F2), so `<pre>` keeps the UA default (monospace, no background, no padding, no radius, `white-space: pre`) — long code lines neither wrap nor scroll, they overflow the `max-w-[80%]` bubble.

### F5 — dead token-scale classes: 11 of 12 fixed mid-audit; 1 remains `P2`

When the audit started, 12 declarations referenced a `default-*` / `warning-*` scale that does not exist and therefore emitted **zero** CSS. The concurrent refactor replaced 11 of them with `text-muted-foreground`. What those 11 *were* doing (recorded so the visual regressions they caused are understood, and so the last one is fixed the same way):

* `ai-panel.tsx:594` and `:612` — message timestamps were `text-default-500`, so they inherited `foreground` at full contrast; the intended secondary-text hierarchy was gone. **Now** `text-muted-foreground` — correct.
* `ai-panel.tsx:559` — the `Press Esc…` hint was `text-default-400` → full-contrast `foreground`, reading as loudly as the status label. **Now** `text-muted-foreground`.
* `ai-panel.tsx:568` — the empty-state `Bot` icon was `text-default-300` → rendered at full `foreground`, so the intended three-level hierarchy (icon < heading < body) collapsed to one level. **Now** `text-muted-foreground`.
* `ai-panel.tsx:531,542` — the header close and clear buttons were `text-default-500` → full `foreground` icons. **Now** `text-muted-foreground`.
* `ai-panel.tsx:62` — the custom blockquote's `text-default-600`. **Now** `text-muted-foreground`.
* `src/pc/pages/index.tsx:158` — the Suspense fallback for the lazily-loaded AI panel used `text-default-400`. **Now** `text-muted-foreground`.

**The one that is still broken:**

```tsx
// src/pc/pages/ai-panel/ai-panel.tsx:552-560
      {(isLoading || typingMessage) && (
        <div className="px-4 py-2 bg-warning/10 border-b border-divider">
          <div className="flex items-center space-x-2 text-xs text-warning-600">
            <div className="animate-pulse w-2 h-2 bg-warning rounded-full"></div>
            <span>
              {isLoading && !typingMessage ? t('ai_panel.ai_thinking') : t('ai_panel.ai_replying')}
            </span>
            <span className="text-muted-foreground">{t('ai_panel.press_esc')}</span>
          </div>
        </div>
      )}
```

`grep -c 'warning-600' /tmp/envis-audit/out2.css` → `0`, so `text-warning-600` on line 554 emits nothing and the strip's label inherits full-contrast `foreground` while its sibling dot (`bg-warning`) and the now-correct `text-muted-foreground` hint are both tokenised. The fix is `text-warning` (which already resolves to the dark-appropriate `--c-amber-d` under `.dark`).

### F11 — No copy / regenerate / scroll-to-bottom / ARIA `P1`

```bash
grep -n "copy\|Copy\|Regenerate\|regenerate\|scrollToBottom\|aria-\|role=" src/pc/pages/ai-panel/ai-panel.tsx
120:  const scrollToBottom = () => {
233:    scrollToBottom()
384:          scrollToBottom()
```

Zero `aria-*`, zero `role=`, zero copy/regenerate. The scroll logic at `:95-96,120-144` deliberately parks auto-scroll when the user scrolls up, and there is no counter-affordance, so a long answer that the user scrolls back through never re-follows and the user gets no indication that new content arrived below the fold.

---

## 8. Findings — mobile specifics (report item 3)

### F6 — Every touch target is below 44×44 `P1`

Computed from the Tailwind metrics in the fresh build (`py-1.5`=6 px, `py-1`=4 px, `py-2`=8 px, `p-1`=4 px, `h-3.5`=14 px, `h-4`=16 px, `text-xs` line-height 16 px, `text-sm` line-height 20 px, `text-[11px]` inherits unitless 1.5 → 16.5 px):

| control | literal classes | computed size |
|---|---|---|
| `退出` / `登录` / `添加` buttons | `home/index.tsx:147,156,166` — `px-3 py-1.5 text-xs` + `h-3.5 w-3.5` icon | **≈ 28 px** tall |
| host expand/collapse toggle | `home/index.tsx:191` — `rounded p-1` + `h-4 w-4` | **24 × 24** |
| `连接` button | `home/index.tsx:213` — `px-2 py-1 text-[11px]` | **≈ 25 px** tall |
| host-name button | `home/index.tsx:199-205` — `flex-1 text-left`, `text-sm` + `text-[11px]` | ≈ 36 px (full width) |
| environment row button | `home/index.tsx:229` — `px-3 py-2 text-sm` | ≈ 36 px |
| dialog `取消` / `登录` / `保存` | `home/index.tsx:273,283,328,334` — `px-3 py-1.5 text-xs` | **≈ 28 px** |
| `返回` / `状态` | `content/index.tsx:88,106` — `px-2 py-1 text-xs` + `h-3.5` icon | **≈ 24 px** |
| terminal command `<input>` | `android-terminal-panel/index.tsx:85` — `px-3 py-2 font-mono text-sm` | ≈ 36 px |
| terminal `Send` | `android-terminal-panel/index.tsx:92` — `px-4 py-2 text-sm` | ≈ 36 px |
| login/add `<input>`s | `home/index.tsx:258,264,299,305,312,319` — `px-3 py-2 text-sm` | ≈ 36 px |

Zero controls reach 44 px. The smallest (`连接` ≈ 25 px, `返回`/`状态` ≈ 24 px, chevron 24×24) are the primary actions of the mobile flow. The compare-and-confirm commands are: `grep -rnoE '(px|py)-[0-9.]+|h-[0-9.]+|w-[0-9.]+|p-[0-9.]+' src/mobile --include=*.tsx`.

### F7 — No safe-area, keyboard, or orientation handling `P1`

* **Safe area:** nothing. `mobile.html:6` lacks `viewport-fit=cover`, so even if the CSS existed the insets would be 0. `src/mobile/App.tsx:55` is `<div className="fixed inset-0 overflow-hidden …">` — content runs edge to edge under a notch/Dynamic Island and under the home indicator, and the terminal's `Send` button (`android-terminal-panel/index.tsx:82-98`, the bottom-most element) sits in the home-indicator gesture zone.
* **Keyboard avoidance:** nothing. The terminal `<input>` is at the bottom of a `h-full` flex column with `overflow-hidden`; with no `visualViewport` listener, no `100dvh`, and no `interactive-widget=resizes-content`, the Android/iOS soft keyboard either covers the input or leaves the layout at full height so the output pane cannot scroll to the caret.
* **Orientation:** nothing. No `orientationchange`/`matchMedia('(orientation:…)')` handler. In landscape the fixed-height column compresses output and input together with no recovery.
* **Soft-keyboard hints:** no `inputMode`, `enterKeyHint="send"`, `autoCapitalize="off"`, `autoCorrect="off"`, or `spellCheck={false}` anywhere in `src/mobile/**`. For a shell command field this is actively harmful: mobile keyboards will sentence-capitalise commands and autocorrect them, and there is no dedicated Send key on the keyboard. The form relies on `onSubmit` with the button also disabled when the field is empty (`android-terminal-panel/index.tsx:93`). Search `virtualkeyboard` → 0 hits.
* **Touch behaviour:** no `-webkit-tap-highlight-color`, `touch-action`, `overscroll-behavior`, or `user-select` control. `src/global.css` customises only `::-webkit-scrollbar` (which is a no-op on touch), so the terminal inherits double-tap zoom, rubber-band overscroll and long-press text selection on the output stream.
* **Terminal font size / line-height:** `font-mono text-xs leading-5` = **12 px on a 20 px line** for output (`:56`), but `text-sm` = **13 px** for the input (`:85`) — the two console surfaces disagree. 12 px monospace on a phone is well under the ~16 px that prevents iOS from zooming on input focus, and there is no font-size control or pinch-zoom handling. `formatTimestamp` also renders `toLocaleTimeString('zh-CN', { hour12: false })` (`:5-7`) — the only locale-pinned date call in mobile, and it pins **zh-CN** regardless of the device locale.
* **Virtual keyboard / accessory bar:** none — no accessory row (Tab / Ctrl / Esc / arrow keys), which means a mobile SSH client cannot send Ctrl-C or Tab at all; `useTerminalSession.sendCommand` only forwards a full line (`useTerminalSession.ts:109-117`).

### F27b — Mobile has drifted from the PC design language

It reuses the token vocabulary (`bg-background`, `bg-content1`, `text-muted-foreground`, `border-divider`, `text-focus`, `text-warning`, `text-success`, `text-danger`, `shadow-pop`) — that part is good. But:

| drift | evidence |
|---|---|
| Card radius is `rounded-2xl` (16 px) — the design language reserves 16 px for **panels and dialogs**, cards are 12 px | `home/index.tsx:179` (empty-state card), `:188` (host card), `:253` (login dialog), `:294` (add dialog); `App.tsx:62`; `content/index.tsx:113` |
| `rounded` (bare) = 4 px, off-scale, used for the chevron toggle | `home/index.tsx:191`; also `content/index.tsx` ×3, `android-terminal-panel/index.tsx` ×2 |
| `text-lg` (18 px) for the app title and `text-base` (16 px) for the terminal heading — no PC surface uses a heading larger than `text-lg` for a shell title | `home/index.tsx:140`; `android-terminal-panel/index.tsx:43` |
| Body copy at `text-xs` (12 px) and `text-[11px]` (×5) rather than the 13 px base | `home/index.tsx:141,142,147,156,166,181,207,213,224,238,255,270,273,283,296,325,328,334` |
| `bg-black/45` scrim instead of the `overlay` token | `home/index.tsx:252,293` |
| Backdrop blur only on the terminal header (`backdrop-blur`, no size) while PC uses `backdrop-blur-sm` / `backdropBlur.pop` | `android-terminal-panel/index.tsx:40` vs `Loading.tsx:2` (`backdrop-blur-sm`) |
| Debug/English strings in shipped UI | `App.tsx:57-59`, `home/index.tsx:46`, `android-terminal-panel/index.tsx:43,45,59,88,95` |

---

## 9. Findings — cross-cutting (report items 4 and 5)

**F1** (`FIXED-IN-TREE`), **F5** (1 surviving dead class), **F8** (mobile i18n), **F9** (`dark:` compensation), **F10** (white ring offset), **F12** (`z-100` dead), **F13–F17**, **F20** (focus coverage), **F21** (`FIXED-IN-TREE`), **F22** (`animate-caret-blink`), **F23** (476 redundant `dark:`), **F24** (`text-xs` dominance), **F25** (duplicate locale keys), **F26** (locale-less time), **F30** (off-scale `rounded`) are documented in §1–§5 and in the summary table above.

### F1 — dark-mode `--primary` was an invalid value `P0 → FIXED-IN-TREE`

**This was the most severe finding of the audit and it was fixed by the concurrent refactor before the report was written.** It is recorded because the mechanism is worth knowing about, and because the fix is a single token definition that must not be lost.

When the audit started, `.dark` read:

```css
/* src/global.css (start of audit) */
  .dark {
    --background: var(--n-9);
    --foreground: var(--c-label-d);

    --primary: var(--n-30);      /* ← --n-30 was not defined anywhere */
```

`--n-30` was defined **nowhere**: the `:root` neutral ramp defined only
`--n-100 --n-98 --n-96 --n-95 --n-94 --n-93 --n-90 --n-27 --n-22 --n-20 --n-18 --n-16 --n-15 --n-13 --n-12 --n-9 --n-8`,
and `grep -rn 'n-30' src tailwind.config.js` returned only the `--primary` reference itself. Per CSS Custom Properties, `var(--n-30)` with no fallback makes `--primary` *invalid at computed-value time*, so `hsl(var(--primary))` (`tailwind.config.js:25-28`) was invalid for `background-color`, which fell back to its initial value → **`bg-primary` rendered `transparent`**. Since `text-primary-foreground` (`--n-100`) stayed valid, in dark mode every primary button was **white text on the page background** — the `default` Button variant (`button.tsx:12`), the mobile `添加`/`登录`/`保存` buttons (`mobile/pages/home/index.tsx:166,283,334`) and `ai-panel.tsx`'s send button all lost their fill.

**Current state — fixed:**

```css
/* src/global.css:24 */
  --n-30: 0 0% 30%;         /* 暗色主按钮填充（白字对比度 ≈ 8.5:1） */
```

```bash
grep -n 'n-30' src/global.css                                 # 24 (definition), 104 (--primary ref)
grep -oE '\-\-n-30: *[^;]*' /tmp/envis-audit/out2.css         # --n-30: 0 0% 30%
```

**Regression guard:** this class of bug is invisible to Tailwind (the rule is generated correctly) and invisible to TypeScript. The only reliable check is resolving every `var()` in the generated CSS — worth adding, since 22 files were being edited concurrently when this was found.

### F12 — `z-100` is not a class `P1`

`src/Loading.tsx:2`:

```tsx
  return <div className="fixed inset-0 z-100 flex items-center justify-center bg-overlay/40 backdrop-blur-sm">
```

Tailwind's default `zIndex` scale is `0,10,20,30,40,50,auto`; `z-100` is not in it and is not added by `tailwind.config.js`. `grep -c 'z-100' /tmp/envis-audit/out2.css` → `0`, while `z-[100]` does emit (`out2.css:887-889`). The repo uses `z-[100]` elsewhere for the same intent. The overlay's `z-index` is therefore `auto`; `LogPanel` is `z-40` (`log-panel.tsx:186`) and dialogs/toaster are `z-50`, and `src/pc/App.tsx:26-28` renders `{isAppLoading && <Loading />}` **after** `<Envis />` (which contains `LogPanel`), so the stacking order is decided by z-index, not DOM order: an open log panel or dialog paints above the blocking spinner.

### F13 — contradictory duplicate utilities in the log panel `P2`

`src/pc/pages/log-panel/log-panel.tsx:187`:

```tsx
      <div className="bg-content2 border rounded-lg bg-content1 border border-divider rounded-2xl pointer-events-auto overflow-hidden">
```

Four conflicts on one element: `bg-content2` vs `bg-content1`; `rounded-lg` vs `rounded-2xl`; `border` twice; `border` vs `border-divider`. Only CSS source order decides the winner — `bg-content2` (later in the generated colour order) and `rounded-2xl` (later in the radius scale) survive, so the written surface/radius intent is not readable from the source. This is the same class of defect as `service-data-item.tsx:430` recorded in `03-env-panel.md`.

### F14 — log panel typography `P2`

* Panel body copy is `text-xs` (12 px) at `:32` (level badge), `:41` (`LogEntryItem` root), `:214` (asc/desc toggle), `:246` (empty state), `:274,294,307,320,334` (accordion triggers). Given this is a dense log viewer that is fine functionally, but it is one step below the declared 13 px base and inconsistent with the 13 px used for ordinary PC body text.
* `text-[11px]` ×13 (`:58,278,279,282,283,285,297,301,310,314,323,328,336`) — the entire State tab, i.e. the JSON dumps of `appSettings`, `systemSettings`, `envs`, `serviceDatas`, `chatMessages`, are rendered at **11 px**, and each is wrapped in `leading-tight` ×10. 11 px JSON is hard to read and the `max-h-40 overflow-auto` + `whitespace-pre-wrap break-words` combination means the JSON both wraps and scrolls.
* The `<pre>` blocks (`:58,279,283,301,314,328`) get monospace **only** from Tailwind preflight, at `text-[11px] leading-tight` — there is no explicit `font-mono`, which is why `log-panel.tsx` shows 0 `font-mono` in §1.6 while still rendering monospace.
* 18 bare `rounded` (4 px) — the worst count in the repo (F30).

### F16 / F17 / F15 — AI panel detail findings

```tsx
// F16 — error is an ordinary assistant bubble (ai-panel.tsx:467-473)
      const errorMessage = t('ai_panel.error_message', { message: error instanceof Error ? error.message : 'Unknown error' })
      addChatMessage({
        role: 'assistant',
        content: errorMessage
      })
```

```tsx
// F17 — textarea can never reach max-h (ai-panel.tsx:647-648)
            className="w-full bg-content2 border-divider focus:border-primary transition-all duration-250 min-h-[80px] max-h-[200px] resize-none pr-12 pb-12"
            rows={3}
```

`resize-none` removes the manual handle and there is no `onInput`/`scrollHeight` auto-grow anywhere in the file, so the box is pinned at ~80 px and `max-h-[200px]` is dead. A long prompt is edited through a 3-line window.

```tsx
// F15 — assistant bubble has no break-words (ai-panel.tsx:587 vs :591)
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">   // assistant
...
                      <div className="break-words">{message.content}</div>          // user
```

### F19 — mobile icon-only control with no name `P2`

`src/mobile/pages/home/index.tsx:190-196`:

```tsx
                  <button
                    className="rounded p-1 text-muted-foreground hover:bg-content2"
                    onClick={() => toggleHostExpanded(host.id)}
                    type="button"
                  >
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
```

No `aria-label`, no `title`, no `sr-only`; no `aria-expanded`/`aria-controls` on a disclosure control; 24×24 px; `rounded` = 4 px (off-scale).

### F28 — shipped developer banner in the mobile UI `P2`

`src/mobile/App.tsx:57-59`:

```tsx
        <div className="border-b border-divider bg-content1 px-4 py-2 text-[11px] text-muted-foreground dark:border-divider dark:bg-content2 dark:text-muted-foreground">
          Mobile platform: {platform.platform} | Touch: {platform.isTouchDevice ? 'yes' : 'no'}
        </div>
```

Untranslated English diagnostic text rendered as permanent chrome at the top of the production mobile screen, using `text-[11px]` — and its `dark:*` twins no-op on a light-mode device (F3).

---

## 10. Reproduce — every count in this report

> These commands reproduce the counts **for the snapshot `HEAD=8ea75f1` + uncommitted changes as of `2026-09-24T16:59Z`**. Inline `# → N` comments are the values observed then. The tree was being edited concurrently; re-run before quoting.

```bash
cd /Users/heroisuseless/Documents/GitHub/envis-app

# authoritative class-emission check (fresh build; dist/ is stale)
./node_modules/.bin/tailwindcss -i src/global.css -o /tmp/envis-audit/out2.css \
  --content "./src/**/*.{ts,tsx},./index.html,./mobile.html"

# --- (a) typography
grep -rhoE '\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl)\b' src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn
# → 515 text-xs / 177 text-sm / 7 text-lg / 4 text-base / 1 text-3xl   (704 total)
grep -rhoE '\btext-\[[^]]+\]' src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn
# → 97 text-[10px] / 33 text-[11px] / 3 text-[9px] / 3 text-[0.8rem] / 1 text-[15px] / 1 text-[12px]   (138 total)
grep -rhoE '\bfont-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b' src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn
grep -rhoE 'leading-[a-zA-Z0-9-]+' src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn
grep -rhoE 'tracking-[a-zA-Z0-9-]+' src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn
grep -rhoE '\bfont-(mono|sans|serif)\b' src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn

# --- (b) colours
grep -rhoE '\b(bg|text|border|ring|from|to|via|fill|stroke|divide|outline|shadow|caret|accent|placeholder|decoration)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(-[0-9]{2,3})?(/[0-9.]+|/\[[^]]*\])?' src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn
# → 16 bg-white/5, 10 bg-white, 6 bg-white/10, 2 text-white, 2 border-white/10, 2 bg-black/45, 1 border-white/5, 1 bg-white/[0.03]   (40 total)
grep -rnoE '#[0-9a-fA-F]{3,8}\b' src --include=*.tsx --include=*.ts | wc -l          # 0
grep -rnE '\b(text|bg|border|ring|from|to|via|fill|stroke|divide|placeholder|outline|shadow)-(default|warning|success|danger|primary|focus|content[1-4])-[0-9]{2,3}\b' src --include=*.tsx --include=*.ts
# → ai-panel.tsx:554 text-warning-600   (the only survivor of 12)

# --- (c) arbitrary values
grep -rhoE '\b[a-z-]+-\[[^]"'"'"'` ]*\]' src --include=*.tsx --include=*.ts | wc -l                       # 467
grep -rhoE 'data-\[[^]"'"'"'` ]*\]'  src --include=*.tsx --include=*.ts | wc -l                          # 235
grep -rhoE 'group-\[[^]"'"'"'` ]*\]' src --include=*.tsx --include=*.ts | wc -l                          # 18
grep -rhoE '\b[a-z-]+-\[[^]"'"'"'` ]*\]' src --include=*.tsx --include=*.ts | grep -vE '^(data|group)-' | sort | uniq -c | sort -rn   # 214
grep -rhoE '\brounded(-[a-z0-9]+)?\b' src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn
grep -rho 'rounded-xs' src --include=*.tsx | wc -l                                                        # 0 (new token unused)
grep -rhoE '\bshadow(-[a-z0-9]+)?\b' src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn       # only shadow-pop ×19
# bare `rounded` needs python on macOS grep (no -P):
python3 -c "
import re,os
t=0
for d,_,fs in os.walk('src'):
    for f in fs:
        if f.endswith(('.tsx','.ts')):
            p=os.path.join(d,f)
            n=sum(1 for l in open(p,encoding='utf-8') if re.search(r'rounded(?![-\w])',l))
            if n: print(n,p); t+=n
print('total',t)"                                                                                          # total 61

# --- (d) dark: variants
grep -rhoE 'dark:[^ "'"'"'`]+' src --include=*.tsx --include=*.ts | wc -l                                 # 597
grep -rhoE 'dark:[^ "'"'"'`]+' src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn
grep -rhoE 'dark:[^ "'"'"'`]+' src --include=*.tsx --include=*.ts | grep -E '^dark:(text|border|bg)-(foreground|muted-foreground|warning|success|danger|focus|divider|background|content[1-4]|primary)(/[0-9]+)?$' | wc -l   # 476
grep -rc 'dark:' src --include=*.tsx --include=*.ts | grep -v ':0$'

# --- (e) focus
grep -rn 'focus-visible' src --include=*.tsx | wc -l                                                      # 23
grep -rn 'focus-visible' src --include=*.tsx | awk -F: '{print $1}' | sort | uniq -c                       # 13 files
grep -rho 'outline-none' src --include=*.tsx | wc -l                                                      # 58
grep -rhoE '\bfocus:[^ "'"'"'`]+' src --include=*.tsx | sort | uniq -c | sort -rn
grep -n 'tw-ring-offset-color' /tmp/envis-audit/out2.css                                                  # 25,79 → #fff

# --- (f) accessible names — the scanner used is /tmp/envis-audit/scan3.py (read-only JSX walker)
grep -rho 'aria-label' src --include=*.tsx | wc -l                                                        # 7
grep -rho 'sr-only'   src --include=*.tsx | wc -l                                                         # 6
grep -rhoE '\btitle=' src --include=*.tsx | wc -l                                                         # 70

# --- (g) motion
grep -rhoE '\btransition(-[a-z]+)?\b' src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn
grep -rhoE '\bduration-[a-z0-9]+' src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn
grep -rhoE '\bease-[a-z-]+' src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn               # only ease-in-out ×4
grep -rhoE '\banimate-[a-z0-9-]+' src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn
grep -rn 'prefers-reduced-motion' src tailwind.config.js index.html mobile.html                            # src/global.css:263 (FIXED-IN-TREE)
grep -rn 'motion-safe\|motion-reduce' src --include=*.tsx --include=*.ts                                  # nothing
grep -n 'caret' tailwind.config.js src/global.css                                                         # nothing → animate-caret-blink undefined

# --- (h) i18n (key diff + duplicate keys)
python3 - <<'PY'
import json
def flat(o,p=''):
    d={}
    for k,v in o.items():
        key=f"{p}.{k}" if p else k
        d.update(flat(v,key)) if isinstance(v,dict) else d.__setitem__(key,v)
    return d
en=flat(json.load(open('src/pc/i18n/locales/en.json',encoding='utf-8')))
zh=flat(json.load(open('src/pc/i18n/locales/zh.json',encoding='utf-8')))
print(len(en), len(zh), sorted(set(en)-set(zh)), sorted(set(zh)-set(en)))
# → 1412 1412 [] []
def dup(p):
    def hook(pairs):
        seen=set()
        for k,v in pairs:
            if k in seen: print('DUP',p,k)
            seen.add(k)
        return dict(pairs)
    json.load(open(p,encoding='utf-8'),object_pairs_hook=hook)
dup('src/pc/i18n/locales/en.json'); dup('src/pc/i18n/locales/zh.json')
# → DUP en.json welcome ; DUP zh.json advanced_options use_prebuilt compile_from_source
PY

# --- mobile platform integration (all of these are empty / near-empty)
grep -rn "safe-area\|viewport-fit\|visualViewport\|orientationchange\|100dvh\|-webkit-fill-available" src mobile.html index.html
grep -rn "inputMode\|autoComplete\|enterKeyHint\|autoCapitalize\|autoCorrect\|virtualkeyboard" src/mobile src/Loading.tsx
grep -rn "select-none\|tap-highlight\|touch-action\|overscroll" src/mobile src/global.css
grep -rn 'useTranslation\|i18n' src/mobile src/main-mobile.tsx                                            # nothing
grep -rn 'className="dark\| dark"' src/mobile --include=*.tsx                                             # 1 hit: android-terminal-panel/index.tsx:39
```

**Zero-dependency checks for the two P0-class claims:**

```bash
# F2/F4 — the markdown/code pipeline is unstyled
grep -n 'typography' package.json tailwind.config.js     # nothing → plugin absent
grep -c 'prose' /tmp/envis-audit/out2.css                # 0 → every prose* class is dead
grep -rn 'hljs' src --include=*.tsx --include=*.ts --include=*.css | wc -l   # 0 → no highlight theme

# F1 regression guard — resolve every var() in the built CSS
grep -oE '\-\-n-[0-9]+:' /tmp/envis-audit/out2.css | sort -u   # must contain --n-30:
```

---

## 11. Positive results (recorded so they are not "fixed" by mistake)

1. **One shadow only.** `shadow-pop` ×19; zero `shadow-sm/md/lg/xl/2xl/inner`. Matches the design language.
2. **No palette-scale colours and no hex literals** in any `.tsx`/`.ts`/`.css` (only the 40 white/black opacity utilities in §2.1).
3. **Both locale files are key-complete** (1412 = 1412, 0 missing either direction).
4. **`.dark` is correctly declared as a plain class selector** and the terminal's subtree override works — Tailwind emits `.dark\:X:is(.dark *)` for variants, and `android-terminal-panel/index.tsx:39` puts `dark` on its own root.
5. **Alpha modifiers on token colours work** (`hsl(var(--content1) / .95)`), so the ~60 distinct slash-alpha token forms are not a defect.
6. **The refactor's new token layer is sound and should be kept**: `--n-30` (fixes F1), the `--text-*`/`--lh-*` size scale, `--radius-xs`, `--font-sans`/`--font-mono` with explicit CJK families, `--dur-1..4` + `--ease-standard`, `::selection`, `color-scheme`, `.nums { tabular-nums }`, and the `prefers-reduced-motion` block. The open items are **migration** (97 + 33 arbitrary sizes, 61 bare `rounded`, 0 uses of `rounded-xs`/`ease-standard`/`duration-400`) rather than missing definitions.
7. **IME-safe Enter-to-send** in the AI panel (`ai-panel.tsx:491-499` checks `e.nativeEvent.isComposing`) and **correct interrupt handling** (Escape, `AbortController`, `reader.cancel()`, `isInterruptedRef`).
8. **Chat history is persisted** to `localStorage` (`src/pc/store/ai.ts`) and clear/interrupt share one code path (`ai-panel.tsx:511-520`).
9. **`body { overflow-wrap: break-word }`** (`global.css:148`) is inherited, which fixes the long-token overflow class of bug app-wide — including the assistant bubble in F15.
