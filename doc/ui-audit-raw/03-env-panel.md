# UI Audit — Environment Panel (service configuration UI)

**Scope:** `src/pc/pages/env-panel/**` — env-panel shell, service list, services dashboard, custom-service\*, nginx-service\*, dnsmasq-service\*, host-service\*, ssl-service\*, python-service\*.
**Design language audited against:** `src/global.css` tokens + `tailwind.config.js` (content1/2/3/4 steps, divider/border, `shadow-pop` only, base `text-sm` = 13px, radii sm6/md8/lg10/xl12/2xl16).
**Method:** read-only grep/read of every in-scope file. No file was modified except this report.

Deliberately out of scope (not counted below), though greppable from the same folders: `java-service.tsx`, `nodejs-service/`, `redis-service/`, `mongodb-service.tsx`, `mariadb-service/`, `mysql-service/`, `postgresql-service/`, `nasm-service/`, `rust-service.tsx`.

> Correction to the brief: `content1..content4-foreground` **do** exist (`src/global.css:71-77`, `107-113`) and `tailwind.config.js:29-48` maps `default.DEFAULT`, so `text-default` **does** emit CSS. `text-default{color:hsl(var(--default))}` is present in the built bundle (`dist/assets/index-Dm_3_pKY.css`) — that makes the findings below *worse*, not better, because the class silently paints near-white-on-white in light mode. There is still no `default-100..900` scale (`bg-default-400` etc. emit nothing).

---

## Summary

| # | Sev | Issue | Location |
|---|-----|-------|----------|
| 1 | P0 | Nginx config view is 100% hardcoded Chinese — no i18n at all, while `nginx_service.*` keys are fully translated in both locales | `nginx-service/NginxConfigView.tsx:199,216,218,236,242,255,273,291,299-301,321,331,341,357,362,370,400,437,447-448` |
| 2 | P0 | Dnsmasq config view is 100% hardcoded Chinese; `dnsmasq_service.*` keys unused | `dnsmasq-service/DnsmasqConfigView.tsx:80,97,113,116,125,129,140,143,154,157,170,180,189-190,203,213,223,231,235,241,248,262` |
| 3 | P0 | Hosts management view is 100% hardcoded Chinese; `host_service.*` keys unused | `host-service/HostManagementView.tsx:105,119,140,184,192,220,242,250,289,295,336,342,361,363,367,381,391,403,413,421-422,437,447,455,495,498,503,513,523,538,542,544,554,556,561,572,583,586` |
| 4 | P0 | Dnsmasq config **content** is loaded into state and never rendered; the only `Textarea` import in the whole panel is unused — dnsmasq has no config editor at all | `dnsmasq-service/DnsmasqConfigView.tsx:9,56-57,72-73,163-266` |
| 5 | P0 | Every `<Input>` has no visible keyboard focus indicator: base class uses `focus:border-divider`, i.e. the same colour as the resting border | `src/pc/components/ui/input.tsx:12` (consumed 1–18× per in-scope screen) |
| 6 | P1 | `border border-divider` is repeated on the *same element* as base `border-divider`, 25+ times; the sibling `border` in `"border box-border"` renders with no colour | `service-data-item.tsx:428`; `custom-service/PathConfigView.tsx:84,142,157,176`; `EnvironmentVariablesView.tsx:107,165,180,188,207`; `AliasesConfigView.tsx:139,197,212,220,249`; `AutoChdirView.tsx:123,146`; `ProjectDirectoryView.tsx:173,188,265`; `ssl-service/index.tsx:186,197,267,296`; `python-service/PipConfigView.tsx:114,121,135,144,153,162`; `python-service/VenvView.tsx:189,222,272,277,295,306`; `dnsmasq-service/DnsmasqConfigView.tsx:177,198,208,218,229,242,249` |
| 7 | P1 | `bg-white dark:bg-content1/40` (and `/20`) — raw white panels nested inside `bg-content1` cards; wrong surface step, dark-mode-only token | `ssl-service/index.tsx:222`; `ssl-service/ca-install-guide.tsx:39,82,126`; `ssl-service/certificate-list.tsx:113`; `nginx-service/NginxConfigView.tsx:409,423`; `host-service/HostManagementView.tsx:430` |
| 8 | P1 | Contradictory duplicate utilities on one `cn()` string — the last one wins, so the `dark:border-divider` value renders while `dark:border-default` silently loses | `service-data-item.tsx:430` (`" bg-background dark:bg-content3 dark:border-default  dark:bg-content2 dark:border-divider"`) |
| 9 | P1 | Status text uses `text-default` (the *hover-border* grey, 90.2% lightness). In the light theme the value is `hsl(0 0% 90.2%)` on `content1` (100% white) → invisible; `dark:text-muted-foreground` only saves dark mode | `services-dashboard.tsx:384,396,413` |
| 10 | P1 | `text-[10px]` / `text-[12px]` arbitrary sizes: 81× `text-[10px]` and 1× `text-[12px]` in scope; full table column headers, versions, CPU/memory values and quick-set buttons are set at 10px (≈77% of the 13px base) | `services-dashboard.tsx:241,306,341,344,347,350,353,375,380,384,392,396,402,413`; `PipConfigView.tsx:129,135,144,153,162`; `EnvironmentVariablesView.tsx:156`; `AliasesConfigView.tsx:188`; `PathConfigView.tsx:133`; `AutoChdirView.tsx:129`; `ProjectDirectoryView.tsx:178,271`; `VenvView.tsx:295,306`; `HostManagementView.tsx:440` |
| 11 | P1 | Save-button label is copy-pasted: Aliases and Env-Vars both render `custom_service.save_path_config` ("Save Configuration"), telling the user they are saving paths | `AliasesConfigView.tsx:264`; `EnvironmentVariablesView.tsx:222` |
| 12 | P1 | Host row delete has **no confirmation** — one click permanently edits `/etc/hosts` (certificates and venvs do confirm) | `HostManagementView.tsx:476-481` vs `ssl-service/certificate-list.tsx:140-163`, `python-service/VenvView.tsx:159` |
| 13 | P1 | Destructive confirm is reinvented: native `window.confirm()` in the Python view while the SSL view (same panel) uses Radix `AlertDialog` | `python-service/VenvView.tsx:159` |
| 14 | P1 | The "add row" button in Path config is disabled by inverted/broken logic (`!active && isLoading`) so it stays clickable while the service is inactive — inconsistent with its three sibling views | `custom-service/PathConfigView.tsx:141` vs `EnvironmentVariablesView.tsx:164`, `AliasesConfigView.tsx:196` |
| 15 | P1 | An `Alert` is rendered with an icon and no content on non-macOS (its only child is gated by `isMacOS`) — an empty yellow warning box | `dnsmasq-service/DnsmasqConfigView.tsx:165-174` |
| 16 | P1 | Root padding is applied by the parent in one screen and inside each card in the sibling screen; custom-service pads its children, ssl/nginx/host pad the root | `custom-service/index.tsx:26` vs `ssl-service/index.tsx:184,186,296`; `python-service/PipConfigView.tsx:88-89` |
| 17 | P1 | Only **one** `aria-label` exists in the entire 35-file panel; icon-only buttons (20×20 to 28×28) are unnamed — many carry no `title` either | `aria-label` only at `mysql-service/index.tsx:1260`; unnamed examples `service-data-item.tsx:582`, `service-data-list.tsx:154`, `ssl-service/certificate-list.tsx:142,200,208,228,236,256,264`, `ssl-service/index.tsx:193,250,299`, `python-service/VenvView.tsx:209,303,306`, `HostManagementView.tsx:469,478` |
| 18 | P2 | Click targets below the 24×24 minimum: `h-5 w-5` (20×20) and `h-6 w-6` (24×24) icon buttons in dense rows | `HostManagementView.tsx:469,478`; `VenvView.tsx:212`; `service-data-list.tsx:161`; `ssl-service/index.tsx:250` |
| 19 | P2 | `<button>` nested inside a Radix `CollapsibleTrigger` (itself a `<button>`) — invalid HTML and unpredictable click/keyboard routing | `ssl-service/certificate-list.tsx:114-167` (buttons at `129-139`, `142-148`) |
| 20 | P2 | Hardcoded English strings in otherwise i18n-driven screens | `service-data-list.tsx:134` (`Servs`), `nginx-service/NginxConfigView.tsx:407,418,425,429` (`Error Log`, `Server Blocks`, `Listen:`, `Server Name:`), `service-data-item.tsx:259` (`请输入密码`) |
| 21 | P2 | `bg-gradient-to-br` with no gradient stops emits an empty `linear-gradient(...)` — dead class (the inner use is a gradient, violating "quiet neutral surfaces") | `services-dashboard.tsx:186` vs `:218` |
| 22 | P2 | Developer debug logging left in shipped UI (`console.log('zws nginx start')`) | `nginx-service/NginxConfigView.tsx:230,234,244` |
| 23 | P2 | Duplicate DOM `id="validityDays"` in two sibling dialogs, and the SAN remove control is a clickable `<svg>` inside a `Badge` | `ssl-service/ca-init-dialog.tsx:127-137` / `ssl-service/issue-certificate-dialog.tsx:107-117`; `issue-certificate-dialog.tsx:154-157` |
| 24 | P2 | Dead sibling view duplicating `ProjectDirectoryView` (same metadata, same handlers, different label), never imported | `custom-service/AutoChdirView.tsx` (whole file; no import anywhere in `src/`) |

---

## 1. Cross-screen pattern comparison (most important)

Every service-config screen reinvents the same primitives. Columns are the nine in-scope configuration surfaces.

Legend: **CP** = `custom-service/PathConfigView`, **CE** = `custom-service/EnvironmentVariablesView`, **CA** = `custom-service/AliasesConfigView`, **CJ** = `custom-service/ProjectDirectoryView`, **NX** = `nginx-service/NginxConfigView`, **DM** = `dnsmasq-service/DnsmasqConfigView`, **HS** = `host-service/HostManagementView`, **SL** = `ssl-service/index`+children, **PY** = `python-service/PipConfigView`+`VenvView`.

| Pattern | CP | CE | CA | CJ | NX | DM | HS | SL | PY |
|---|---|---|---|---|---|---|---|---|---|
| **Group/card container** | `p-3 rounded-xl border border-divider bg-content1` `PathConfigView.tsx:84` | identical `:107` | identical `:139` | identical `:173` | identical `NginxConfigView.tsx:288,348` | identical `DnsmasqConfigView.tsx:177,229` | identical `:386` | identical `ssl-service/index.tsx:186,296` | identical `PipConfigView.tsx:89`, `VenvView.tsx:189` |
| **Nested sub-surface** | — | — | — | — | `bg-white dark:bg-content1/40` `:409,423` | — | `bg-white dark:bg-content1/40` `:430` | `bg-white dark:bg-content1/40` `index.tsx:222`, `ca-install-guide.tsx:39,82,126`, `certificate-list.tsx:113` | `bg-content2 dark:bg-content1/40` `VenvView.tsx:277`; `bg-content2/50` `:283` |
| **Root padding** | cards only; parent pads (`custom-service/index.tsx:26` `p-3`) | same | same | same | `w-full p-3 space-y-3` `:286` | `w-full p-3 space-y-4` `:164` | `w-full p-3 space-y-4` `:372` | **no padding**, `w-full space-y-4` `:184` + `p-3` per card | double-pad `PipConfigView.tsx:88-89` (`p-3 pb-0` → `p-3`); `VenvView.tsx:188-189` (`p-3 space-y-6` → `p-3 space-y-3`) |
| **Section heading** | `<Label>` `text-xs font-medium`, no icon `:90` | same `:113` | same `:145` | same `:175` | same `:290,356,400` | same `:179,230` | `<Label>` **with leading icon** `:389-391` | `<Label>` with icon `index.tsx:188`, **without** icon `:298` | `<Label>`+`Info` `PipConfigView.tsx:95,176`; `<Label>`+`Info` `VenvView.tsx:195` |
| **Explanatory hint** | `<p className="text-[10px] text-muted-foreground mt-0.5">` `:133` | same `:156` | same `:188` | same `:178,271` | inline `<div>` `text-xs` `:405,416` | — (no hint) | `<Alert>` banner instead `:374-384` | `<p className="text-xs text-muted-foreground">` `issue-certificate-dialog.tsx:101,118,162` | `text-[10px] text-muted-foreground dark:text-muted-foreground` `PipConfigView.tsx:185` |
| **Label/value row axis** | label above field (`:90`, input `:153`) | label above field (`:113`) | label above field (`:145`) | label above field (`:175`) | label above field (`:356-367`) | label above field (`:235-243`) | label above field **inside a dialog** `:503-530` | label above field (`ca-init-dialog.tsx:78-86`) | label above field (`VenvView.tsx:241-248`) |
| **Key/value row split** | single full-width input `:157` | two `flex-1` inputs + `=` `:180-190` | `w-1/3` key + `flex-1` value + `=` `:212-220` | n/a | n/a | n/a | n/a | n/a | n/a |
| **Row vertical rhythm** | `space-y-2` `:150` | `space-y-3` `:173` | `space-y-3` `:205` | n/a | `space-y-4` `:350` | `space-y-4` `:233` | `space-y-2` `:418` | `space-y-4` `index.tsx:238` | `space-y-3` `VenvView.tsx:189` |
| **"Add row" affordance** | `variant="outline" size="sm" h-7 px-2 text-xs` + `Plus` `:137-146` | identical `:160-169` | identical `:192-201` | **no add affordance** (single path, only `Apply`) `:194-202` | n/a (icon-only save) `:374-383` | none | `h-7 text-xs px-2` + `Plus` `:405-414` | `h-7 px-2 text-xs` + `Plus` `index.tsx:299-308`; `h-6 px-2` in `certificate-list` | `h-7 text-xs` + `Plus` `VenvView.tsx:219-228` |
| **Add-button disabled rule** | `!isServiceDataActive && isLoading` (**bug**) `:141` | `isLoading \|\| !isServiceDataActive` `:164` | `isLoading \|\| !isServiceDataActive` `:196` | n/a | n/a | n/a | `isLoading \|\| !isServiceDataActive` `:409` | `!isServiceActive` `index.tsx:303` | `!isServiceActive` `VenvView.tsx:224` |
| **Save affordance** | right-aligned `variant="default" h-8 text-xs` `:184-192` | same `:215-223` | same `:257-265` | inline next to field, label **"Apply"** `:194-202` | icon-only save button with `title="保存"` `:374-383` | **no save for content**; `h-8 text-xs` `更新路径` `:256-263` | save lives in a dialog `:543-545` | none (write-through) `ca-init-dialog.tsx:175` | inline "Apply" `PipConfigView.tsx:116-124`; dialog "Create" `VenvView.tsx:263` |
| **Save label** | `custom_service.save_path_config` | `…save_path_config` (**wrong**) | `…save_path_config` (**wrong**) | `custom_service.apply` | hardcoded `保存`→`title` | hardcoded `更新路径` | hardcoded `保存` | `ssl_service.init_ca_btn` / `issue_cert_btn` | `python_service.apply` / `create` |
| **Saving label** | `custom_service.saving` | same | same | `custom_service.applying` | none (spinner only) | none | `保存中...` | `ssl_service.initializing` / `issuing` | `python_service.creating` |
| **Empty state** | dashed card `py-6` `:176` | dashed card `py-6` `:207` | dashed card `py-6` `:249` | none | dashed card `py-6` + 24px icon `:445-449` | none | dashed card **`py-8`, no icon, no bg** `:420-423` | dashed card `py-6` `index.tsx:206`; plain `py-8` + 48px icon `certificate-list.tsx:97-102` | solid border (not dashed), no icon, `py-6` `VenvView.tsx:272-275` |
| **Loading state** | button label swap | button label swap | button label swap | button label swap | button label swap | **`isLoading` never rendered** | button label swap | `Loader2 animate-spin` `index.tsx:214-217` | `RefreshCw` + `animate-spin` `VenvView.tsx:216`; certificate list uses `RefreshCw` `:90` |
| **Error display** | `toast.error` | `toast.error` | `toast.error` | `toast.error` | `toast.error` | `toast.error` | `toast.error` | `toast.error` | `toast.error` (consistent) |
| **Inline validation** | none | none | none | none | none | none | none (toast only) `:183-193` | native HTML `required` + toast `ca-init-dialog.tsx:84,96,121,135,148,160` | toast only `VenvView.tsx:136-139` |
| **Required-field marking** | n/a | n/a | n/a | n/a | n/a | n/a | `*` suffix `:503,513,561` | none | none |
| **Service-inactive treatment** | inputs disabled, buttons mostly disabled `:158` | same `:181` | same `:213` | same `:189` | whole config block replaced by empty state `:444-450` | controls **not** gated by `isServiceActive` at all `:194-225` | controls disabled `:399,409` | empty state `index.tsx:205-211` | disabled `PipConfigView.tsx:113` |
| **Destructive confirm** | none (row delete is immediate) `:164` | none `:195` | none `:237` | n/a | n/a | n/a | **none** `:476` | `AlertDialog` `certificate-list.tsx:140-163` | native `confirm()` `VenvView.tsx:159` |
| **Config-content editor** | n/a | n/a | n/a | n/a | parse + read-only render, **not editable** `:398-442` | **absent** (dead `Textarea` import) `:9` | n/a (structured form) | n/a | n/a |
| **i18n** | ✅ | ✅ | ✅ | ✅ | ❌ all hardcoded zh | ❌ all hardcoded zh | ❌ all hardcoded zh | ✅ | ✅ |

### Pattern verdicts

- **Card shell is the one thing that is consistent** (17 occurrences of the exact string `p-3 rounded-xl border border-divider bg-content1`). Everything nested inside it diverges.
- **Three of nine screens (nginx, dnsmasq, host) are outside i18n entirely**, and the keys to fix them already exist: `en.json`/`zh.json` ship complete `nginx_service.*` (24 keys), `dnsmasq_service.*` (23), `host_service.*` (34). The work is purely wiring.
- **Save semantics split three ways**: batched explicit save (custom), write-through with no save (ssl, parts of python), and per-field explicit save (nginx path, dnsmasq path, python pip). Users cannot build one mental model of "when is my change saved".
- **Empty-state treatment is 5 different specs** (`py-6` dashed + `bg-content1` / `py-6` dashed, no bg / `py-8` no bg no icon / plain `py-8` + 48px icon / solid border).

---

## 2. Surface & elevation errors

### 2.1 `bg-white dark:bg-content1/40` — wrong surface step, dark-scoped token (P1)

```tsx
// ssl-service/index.tsx:222
<Alert className="bg-white dark:bg-content1/40 border-divider">
```
```tsx
// ssl-service/ca-install-guide.tsx:39 (and :82, :126)
<div className="bg-white dark:bg-content1/40 rounded border border-divider p-4 space-y-3">
```
```tsx
// host-service/HostManagementView.tsx:429-432
className={`... ${host.enabled
  ? 'bg-white dark:bg-content1/40 border-divider'
  : ' bg-background dark:bg-content1/20 border-divider opacity-75'}`}
```
Why wrong: these panels already sit **inside** a `bg-content1` card. `content1` is defined as `--n-100` in light mode and `--n-12` in dark (`global.css:70,106`), so `bg-white` happens to equal `content1` in light mode but `dark:bg-content1/40` is a 40%-alpha version of that same step — i.e. the sub-panel is deliberately a *lighter/translucent* variant of its own parent, which is not a step in the vocabulary. The vocabulary is content1 (panel) → content2 (control) → content3 (group) → content4 (selected). Nested panels in the sibling screens use `bg-content2` (`VenvView.tsx:257`) or `bg-content2/50` (`ca-install-guide.tsx:45`), so the same visual role renders differently in two files of the same feature.

### 2.2 Nested containers using the wrong step (P1)

| Element | Class | Should be |
|---|---|---|
| `HostManagementView.tsx:440` | `bg-content2 dark:bg-content2` | `bg-content3` — it is a group fill inside a `content1` card, not a control fill |
| `ssl-service/index.tsx:267` | `bg-content1 dark:bg-content1/40 rounded border border-divider` inside `bg-content1 :186` | a lower step (`content2`/`content3`); currently invisible as a group |
| `VenvView.tsx:272` | empty state `bg-content1 dark:bg-content1/40` inside `bg-content1 :189` | same — zero surface contrast between empty state and its container |
| `services-dashboard.tsx:186` | `bg-gradient-to-br` (no stops → `linear-gradient(to bottom right, var(--tw-gradient-stops))` with an undefined value) | a solid `bg-background`; the class is dead |
| `services-dashboard.tsx:218` | `bg-gradient-to-br from-background/50 to-content1/30` | quiet neutral surface — the only gradient background in the panel |

### 2.3 `border` where `divider` belongs, and duplicated border utilities (P1)

```tsx
// service-data-list/service-data-item.tsx:428
"border box-border",
```
`border` here resolves through `global.css:135-137` (`* { border-color: hsl(var(--border)) }`) → `--n-94` light / `--n-15` dark, i.e. the *panel* border, one step darker than `divider` (`--n-95`/`--n-16`). It is then immediately contradicted by `border-transparent` on the unselected branch. Combined with the `bg-*` duplicates on `:430`:

```tsx
// service-data-item.tsx:429-431
isSelected
  ? " bg-background dark:bg-content3 dark:border-default  dark:bg-content2 dark:border-divider"
  : "hover:bg-content2 border-transparent dark:hover:bg-white/5",
```
Four surface/border classes in one string; Tailwind emits all of them and stylesheet order decides. Authored intent (`dark:bg-content3` + `dark:border-default`) is not what renders (`dark:bg-content2` + `dark:border-divider`). Selected state in light mode is `bg-background` (`--n-98`) on a `background` (`--n-98`) sidebar — **the selected row has no visible fill at all in light mode**; only the 2px-ish border differentiates it, and that border is `transparent` per the sibling branch. This is a real "which row am I editing" defect.

Also `border border-border` instead of `divider` for in-panel group borders:
```tsx
// add-service-data-menu.tsx:511
<div className="space-y-3 rounded-md border border-border p-3">
// add-service-data-menu.tsx:553
<div className="flex items-start space-x-2 border-t border-border pt-2">
```
`divider` is the token for in-panel separation (`global.css:83`); `border` is the panel outline.

`border-t` with no colour, relying on the global `*` rule:
```tsx
// ssl-service/certificate-list.tsx:169
<div className="px-4 pb-4 pt-2 space-y-3 border-t">
```
Every sibling uses `border-t border-divider` (`ProjectDirectoryView.tsx:265`, `NginxConfigView.tsx:399`, `mysql-service/index.tsx:1175`). Here the collapsed/expanded divide renders a step darker than in every other screen.

### 2.4 Shadows
No `shadow-*` class appears anywhere in the panel (verified: `grep -rn "shadow" src/pc/pages/env-panel` → 0 hits). `shadow-pop` is applied only by the floating primitives (`dialog.tsx`, `alert-dialog.tsx`, `select.tsx`, `tooltip.tsx`). **This part of the design language is respected.**

### 2.5 Hardcoded near-black/white in the service item
```tsx
// service-data-item.tsx:453
filter: 'brightness(1.2)', // 稍微提亮
// :444-445
maskImage: 'radial-gradient(circle at center, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, transparent 80%)',
```
The decorative devicon watermark is hardcoded to `opacity: 0.3` boosted by `brightness(1.2)` — a fixed-luminance asset over both themes. On the dark theme this produces a bright glow behind the label that no token can control; it is the single most visually "non-AppKit" element in the list.

---

## 3. Typography

### 3.1 Inventory (in-scope files only)

| Size class | Count | Where |
|---|---|---|
| `text-xs` (12px) | 430 (whole panel) | dominant body size |
| `text-sm` (13px, the design base) | 70 | `Input`/`Textarea` base, `DialogDescription`, `HostManagementView.tsx:437` |
| `text-base` | 2 | `env-panel-header.tsx:25`, `service-data-list.tsx:134` |
| **`text-[10px]`** | **81** | `java-service` 15 (out of scope), `services-dashboard` 14, `nodejs` 10, `PipConfigView` 6, `mysql/mariadb/mongodb/postgresql` 6 each, `rust` 3, `VenvView` 3, `ProjectDirectoryView` 2, `PathConfigView`/`EnvironmentVariablesView`/`AliasesConfigView`/`AutoChdirView`/`HostManagementView` 1 each |
| **`text-[12px]`** | **1** | `HostManagementView.tsx:440` |
| `text-[11px]` | 9 | all in out-of-scope `java-service.tsx` / db services |

`text-[12px]` is literally the same value as `text-xs`; the author had no reason to write it and it is now a distinct, uncentralised token.

### 3.2 Conflicting heading hierarchy (P1)

Four different heading treatments for the same semantic role ("this is a section/card title"):

| Treatment | Example |
|---|---|
| `<Label>` inside a card, `text-xs font-medium text-foreground` | `PathConfigView.tsx:90`, `ssl-service/index.tsx:298` |
| Same `<Label>` but with a leading icon | `ssl-service/index.tsx:188-191`, `HostManagementView.tsx:389-391` |
| `text-base font-semibold` (16px) in the panel headers | `env-panel-header.tsx:25`, `service-data-list.tsx:134` |
| `text-xs font-medium text-muted-foreground uppercase tracking-wider` as an eyebrow | `services-dashboard.tsx:227,334`; `PipConfigView.tsx:129` |
| `text-lg font-semibold` (18px) from `DialogTitle` | `dialog.tsx:76` |

Note the inconsistency inside one file: `ssl-service/index.tsx:188` puts a `<Shield>` icon in the CA heading, `:298` puts no icon in the immediately-following certificate heading. `services-dashboard.tsx:194` uses `text-sm font-semibold` (14px) for its page title while `env-panel-header.tsx:25` uses `text-base font-semibold` (16px) for the same visual slot — the two headers are stacked in the same column and differ by 2px.

### 3.3 `text-[10px]` in dense tables — readability (P1)

```tsx
// services-dashboard.tsx:341-355
<th className="py-2 px-3 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
  {t('resource_monitor.col_service')}
</th>
...
<th className="... text-right text-[10px] ... w-20">{t('resource_monitor.col_memory')}</th>
```
and the values:
```tsx
// services-dashboard.tsx:375,380,392
<span className="text-muted-foreground text-[10px] flex-shrink-0">{service.version}</span>
<span className="text-foreground dark:text-foreground font-mono text-[10px]">{stat!.cpuUsage.toFixed(1)}%</span>
```
At 10px, `text-muted-foreground` is 50.2% grey and the header is additionally `uppercase tracking-wider` — the column labels for CPU / Memory / Disk become the least legible text in the UI while carrying the most numeric density. Same 10px on interactive controls:
```tsx
// PipConfigView.tsx:135,144,153,162
className="h-6 text-[10px] px-2 bg-content1 dark:bg-content1/40 border-divider"
```
Four mirror buttons (`Official` / `Tuna` / `Aliyun` / `Reset`) at 10px in a 24px-tall control — hard to hit and hard to read.

### 3.4 Label / value / hint hierarchy is not encoded
Three roles are rendered with near-identical classes, so the user must infer hierarchy from position alone:
- label: `text-xs font-medium text-foreground` (`PathConfigView.tsx:90`)
- value in a row: `text-xs font-medium` — `HostManagementView.tsx:437` uses `text-sm font-medium` instead
- hint: `text-[10px] text-muted-foreground` (`PathConfigView.tsx:133`) vs `text-xs text-muted-foreground` (`PathConfigView.tsx:178`, `issue-certificate-dialog.tsx:101`) vs `text-xs text-muted-foreground` wrapped in `dark:text-muted-foreground` redundantly (`PipConfigView.tsx:185`).

### 3.5 Monospace misuse as a hierarchy device
`font-mono` is used 32× in the panel but inconsistently for the same data kinds: a version string is mono in the dashboard table (`services-dashboard.tsx:380`) but not in the list item (`service-data-item.tsx:482`); a path is mono in `nginx` (`NginxConfigView.tsx:410,426,430`) and in the CA guide (`ca-install-guide.tsx:45,59`), but the path rows in `PathConfigView.tsx:153-157` are not.

---

## 4. Layout & spacing

### 4.1 Arbitrary / off-scale values (P2)
```
81× text-[10px]
 1× text-[12px]      HostManagementView.tsx:440
 1× p-[10px]         service-data-list.tsx:190
 1× right-[4px]      service-data-list.tsx:139
 1× w-[calc(100%-8px)] service-data-list.tsx:139
 1× max-h-[400px]    add-service-data-menu.tsx:437
```
`p-[10px]` for the list body (`service-data-list.tsx:190`) sits next to `p-2` (8px) headers in the same sidebar (`:116`), producing a 2px misalignment between the header title and the first list row. `right-[4px]`/`w-[calc(100%-8px)]` hardcode an 8px gutter that does not follow from any token.

### 4.2 Spacing scale drift (P1)
In-scope distribution of vertical rhythm: `space-y-1` ×38, `space-y-2` ×87, `space-y-3` ×41, `space-y-4` ×44, `space-y-6` ×1. The single `space-y-6` is `VenvView.tsx:188` while its sibling card uses `space-y-3` (`:189`) — and `PipConfigView.tsx:89` (same Python service, same page, adjacent card) uses `space-y-4`. The Python service page therefore renders cards with 24px, 12px and 16px internal rhythm in one vertical stack.

Same for card-to-card gaps: `custom-service/index.tsx:26` uses `space-y-4`; `python-service/index.tsx` renders `PipConfigView` (padded `pb-0`) then `VenvView` (padded `p-3`) with no wrapper gap at all; `ssl-service/index.tsx:184` uses `space-y-4`.

### 4.3 Fixed widths that break with longer translations (P1)
```tsx
// services-dashboard.tsx:344,347,350,353
<th className="... w-16">{t('resource_monitor.col_version')}</th>
<th className="... w-16">{t('resource_monitor.col_cpu')}</th>
<th className="... w-20">{t('resource_monitor.col_memory')}</th>
<th className="... w-28">{t('resource_monitor.col_disk')}</th>
```
and the body cells repeat the widths (`:374,378,390,400`). German/French labels ("Arbeitsspeicher", "Mémoire", "Festplatten-E/A") exceed 64–80px at 10px uppercase+tracking and will wrap or overflow the 16px-padded cell, breaking the numeric column alignment that right-aligned `text-right` was set up to provide. The Disk cell additionally packs `R <value>/s W <value>/s` into `w-28` with `whitespace-nowrap` (`:402`), which will overflow rather than wrap.

```tsx
// AliasesConfigView.tsx:212
className="w-1/3 h-8 text-xs ..."
```
A hardcoded 1/3 split for the alias key — the sibling env-var editor uses `flex-1`/`flex-1` (`EnvironmentVariablesView.tsx:180,188`), so the two key/value grids do not line up in the same page.

### 4.4 Panel padding is applied at two different levels (P1)
```tsx
// custom-service/index.tsx:26  — parent owns padding
<div className="w-full p-3 space-y-4">
```
```tsx
// ssl-service/index.tsx:184   — no parent padding; each card owns p-3
<div className="w-full space-y-4">
  <div className="p-3 rounded-xl border border-divider bg-content1">
```
```tsx
// pip python-service/PipConfigView.tsx:88-89  — both
<div className="w-full p-3 pb-0">
  <div className="w-full p-3 space-y-4 rounded-xl border border-divider bg-content1">
```
Result: switching service type in the same panel moves the content edge by 12px horizontally, and the SSL screen's cards touch the panel edge while custom-service's float 12px inside it. Combined with `env-panel.tsx:93` (`overflow-auto` with no padding), the SSL/nginx content is flush against the scroll container.

### 4.5 Hardcoded pixel geometry in JSX (P2)
```tsx
// service-data-item.tsx:439-445
style={{
  height: '120%',
  width: 'auto',
  transform: 'translate(-15%, 15%)',
  opacity: 0.3,
```
A decorative watermark sized in percentages *of the list row*, so its aspect and crop change with row height and with the row's translated text wrapping. No token, no scale.

### 4.6 Tables without column alignment discipline (P2)
`services-dashboard.tsx:338-420` is the only real `<table>` in the panel and it is hand-rolled (`<table className="w-full text-xs">`), not the `Table` primitive (`src/pc/components/ui/table.tsx`). Header cells are `text-left` for Service/Version and `text-right` for CPU/Memory/Disk (`:341-355`), matching the body — good — but the Disk body cell is a nested flex (`:402`) whose baseline does not match the adjacent right-aligned numeric cells, so the Disk column reads 2px lower than CPU/Memory.

---

## 5. Form UX

### 5.1 No visible focus indicator on text inputs (P0)
```tsx
// src/pc/components/ui/input.tsx:12
'flex h-9 w-full rounded-lg border border-divider bg-background dark:bg-content3 px-3 py-1 text-sm ... focus-visible:outline-none focus:border-divider disabled:...'
```
`focus:border-divider` sets the border to the *same* `--divider` colour it already has — a 0-delta focus state. `outline-none` removes the platform ring. Every sibling primitive does it correctly (`select.tsx` `focus:ring-2 focus:ring-focus`, `textarea.tsx` `focus-visible:ring-1 focus-visible:ring-ring`, `button.tsx` `focus-visible:ring-2 focus-visible:ring-focus`), so this is an Input-specific regression. It affects every in-scope form: `PathConfigView.tsx:153`, `EnvironmentVariablesView.tsx:176,184`, `AliasesConfigView.tsx:208,216`, `AutoChdirView.tsx:142`, `ProjectDirectoryView.tsx:184`, `NginxConfigView.tsx:367`, `DnsmasqConfigView.tsx:237`, `HostManagementView.tsx:504,514,524,562`, `ca-init-dialog.tsx` (7 inputs), `issue-certificate-dialog.tsx` (3), `PipConfigView.tsx:109`, `VenvView.tsx:242,252`, `service-data-item.tsx:650,694`, `add-service-data-menu.tsx:536`, `service-data-list.tsx:147`.

There is not a single `focus-visible:` or `focus:ring` utility anywhere in the panel outside one error-state override at `mongodb-service.tsx:1216`.

### 5.2 Validation feedback is toast-only except where it is browser-native (P1)

| Screen | Mechanism | Evidence |
|---|---|---|
| Host add/edit | imperative `toast.error` + regex check, then `required`-free inputs | `HostManagementView.tsx:183-193` |
| SSL CA init | **native HTML** `required`/`min`/`max` on a `<form onSubmit>` | `ca-init-dialog.tsx:41,76,84,96,121,135,148,160` |
| SSL issue cert | native `required`/`min`/`max` | `issue-certificate-dialog.tsx:98,115` |
| Python create venv | `toast.error` + trim check | `VenvView.tsx:136-139` |
| Custom service rows | **no validation at all** — empty keys/values are silently dropped at save | `PathConfigView.tsx:60`, `EnvironmentVariablesView.tsx:77`, `AliasesConfigView.tsx:109` |
| Nginx / Dnsmasq path | **no validation at all** | `NginxConfigView.tsx:203-226`, `DnsmasqConfigView.tsx:101-118` |

The silent-drop case is the worst: add three env rows, leave two keys blank, press Save → `toast.success('Env vars saved')` and the blank rows simply vanish (`EnvironmentVariablesView.tsx:76-91`). The user is told the save succeeded, with no indication that their input was discarded.

### 5.3 Required-field marking is inconsistent (P1)
- `HostManagementView.tsx:503,513,561` — asterisk in the label (`IP 地址 *`), no `required` attribute.
- `ca-init-dialog.tsx` / `issue-certificate-dialog.tsx` — real `required` attribute, **no** visual marker.
- `custom-service/*` — neither.
- `VenvView.tsx:241` — neither.

### 5.4 Disabled-until-valid logic is inverted in one place (P1)
```tsx
// PathConfigView.tsx:137-143
<Button variant="outline" size="sm" onClick={addPath}
  disabled={!isServiceDataActive && isLoading}   // ← should be || 
```
When the service is inactive and nothing is loading, this is `true && false`… precisely: `!false && false = false` → **enabled**. So the button lets the user append path rows whose inputs are then `disabled={isLoading || !isServiceDataActive}` (`:158`) — rows of dead, unclickable inputs. The three sibling views use the correct rule (`EnvironmentVariablesView.tsx:164`, `AliasesConfigView.tsx:196`, `AutoChdirView.tsx:136`).

Two other disabled-state gaps:
- `PipConfigView.tsx:116-124` — the Apply button's `disabled` never reacts to the field being empty/unchanged: `disabled={isLoading || !isServiceDataActive}` while the handler guards with `onClick={() => config?.indexUrl && setIndexUrl(...)}` (`:119`). The button looks enabled and does nothing.
- `DnsmasqConfigView.tsx:194-225` — start/stop/restart are gated only on `serviceStatus`, never on `isServiceActive`, unlike every other service view.

### 5.5 Save semantics (P1)
- `HostManagementView.tsx:256-260,301-305,348-352` — save/del/toggle all fire through the same password-interception flow, so **toggling a switch can raise a modal password prompt** mid-interaction. The switch already flipped optimistically (`:459` → `handleToggle`), and on failure it is not rolled back (contrast: `AutoChdirView.tsx:72,76` does roll back).
- `NginxConfigView.tsx:203-226` — save button is disabled when `editingConfigPath === configPath` (`:378`), i.e. no feedback that a save is unnecessary beyond a greyed button; `DnsmasqConfigView.tsx:259` uses the same trick with no visual explanation.
- No screen implements unsaved-changes guarding: type a path in `PathConfigView.tsx`, switch service in the sidebar (`service-data-list.tsx:212`), and the edit is lost silently.

### 5.6 Placeholder-as-label (P2)
`PathConfigView.tsx:156` uses only `placeholder="/usr/local/bin"` with no `<Label>` and no `aria-label` — screen readers announce an unlabelled text field. Same in `AutoChdirView.tsx:145` (`/path/to/project`), `ProjectDirectoryView.tsx:187`, `service-data-item.tsx:650,696`, `DnsmasqConfigView.tsx:241`.

### 5.7 Number inputs are constrained in the markup but not in the handler (P2)
```tsx
// issue-certificate-dialog.tsx:108-117
<Input id="validityDays" type="number" value={validityDays}
  onChange={(e) => setValidityDays(parseInt(e.target.value))}
  min={1} max={825} required />
```
`parseInt` is applied with no clamp and no `NaN` guard; `parseInt('')` is `NaN`, which React renders as an empty number input, and `parseInt('99999')` is accepted by state (the `max` only affects spinner/step validation, which the form does not consult because submission is a custom handler at `:48`). Same in `ca-init-dialog.tsx:128-137` with `min={365} max={7300}`. There is no `step` on either, and no port field, IP field, or numeric field anywhere in the panel has an input-mode or pattern hint.

### 5.8 Secret fields have no reveal toggle (P1)
14 password inputs in the panel (13 outside scope + in-scope ones):

| In scope | Reveal toggle? |
|---|---|
| `service-data-item.tsx:694-704` (sudo password) | ❌ |
| `HostManagementView.tsx:562-575` (sudo password) | ❌ |
| `mysql-service/index.tsx:1252` (DB password) | ✅ `aria-label={showPassword ? … }` |

So the one screen that got it right is a DB service screen, and both sudo-password prompts a user hits constantly in the host/custom flows have no reveal and no "show" affordance.

### 5.9 Config content is not editable anywhere, and dnsmasq's is loaded and thrown away (P0)
```tsx
// dnsmasq-service/DnsmasqConfigView.tsx:9
import { Textarea } from '@/components/ui/textarea'   // never rendered
// :56-57
const [configContent, setConfigContent] = useState('')
const [isSaving, setIsSaving] = useState(false)      // setConfigContent/setIsSaving: never read
// :72-73
if (res.success && res.data?.content) { setConfigContent(res.data.content) ... }
```
`tsc --noUnusedLocals` confirms all three are dead. The screen shows a "配置文件设置 / Configuration File Settings" card (`:229-266`) that only manages the *path*; the file's contents are fetched on every mount (`:71`) and never displayed. The only `Textarea` in the entire panel is an unused import, and no textarea or config preview anywhere carries `font-mono`.

Nginx is the closest to an editor: it parses the config and renders read-only rows (`NginxConfigView.tsx:398-442`) inside `font-mono` spans, but the parser is explicitly documented as unreliable in its own comments (`:135-165`: *"非常简化的解析，不支持嵌套大括号的完美匹配"*, `serverBlocks`/`currentBlock`/`serverRegex` all unused) and on failure invents data:
```tsx
// NginxConfigView.tsx:181-187
} else {
  // 如果没找到 listen，可能在 include 文件中，或者默认 80
  config.servers.push({ listen: ['80 (Default)'], serverName: ['localhost'] })
}
```
i.e. if parsing finds nothing it *displays* `80 (Default)` / `localhost` as if it were the real config. A user debugging a broken nginx config sees fabricated values with no "could not parse" state.

---

## 6. Interaction states & accessibility

### 6.1 Accessibility attributes are essentially absent (P1)
```
grep -rn "aria-" src/pc/pages/env-panel   → 1 hit (mysql-service/index.tsx:1260)
```
Across 35 files and ~15 forms there is exactly one ARIA attribute. Consequences:

- **Icon-only buttons with no accessible name.** `size="sm"` + `h-7 w-7 p-0` produces a button whose only content is an `<svg>`. Examples: `service-data-item.tsx:582-589` (the `MoreHorizontal` menu trigger — the primary per-service actions entry point, no `title`), `service-data-list.tsx:154-164` (close search, no `title`), `ssl-service/certificate-list.tsx:142-148` (delete certificate, no `title`), `python-service/VenvView.tsx:303-309` (venv actions menu, no `title`), `ssl-service/ca-install-guide.tsx:47,63,90,106,135,152` (six copy buttons, no `title`). Screen readers announce "button" with no purpose.
- **`title` is used as a substitute for `aria-label`** in many places (`service-data-item.tsx:554,570`, `NginxConfigView.tsx:380,390`, `DnsmasqConfigView.tsx:248`, `ssl-service/index.tsx:200`…). `title` is not reliably announced and never on keyboard focus in WKWebView.
- **Dialogs**: `DialogTitle`/`DialogDescription` presence is good — all four in-scope dialogs supply both (`ca-init-dialog.tsx:70-73`, `issue-certificate-dialog.tsx:84-87`, `VenvView.tsx:234-237`, `service-data-item.tsx:643-646`). The one gap is the name-input dialog at `VenvView.tsx:242` and the host form at `HostManagementView.tsx:503-530`, which use `<Label htmlFor>` correctly but rely on it for the only naming.

### 6.2 Click targets under 24px (P2)
```tsx
// HostManagementView.tsx:464-481
<Button variant="ghost" size="sm" ... className="h-5 w-5 p-0">   // 20×20 edit
<Button variant="ghost" size="sm" ... className="h-5 w-5 p-0 text-danger ..."> // 20×20 delete
```
```tsx
// VenvView.tsx:209-217
<Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground ...">  // 20×20 refresh
```
```tsx
// service-data-list.tsx:154-164
className="absolute right-1 top-1/2 ... h-6 w-6 p-0"   // 24×24 clear-search
```
```tsx
// ssl-service/index.tsx:250-263
className="h-6 px-2 text-xs ..."   // expand/collapse, 24px tall
```
20×20 is below both the 24px WCAG 2.5.8 minimum and the 44px Apple HIG target. The delete button at `:478` is additionally styled `hover:bg-danger/10` with **no confirm dialog** (see §5.12/Summary #12) — the smallest, riskiest control in the panel.

### 6.3 Color-only status signalling (P1)
```tsx
// NginxConfigView.tsx:294-302 (identical in DnsmasqConfigView.tsx:183-191)
<div className={cn("w-2 h-2 rounded-full",
  serviceStatus === ServiceStatus.Running ? " bg-success" :
  serviceStatus === ServiceStatus.Stopped ? " bg-danger" : " bg-content4")} />
<span className="text-xs font-normal text-muted-foreground">
  {serviceStatus === ServiceStatus.Running ? '运行中' : …}
</span>
```
An 8×8px dot (4px in the DB screens: `h-1 w-1`, e.g. `mongodb-service.tsx:1481`) is the sole pre-attentive status channel. The text is present but is (a) 8px away from the dot, (b) hardcoded Chinese in the two in-scope screens, and (c) `text-muted-foreground` so it reads as secondary even when it says "Running". There is no `aria-live`, no icon shape difference (a filled circle for running vs. a ring for stopped), and no `role="status"` — the whole status area is decorative to assistive tech.

`service-data-item.tsx:387-416` does better (repeats the text and prefixes a `·`), but still signals by colour only.

### 6.4 `text-muted-foreground` contrast on the surfaces it sits on (P1/P2)
`--muted-foreground` is `--c-label2-l` = `0 0% 50.2%` (`global.css:38,82`) and `--c-label2-d` = `0 0% 59%` (`:39,118`), described in the source as macOS `secondaryLabelColor`.

| Pair | Ratio | Verdict |
|---|---|---|
| `#808080` (50.2%) on `content1` `#FFFFFF` | ≈ 3.95:1 | fails AA for the 10–12px text that dominates this panel (needs 4.5:1) |
| `#808080` on `background` `--n-98` `#FAFAFA` | ≈ 3.85:1 | fails |
| `#808080` on `content3` `--n-95` `#F3F3F3` | ≈ 3.6:1 | fails |
| `#969696` (59%) on `--n-12` `#1F1F1F` (dark) | ≈ 5.3:1 | passes |
| `#E5E5E5` (`text-default`, 90.2%) on `content1` `#FFFFFF` | ≈ 1.17:1 | **effectively invisible** (`services-dashboard.tsx:384,396,413`) |

Since 81 `text-[10px]` and 430 `text-xs` nodes in this panel are `text-muted-foreground`, the "not running / no value / --" states at 10px, 50% grey, on white are the least readable text in the product. The dark theme is fine; the light theme is not.

### 6.5 Keyboard order in rows (P1)
- `service-data-item.tsx:420-435` — the row is a `<div>` with `onClick` and no `role`, `tabIndex`, or `onKeyDown`. Selecting a service is **mouse-only**; the row is not focusable and not reachable by keyboard. Hover-revealed actions (`:537-543`, `opacity-0 group-hover:opacity-100`) are invisible until pointer entry, so a keyboard user cannot even see them without hovering.
- `HostManagementView.tsx:427-433` — same pattern (row `<div>`, no focus).
- `ssl-service/certificate-list.tsx:114-167` — the trigger wraps the row and contains two `<Button>`s; `CollapsibleTrigger` renders a `<button>`, producing `<button><div>…<button>…</button></div></button>`. Nested interactive elements are invalid HTML and undo the intended focus order (the inner delete button is inside the outer toggle's activation area).
- `issue-certificate-dialog.tsx:154-157` — SAN removal is `<X className="h-3 w-3 cursor-pointer" onClick={…} />` inside a `Badge` (`<div>`): not focusable, no keyboard equivalent, 12×12px target. A user who added a SAN by keyboard cannot remove it without a mouse.

### 6.6 Switch semantics (P2)
`HostManagementView.tsx:455-462` pairs `<Label htmlFor={`switch-${host.id}`}>启用</Label>` with `<Switch id={`switch-${host.id}`} />` — correct. But `PipConfigView.tsx:190-195` puts the `Switch` label in a Tooltip-wrapped `<div className="cursor-help">` (`:175`) rather than a `htmlFor`, so the alias toggle has no programmatic label; and `AutoChdirView.tsx:133-137` / `ProjectDirectoryView.tsx:275-279` use a `<Label>` that is not associated with the switch at all. Every switch in the panel also carries an ad-hoc class override (`PipConfigView.tsx:194` `data-[state=unchecked]:bg-content4…`, `HostManagementView.tsx:461` `origin-right` — a transform origin on an element that never scales, i.e. a no-op).

---

## 7. i18n risk

### 7.1 Three screens bypass i18n entirely while their keys already exist (P0)
`useTranslation` is absent from `nginx-service/NginxConfigView.tsx`, `dnsmasq-service/DnsmasqConfigView.tsx`, `host-service/HostManagementView.tsx` (and their 16-line `index.tsx` wrappers, which is harmless). Every user-facing string in them is a Chinese literal. Meanwhile the locale files are complete and key-parity-checked (1412 keys in both `en.json` and `zh.json`, 0 missing on either side):

```json
"nginx_service": { "start_success": "Nginx service started successfully", "service_control": "Service Control", "running": "Running", "config_file_label": "Configuration File", … }
"dnsmasq_service": { "service_control": "Service Control", "config_path_label": "Configuration file path (dnsmasq.conf)", "macos_resolver_hint": "…<0>/etc/resolver</0>…", … }
"host_service": { "hosts_notice": "Manage domain mappings…", "add_host": "Add Host", "ip_label": "IP Address *", "admin_required_title": "Administrator Privileges Required", … }
```
So an English-locale user opening Nginx, Dnsmasq or Hosts sees a fully translated header and sidebar ("Services", "Add Service") and then an untranslated Chinese form. This is a functional localization failure, not a polish issue.

Note `dnsmasq_service.macos_resolver_hint` even contains the `<0>` Trans placeholder that matches the exact `<span className="font-mono">/etc/resolver</span>` in the hardcoded JSX (`DnsmasqConfigView.tsx:170`) — the translation was clearly written against this component and never wired.

### 7.2 Hardcoded strings inside otherwise-i18n screens (P2)
| File:line | Literal |
|---|---|
| `service-data-list.tsx:134` | `Servs` — the sidebar's primary title, not a translation key, and not a word |
| `service-data-item.tsx:259` | `toast.error('请输入密码')` — Chinese toast in an otherwise English screen |
| `service-data-item.tsx:223` | `res?.message?.includes('密码错误')` — control flow keyed on a Chinese backend string |
| `HostManagementView.tsx:103,217,272,292,317,339` | same `'密码错误'` substring protocol (in a fully-Chinese screen, so lower risk, but it couples UI flow to a message literal) |
| `add-service-data-menu.tsx:214,218,260` | `` toast.error(`获取 ${serviceType} 版本列表失败: …`) `` — three Chinese template literals in the add-service flow |
| `nginx-service/NginxConfigView.tsx:407,418,425,429` | `Error Log`, `Server Blocks`, `Listen:`, `Server Name:` — English literals in a Chinese screen (reverse mix) |
| `ssl-service/certificate-list.tsx:136` | `title="打开证书文件夹"` — Chinese tooltip in an i18n screen (`ssl_service.open_folder_failed` exists) |

### 7.3 Layouts that will break under longer translations (P1)
- `services-dashboard.tsx:344-353` — fixed `w-16`/`w-20`/`w-28` table columns (see §4.3).
- `env-panel-header.tsx:25-30` — the service name and version are in one `<h2>` with `&nbsp;&nbsp;` as the separator and no truncation: a long service name plus version wraps the header title onto two lines and pushes the AI button (`:40-50`) out of vertical alignment. `service-data-list.tsx:476` truncates the same data (`truncate`), so the two headers handle overflow differently.
- `HostManagementView.tsx:405-414` — two `h-7 px-2 text-xs` buttons side by side in a `flex gap-2` with no `flex-wrap`; "Add Host" / "打开 hosts" become "Host hinzufügen" / "Hosts-Datei öffnen" and overflow the card (`:386`) which has no `min-w-0`.
- `ssl-service/index.tsx:299-308` — `ssl_service.issue_new_cert` next to the heading with `justify-between` and no wrap.
- `PipConfigView.tsx:128-166` — four quick-set buttons plus a label in `flex flex-wrap gap-2` at `h-6 text-[10px]`: at 10px these survive longer text only because the font is tiny; at the design base size they would wrap into 3 rows.

### 7.4 Duplicate DOM ids across sibling dialogs (P2)
```tsx
// ca-init-dialog.tsx:127
<Label htmlFor="validityDays">…</Label> … <Input id="validityDays" …>
// issue-certificate-dialog.tsx:107
<Label htmlFor="validityDays">…</Label> … <Input id="validityDays" …>
```
Both dialogs are mounted simultaneously by `ssl-service/index.tsx:322,331`, so the document contains two `#validityDays`. `htmlFor` resolves to the first match in DOM order, meaning clicking the CA-init label can focus the certificate dialog's field.

---

## 8. Additional correctness/UX defects surfaced by the audit

| # | Sev | Finding | Evidence |
|---|---|---|---|
| 8.1 | P1 | Adding an alias/env-var row whose key and value are both blank, then saving, silently discards the row and reports success | `AliasesConfigView.tsx:108-123`, `EnvironmentVariablesView.tsx:76-91` |
| 8.2 | P1 | Nginx config parser fabricates `listen 80 (Default)` / `serverName localhost` when it finds nothing, and the parse state is never surfaced | `NginxConfigView.tsx:181-187`, `:135-165` |
| 8.3 | P1 | Host toggle flips the switch optimistically and does not roll back on failure (its own sibling `AutoChdirView` does) | `HostManagementView.tsx:309-353` vs `AutoChdirView.tsx:70-77` |
| 8.4 | P2 | `console.log('zws nginx start')` / `zws startServiceData result` / `zws nginx start finally` left in shipped code | `NginxConfigView.tsx:230,234,244` |
| 8.5 | P2 | Dead code: unused `Textarea`/`Save`/`FileText` imports and 3 unused state vars (dnsmasq), 8 unused imports + 4 unused locals (nginx), 2 unused imports ×2 (custom-service); whole file dead | `DnsmasqConfigView.tsx:9,45,56,57`; `NginxConfigView.tsx:4,8,15,17,19,20,21,22,80,140,143,156`; `PathConfigView.tsx:6,7`; `EnvironmentVariablesView.tsx:6,7`; `AutoChdirView.tsx` (no importer) |
| 8.6 | P2 | `AutoChdirView.tsx` duplicates `ProjectDirectoryView.tsx` exactly (same `autoChdirPath`/`autoChdirEnabled` metadata, same `handleToggle`/`handleApply` bodies) but labels the save button differently (`custom_service.dir_saved` vs `custom_service.project_saved`) and lacks the ProjectDirectory tooltips. It is never imported — a maintenance fork waiting to diverge | `AutoChdirView.tsx:1-165` vs `ProjectDirectoryView.tsx:1-286`; `grep -rn AutoChdirView src/` → only its own file |
| 8.7 | P2 | `<Switch className="origin-right">` is a no-op (no transform scale on the switch) | `HostManagementView.tsx:461` |
| 8.8 | P2 | Redundant `dark:` variants that repeat the base value, bloating class strings and hiding which value actually wins | `PipConfigView.tsx:185` `text-muted-foreground dark:text-muted-foreground`; `services-dashboard.tsx:380,392` `text-foreground dark:text-foreground`; `ca-install-guide.tsx:30` `text-success dark:text-success`; `service-data-item.tsx:485` `text-success dark:text-success`; `HostManagementView.tsx:440` `bg-content2 dark:bg-content2`; `DnsmasqConfigView.tsx:165-167` `bg-warning/10 dark:bg-warning/10 border-warning/30 dark:border-warning/20` |

---

## 9. What is already consistent (do not "fix" these)

- **Card container**: `p-3 rounded-xl border border-divider bg-content1` — 17 identical occurrences across every in-scope screen (list in §1 row 1). This is the de-facto group primitive; promote it, do not replace it per-screen.
- **Radii discipline**: in scope, only `rounded-lg` (60), `rounded-xl` (54), `rounded-full` (24), `rounded-md` (17) plus bare `rounded` (40). No `rounded-sm`/`rounded-2xl` drift, no `rounded-[7px]`-style one-offs.
- **Shadow discipline**: zero `shadow-*` in the panel; `shadow-pop` remains exclusive to floating layers.
- **Toast as the error channel**: all nine screens use `toast.error` for operation failures. The divergence is only in *validation*, not in *failure reporting*.
- **Dialog titles/descriptions**: all four in-scope dialogs supply `DialogTitle` + `DialogDescription`.
- **`cancel`/`confirm` vocabulary**: every dialog footer uses `common.cancel` and either `common.save`/`common.confirm` consistently per dialog.
- **Locale key parity**: `en.json` and `zh.json` are exactly aligned at 1412 keys each. The i18n debt is in the components, not the catalogs.

---

## 10. Recommended priority order (for the fix pass, not performed here)

1. **P0 i18n** (§7.1): wire the three hardcoded screens to their existing locale keys. Largest user-visible win for the least design judgement.
2. **P0 dnsmasq editor** (§5.9): either render the loaded `configContent` in the imported `Textarea` with `font-mono`, or delete the dead load path and label the screen as path-only.
3. **P0 focus ring** (§5.1): one line in `src/pc/components/ui/input.tsx` — replace `focus:border-divider` with the `focus-visible:ring-2 focus-visible:ring-focus` already used by `select`/`textarea`/`button`.
4. **P1 surface normalisation** (§2): replace `bg-white dark:bg-content1/40` with a real step; delete the contradictory `service-data-item.tsx:429-431` string; fix `text-default` status text.
5. **P1 label/copy bugs** (§5.4 #11, §5.3, §5.8): wrong save label in two views, inverted disabled rule, host delete confirmation, password reveal.
6. **P1 a11y** (§6.1–6.3): `aria-label` + `title` on the ~20 unnamed icon buttons, keyboard-activatable list rows, shape+text (not colour alone) for service status.
7. **P2 typography/spacing** (§3.3, §4.2, §4.3): introduce one hint size (12px) to retire 81 `text-[10px]`, unify card rhythm on `space-y-3`, drop table cell fixed widths.
