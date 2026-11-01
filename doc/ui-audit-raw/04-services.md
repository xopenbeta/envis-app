# 04 · Service configuration screens (MySQL / MariaDB / PostgreSQL / MongoDB / Redis / Node.js / Java / Rust / NASM)

**Scope (9 files, 9,181 lines).** These are the largest and most duplicated screens in the repo.

| file | lines | md5 |
| --- | --- | --- |
| `src/pc/pages/env-panel/service-data-panel/mysql-service/index.tsx` | 1634 | `1c70b53197de684266cfd546ae2777f4` |
| `src/pc/pages/env-panel/service-data-panel/mariadb-service/index.tsx` | 1607 | `0a5fa19bacab15d4d0f7b25abf93f859` |
| `src/pc/pages/env-panel/service-data-panel/postgresql-service/index.tsx` | 1626 | `53600cb93a5719c14ee01b909b910f8a` |
| `src/pc/pages/env-panel/service-data-panel/mongodb-service.tsx` | 1995 | `49477f822e1f461da2827bf74d31330a` |
| `src/pc/pages/env-panel/service-data-panel/redis-service/index.tsx` | 584 | `850411b3e54339b2959dce8c62876ecb` |
| `src/pc/pages/env-panel/service-data-panel/nodejs-service/index.tsx` | 509 | `3c22d89e13a134a0f5adc9d6a7673193` |
| `src/pc/pages/env-panel/service-data-panel/java-service.tsx` | 1046 | `67e021cdb0c4626f748454a6d04bc689` |
| `src/pc/pages/env-panel/service-data-panel/rust-service.tsx` | 156 | `c59aa1d41bba5cd22704723367970434` |
| `src/pc/pages/env-panel/service-data-panel/nasm-service/index.tsx` | 29 | `e175cdc8163e1b9ae0d0ee94a2e1a2f6` |

Adjacent shared files cited as context, not as separate scope: `env-panel.tsx` (router), `env-panel-header.tsx`
(the title bar above all 9 screens), `components/ui/{input,button,card,badge,alert,dialog,label}.tsx`.

**Snapshot.** Verified against the working tree at **2026-09-25 01:05 CST**, git `HEAD = 8ea75f1`
(dirty tree: 22 modified files, `doc/design/` + `doc/ui-audit-raw/` untracked). Line numbers are 1-based and
were re-read after writing.

**Method.**
* Class/token claims are not eyeballed. A real Tailwind build was produced from this exact tree and checked for
  the presence of each suspect selector:
  `./node_modules/.bin/tailwindcss -c <copy of tailwind.config.js> -i src/global.css -o /tmp/twtest/out.css`
  (tailwindcss 3.4.19). Result: `border-dialogBorder`, `bg-content1`, `text-content1-foreground`, `rounded-*`,
  `shadow-pop` all emit; `bg-default-100`, `text-default-500`, `border-dialog-border` emit **zero CSS**.
  (None of the 9 files use the missing forms — so there is **no P0 broken-class** finding in this scope;
  the foundation report `01-foundation.md` owns that class of bug.) No `shadow-*` other than `shadow-pop`
  is used in any of the 9 files (grep for `shadow-` → 0 hits).
* Contrast ratios are computed from the literal HSL values in `src/global.css` (relative-luminance formula,
  alpha compositing where a `/10` fill is involved).
* i18n claims are machine-checked: every `t('<key>')` literal in the 9 files was resolved against
  `src/pc/i18n/locales/{en,zh}.json` (namespace-aware), and every namespace entry was checked for use.
* Duplication is quantified by normalising service identifiers (`mysql|mariadb|postgresql|mongodb|redis`,
  `*_service.*` keys) and running `difflib.SequenceMatcher` over non-blank lines.

Read-only audit. The only file written is this report.

---

## Summary

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| 1 | **P0** | 14 `t()` keys resolve to nothing → raw key strings rendered to the user (Redis 13, MongoDB 1) | `redis-service/index.tsx:263,372,401,509,516,523,530,578` + toasts `:200,205,485`; `mongodb-service.tsx:1709,1847` |
| 2 | **P0** | Text inputs are filled with `bg-content1`, i.e. **the same surface as the card they sit in** → 1.00:1 fill contrast; the only cue is a `border-divider` outline at ~1.07:1 | `redis-service/index.tsx:344,386,406,427,437`; `nodejs-service/index.tsx:263,327,368`; `java-service.tsx:597,615,780,810,882,978,1024`; `rust-service.tsx:95,113`; `mongodb-service.tsx:1215` |
| 3 | P1 | Destructive-action confirmation diverges three ways; Redis's data-destroying reset shows **no irrecoverable warning at all** although the copy exists in both locales | `redis-service/index.tsx:535-581` (no `Alert`, no `reset_irrecoverable`) vs `mysql-service/index.tsx:695-787`, `mariadb-service/index.tsx:691-785`, `postgresql-service/index.tsx:732-824`, `mongodb-service.tsx:940-1090`, `mongodb-service.tsx:420` (`window.confirm`) |
| 4 | P1 | Confirmation dialogs pre-fill from the *other* dialog's live state — one shared `dialogData` object for init **and** reset | `mysql-service/index.tsx:71,611,696`; `mariadb-service/index.tsx:68,607,693`; `postgresql-service/index.tsx:75,648,733`; `mongodb-service.tsx:111,795,942`; `redis-service/index.tsx:72,487,535` |
| 5 | P1 | Redis initialises with **no client-side validation** and its start/stop/restart have **no `catch`** → failures are silent | `redis-service/index.tsx:175-209` (no `password_required` check), `211-252` (no `catch`) vs `mysql-service/index.tsx:563,505-558` |
| 6 | P1 | Ports are free-text `<input>`; **0 of 9 files** use `type="number"`, `inputMode`, `min`, `max` or `pattern` — a port can be `"abc"` | `mysql-service/index.tsx:645,742`; `postgresql-service/index.tsx:683`; `mongodb-service.tsx:1006`; `redis-service/index.tsx:498,546` |
| 7 | P1 | `focus-visible:ring-danger` emits **no ring** (verified: `ring-<color>` alone sets only `--tw-ring-color`), so the invalid config path has no focus/error cue beyond the border | `mongodb-service.tsx:1216` |
| 8 | P1 | Every `<Input>` in all 9 screens has no visible keyboard focus indicator (`focus-visible:outline-none` + `focus:border-divider` = the resting border colour) | `components/ui/input.tsx:12-13` (cross-ref `03-env-panel.md` #5) |
| 9 | P1 | Privilege chips hardcode English `'Read'`/`'ReadWrite'` in the two MySQL-family panels while PostgreSQL/MongoDB use translated keys | `mysql-service/index.tsx:854,904,968,1018`; `mariadb-service/index.tsx:1261,1313,1377,1427` vs `postgresql-service/index.tsx:1289`, `mongodb-service.tsx:1777` |
| 10 | P1 | Light-theme text tokens fail WCAG AA on the surfaces they are actually used on: muted-foreground 3.95:1, warning-on-`warning/10` 2.84:1, danger 3.32:1, success 3.00:1 | `src/global.css:83,90,92` (light) and `:119,126,128` (dark) used at `mysql-service/index.tsx:1072`, `java-service.tsx:695,712,722`, `nodejs-service/index.tsx:211` |
| 11 | P1 | When the service is inactive, Redis/Node/Java/Rust disable their whole form and **never say why**; the four SQL panels render one of four labelled empty states | `rust-service.tsx:90,106`; `java-service.tsx:614,809`; `nodejs-service/index.tsx:262,367`; `redis-service/index.tsx:461,480` vs `mysql-service/index.tsx:1298-1304,1589-1601,1623-1627` |
| 12 | P1 | Typography runs at 12px/10px, not the 13px base; `text-xs` (296) outnumbers `text-sm` (50) ~6:1, and section headings (12px) are **smaller** than the body copy they head (13px) | census below; inversion at `mysql-service/index.tsx:1608` (heading `text-xs`) vs `:1600` / `:1625` (body `text-sm`) |
| 13 | P1 | Config data (paths, ports, host, bind IP, db names) is **not** monospace, while the masked password, npm package names and tooltip env-var names are | `mysql-service/index.tsx:1532` (`font-mono` on password only); 0 `font-mono` in `redis-service/index.tsx`, `nasm-service/index.tsx` |
| 14 | P1 | **No log/console viewer exists** in any of the 9 screens: 0 `whitespace-pre*`, 0 `<pre>`, 0 copy/clear/wrap affordance. "Log file" is a read-only path plus a Finder button | `mysql-service/index.tsx:1199-1222`; `mongodb-service.tsx:1295-1331` |
| 15 | P1 | 34–44% of all `dark:` utilities are no-ops: value-identical to their light class, or `bg-content1/40` over a `bg-content1` parent | `mysql-service/index.tsx:1112` (+13), `mongodb-service.tsx:1144` (+19), `java-service.tsx:597` (+12) |
| 16 | P1 | `div onClick` rows are not keyboard-operable (no `tabIndex`/`role`/`onKeyDown` in any of the 9 files) | `mysql-service/index.tsx:1348`; `mariadb-service/index.tsx:1040`; `postgresql-service/index.tsx:1070`; `mongodb-service.tsx:1450`; `nodejs-service/index.tsx:488` |
| 17 | P1 | Same callout rendered three ways: primitive-conformant `<Alert>`, hand-rolled `<Alert className="p-2">` + inner flex, and a bare `<div>` | `nodejs-service/index.tsx:202,219` vs `mysql-service/index.tsx:710` vs `java-service.tsx:994` |
| 18 | P1 | Icon-only buttons are named only by a native `title` (17×) or not at all (5×); the whole scope contains **one** `aria-label` | unnamed: `nodejs-service/index.tsx:404-412,416-423`; `java-service.tsx:654-661`; `rust-service.tsx:98-103`; the one: `mysql-service/index.tsx:1260` |
| 19 | P1 | Java renders raw backend task identifiers (`pending`/`installing`/`failed`) into the UI while the translated `*_download_status` keys sit unused | `java-service.tsx:713,933`; unused keys `java_service.maven_download_status`, `gradle_download_status` |
| 20 | P1 | Java's Maven flow has 4 lifecycle branches, Gradle only 3 — a freshly downloaded Gradle dumps the user into an editable `GRADLE_HOME` box with no initialize action | `java-service.tsx:728-751` (Maven "not initialized") has no Gradle counterpart between `:908` and `:949` |
| 21 | P2 | Click targets under 24×24: 20×20 `h-5 w-5` row/reveal buttons and ≈18px privilege chips | `mysql-service/index.tsx:1543,1564,1573`; `mariadb-service/index.tsx:1513,1536,1545`; `postgresql-service/index.tsx:1535,1557,1566`; `mongodb-service.tsx:1615,1642,1651`; chips `mysql-service/index.tsx:846,960` |
| 22 | P2 | `bg-white/5` / `dark:hover:bg-white/10` raw palette (17×) **and** the parent database row hovers on a different surface per file (`content2` vs `background`), erasing the nesting cue in MySQL | `mysql-service/index.tsx:1345,1375,1555`; `mariadb-service/index.tsx:1040,1070,1525`; `postgresql-service/index.tsx:1070,1546`; `mongodb-service.tsx:1450,1479` |
| 23 | P2 | Dead imports left by copy-paste: MongoDB 10, Node 5, Java 4, Redis 1 | `mongodb-service.tsx:5,6,15,16,21,36,55`; `nodejs-service/index.tsx:1,5`; `java-service.tsx:4,5,8,9`; `redis-service/index.tsx:8` |
| 24 | P2 | Node.js passes hardcoded Chinese as `defaultValue` for 5 i18n keys → Chinese leaks into any locale missing the key | `nodejs-service/index.tsx:205,211,472,473,494` |
| 25 | P2 | Panel-card class drift: 5 spellings of "a bordered surface", including one at `rounded-md` (8px) where every peer uses `rounded-xl` (12px) | `mysql-service/index.tsx:1090`; `nodejs-service/index.tsx:236`; `java-service.tsx:581`; `redis-service/index.tsx:302`; `nasm-service/index.tsx:23` |
| 26 | P2 | Bare `border` with no colour token (falls back to `--border`); two of the four copies of the permission-list container omit `border-divider` while two include it | `mysql-service/index.tsx:827,941` (omit) vs `:1339,1553` (include) |
| 27 | P2 | Copy-paste residue: 7 empty `className=""` per SQL panel, 3 in Redis; genuinely duplicated boolean | `mysql-service/index.tsx:677,728,765,921,1034,1055,1487`; `mariadb-service/index.tsx:673,724,761,1180,1330,1443,1464`; `redis-service/index.tsx:321,325,329,480` (`!isServiceActive \|\| !isServiceActive`) |
| 28 | P2 | Section headings are `<Label>` (a form-label primitive) and no settings-form label carries `htmlFor`; Redis and Node have no `htmlFor` anywhere | `mysql-service/index.tsx:1092,1148,1318,1505,1608`; `redis-service/index.tsx` (0 `htmlFor`) |
| 29 | P2 | Path editing diverges: only Redis opens a real OS file picker; MySQL/MariaDB/PostgreSQL force read-only paths with no way to enter one; the Save affordance is a conditionally-rendered text button (Redis) vs a persistent icon button (MongoDB) | `redis-service/index.tsx:110,366-376`; `mysql-service/index.tsx:1155-1170`; `mongodb-service.tsx:1219-1228` |
| 30 | P2 | Config-load failures are swallowed to `console.error` with no state, so a failed read renders blank fields with no error; there is **no** `error` state variable in any of the 9 files | `mysql-service/index.tsx:292-297`; `redis-service/index.tsx:149-161`; `java-service.tsx:216-226` |
| 31 | P2 | NASM (a download-managed compiler toolchain, peer of Rust) ships a 29-line stub: no status, no controls, no PATH/config, no install state | `nasm-service/index.tsx:15-28` vs `rust-service.tsx:66-146` |
| 32 | P2 | Shared header above all 9 screens uses a button-foreground token as body text, `hover:underline` on a non-interactive `<h2>`, and spaces the version with two `&nbsp;` | `env-panel-header.tsx:25,27-29` |

---

## Cross-screen divergence table

Legend: **SQL4** = mysql / mariadb / postgresql / mongodb. Cell = `value (file:line)`. `—` = absent.
`✓` = byte-identical modulo service name.

### A. Shell, header, status, lifecycle

| Pattern | MySQL | MariaDB | PostgreSQL | MongoDB | Redis | Node.js | Java | Rust | NASM |
|---|---|---|---|---|---|---|---|---|---|
| Root wrapper | `p-3` `:608` | `p-3` `:604` | `p-3` `:646` | `p-3` `:792` | `w-full p-3 space-y-3` `:298` | `w-full p-3 space-y-3` `:200` | `w-full p-3 space-y-3` `:579` | `w-full p-3 space-y-3` `:67` | `w-full p-3 space-y-3` `:15` |
| Inner content wrapper | `w-full space-y-3` `:1063` | `w-full space-y-3` `:785` | `w-full space-y-3` `:825` | `w-full space-y-3` `:1093` | — (root doubles) | — | — | — | — |
| Panel card class | `p-3 rounded-xl border border-divider bg-content1` `:1090` | ✓ `:811` | ✓ `:852` | ✓ `:1120` | `p-3 rounded-xl border border-divider bg-content1 space-y-3` `:302` | `w-full p-3 space-y-3 rounded-xl border border-divider bg-content1` `:236` | `w-full p-3 space-y-4 rounded-xl …` `:581` | same as Java `:68` | `rounded-md border border-divider bg-content1 p-3 text-xs …` `:23` |
| Panel card count | 5 | 5 | 5 | 5 | 4 | 2 | 5 | 1 | 1 |
| Status indicator | `w-2 h-2 rounded-full` + label `:1096-1104` | ✓ `:819-825` | ✓ `:857-863` (single quotes) | ✓ `:1126-1134` | ✓ `:309-316` (no `font-normal`) | — | — | — | — |
| Running colour | `bg-success` `:1098` | ✓ `:820` | ✓ `:858` | ✓ `:1128` | ✓ `:311` | — | — | — | — |
| Stopped colour | `bg-danger` `:1099` | ✓ `:821` | ✓ `:859` | ✓ `:1129` | ✓ `:312` | — | — | — | — |
| Unknown colour | `bg-content4` `:1099` | ✓ `:821` | ✓ `:859` | ✓ `:1129` | ✓ `:312` | — | — | — | — |
| Status label keys | `mysql_service.{running,stopped,unknown_status}` `:1102` | same shape `:824` | same shape `:862` | **`status.service.{running,stopped,unknown}`** `:1132` | same shape as SQL `:315` | — | — | — | — |
| start/stop/restart | ✓ 3 buttons `:1109-1142` | ✓ `:835-864` | ✓ `:873-900` | ✓ `:1141-1174` | ✓ `:321-332` | — | — | — | — |
| Action button class | `gap-1 h-8 text-xs bg-content1 dark:bg-content1/40 border-divider` `:1112` | ✓ `:837` | ✓ `:875` | ✓ `:1144` | `""` (empty) + `&nbsp;` spacing `:321-331` | — | — | — | — |
| `catch` on start/stop | ✓ toast | ✓ | ✓ | ✓ | **none** `:211-252` | — | — | — | — |
| Inactive-service explanation | 4-branch empty state `:1298-1304,1439-1445,1589-1601,1623-1627` | ✓ | ✓ | ✓ `:1978-1994` | none (buttons just disabled) | none | none | none | none |
| Install/download gating | none | none | none | none | `isInstalled` `:58` + disabled `:321` | none | `isMavenInstalled`/`isGradleInstalled` `:688,908` | none | none |

### B. Configuration form

| Pattern | MySQL | MariaDB | PostgreSQL | MongoDB | Redis | Node.js | Java | Rust |
|---|---|---|---|---|---|---|---|---|
| Label position | above `:1153` | above `:875` | above `:911` | above `:1194` | above `:339` | above `:242` | above `:585` | above `:75` |
| Label element | `<Label className="text-xs font-medium text-foreground">` (`:1153`) | ✓ | ✓ | ✓ + `cursor-help` + `<Tooltip>` `:1198` | ✓ `:339` | ✓ + Tooltip + Info icon `:241` | ✓ + Tooltip `:585` vs plain `:604` | ✓ + Tooltip `:75` |
| Label → control gap | `mt-1` `:1154` | `mt-1` `:876` | `mt-1` `:912` | `mt-1` `:1208` | `mt-1` `:340` | inline `space-y-2` `:257` | inline `space-y-2` | inline `space-y-2` |
| Help text under label | — | — | — | — | — | `text-[10px] … mt-1 mb-2` `:250` | `text-[10px] … mt-1 mb-2` `:589` | `text-[10px] … mt-1 mb-2` `:85` |
| Group rhythm | `space-y-4` `:1150` | `space-y-4` `:871` | `space-y-4` `:848` | `space-y-4` `:1182` | `grid gap-3` `:337` | `space-y-3` `:236` | `space-y-4` `:581` | `space-y-4` `:68` |
| Group separator | `pt-2 border-t border-divider` `:1175` | ✓ `:897` | ✓ `:933` | — (none) | `pt-2 border-t border-divider space-y-3` `:379` | — | — | — |
| Read-only control fill | `bg-content2 cursor-not-allowed` `:1159` | ✓ `:881` | ✓ `:917` | ✓ `:1265,1303,1340,1348` (`bg-content2`) | **`bg-content1 dark:bg-content1/40`** `:386` | **same** `:263` | **same** `:780` | **same** `:95` |
| Editable control class | none → base `h-9 text-sm bg-background dark:bg-content3` (dialogs only) | same | same | `bg-content1 … h-8` `:1215` | `bg-content1 … h-8` `:344` | `bg-content1 … h-8` `:263` | `bg-content1 … h-8` `:615` | `bg-content1 … h-8` `:113` |
| Config path editing | `readOnly` `:1157` | `readOnly` `:879` | `readOnly` `:915` | editable + Save `:1210` | editable + picker + Save `:342-376` | editable + Apply | editable + Apply | editable + Apply |
| Directory picker | Finder reveal only `:1189` | Finder reveal only `:911` | Finder reveal only `:946` | Finder reveal only `:1286` | **`ipcOpenSelectDialog()`** `:110` | — | Finder reveal only `:657` | Finder reveal only `:101` |
| Port edit site | dialog only, read-only in card `:1237` | ✓ `:957` | ✓ `:990` | ✓ `:1344` | dialog only `:435` | — | — | — |
| Required-field gating | `disabled={… \|\| !dialogData.rootPassword}` `:672,771` | ✓ `:668` | ✓ `:762` | ✓ `:1073` | **none** `:530` | `disabled={isInstalling}` `:458` | `disabled={!mavenRepository \|\| …}` `:816` | `disabled={isLoading \|\| !isActive}` `:111` |
| Validation toast | `password_required` `:563` | ✓ `:559` | ✓ `:584` | `init_input_required` `:686` | **none** | — | — | — |
| Password reveal in card | ✓ `:1249-1267` | — (only in user list `:1504-1518`) | — | — | — | — | — | — |
| `htmlFor` count | 9 (dialogs only) | 9 | 9 | 8 | **0** | **0** | 0 | 0 |

### C. Data display, log output, i18n

| Pattern | MySQL | MariaDB | PostgreSQL | MongoDB | Redis | Node.js | Java | Rust | NASM |
|---|---|---|---|---|---|---|---|---|---|
| Section heading element | `<Label>` ×4 `:1092,1148,1318,1505,1608` | `<Label>` ×4 | `<Label>` ×4 | `<Label>` ×4 | `<Label>` ×1 `:473` | none | none | none | `<AlertTitle>` `:17` |
| Heading size | `text-xs font-medium` (12px) | ✓ | ✓ | ✓ | ✓ | n/a | n/a | n/a | `font-medium` (13px) |
| Privilege-chip label | hardcoded `'Read'` `:854` | hardcoded `:1261` | `t('…privilege_read')` `:1289` | `t('mongodb.role_read')` `:1777` | n/a | n/a | n/a | n/a | n/a |
| Permission list container | `border rounded-lg … max-h-40` (no colour `:827`), `max-h-48` `:941`, `border-divider` `:1339,1553` | `max-h-40` `:1234` | `max-h-40` `:1262` | `max-h-40` `:1750` | — | — | — | — | — |
| DB/table row hover | `hover:bg-content2 dark:hover:bg-white/10` `:1345,1375` | `hover:bg-background dark:hover:bg-white/5` `:1040` | same as MariaDB `:1070` | same as MariaDB `:1450` | — | — | — | — | — |
| Row padding | `p-1.5` `:1345` | `p-1  ` (double space) `:1040` | `p-1` `:1070` | `p-1` `:1450` | — | — | — | — | — |
| Empty state | `py-6 … border border-dashed border-divider` ×4 | ✓ | ✓ | ✓ ×3 | none | `py-6 bg-content1` `:470` | none | none | `<Alert>` `:17` |
| Log / console viewer | **none** | **none** | **none** | **none** | **none** | **none** | **none** | **none** | **none** |
| `font-mono` uses | 1 (password mask `:1532`) | 1 `:1502` | 1 `:1524` | 1 `:1604` | **0** | 1 (package badge `:491`) | 5 (tooltip env names) | 2 (tooltip env names) | 0 |
| Tooltip primitive | **0** | **0** | **0** | 9 | **0** | 25 | 41 | 17 | 0 |
| native `title=` | 5 | 3 | 5 | 4 | 5 | 0 | 1 | 0 | 0 |
| `text-[10px]` / `text-[11px]` | 6 / 1 | 6 / 1 | 6 / 1 | 6 / 1 | 0 / 1 | 10 / 0 | 15 / 4 | 3 / 0 | 0 / 0 |
| Used-but-undefined i18n keys | 0 | 0 | 0 | 1 (`common.create`) | **13** | 0 (3 rely on `defaultValue`) | 0 | 0 | 0 |
| Defined-but-unused i18n keys | 3 | 2 | 0 | 2 | **20** | 2 | 4 | 4 | 0 |
| Dead `dark:` utilities | 24 / 43 | 24 / 43 | 24 / 43 | 30 / 49 | 13 / 19 | 18 / 24 | 31 / 43 | 5 / 5 | 0 |
| Unused imports | 0 | 0 | 0 | 10 | 1 | 5 | 4 | 0 | 0 |
| Locked-state message | yes | yes | yes | yes | **no** | **no** | **no** | **no** | n/a |

---

## Findings

### 1 · P0 — 14 i18n keys resolve to nothing; Redis shows raw key strings on screen

The Redis panel references 13 keys that exist in **neither** `en.json` nor `zh.json`. i18next is initialised with
no `parseMissingKeyHandler` / `returnEmptyString` (`src/pc/i18n/config.ts:10-25`), so i18next falls back to the
key itself and the literal key is painted into the DOM.

```
redis-service/index.tsx:263   {t('redis_service.checking_init')}
redis-service/index.tsx:372   title={t('redis_service.save_title')}
redis-service/index.tsx:401   <Label …>{t('redis_service.data_dir_label')}</Label>
redis-service/index.tsx:509   <Label>{t('redis_service.persistence_label')}</Label>
redis-service/index.tsx:516   <span>{t('redis_service.enable_rdb')}</span>
redis-service/index.tsx:523   <span>{t('redis_service.enable_aof')}</span>
redis-service/index.tsx:530   … {isLoading ? t('redis_service.processing') : t('redis_service.confirm_init')}
redis-service/index.tsx:578   … {isLoading ? t('redis_service.processing') : t('redis_service.confirm_reset')}
```
Toast-only (also missing, less visible): `:200` `reset_success`, `:205` `init_error`,
`:485` `client_open_failed_msg`, `:121` `config_path_set_success`, `:123` `config_path_set_failed`.
Verified: `zh.json` `redis_service` has 57 keys and none of the 13 is among them
(`node -e "…Object.keys(z.redis_service)"` → no `data_dir_label`, `persistence_label`, `enable_rdb`,
`enable_aof`, `confirm_init`, `processing`, `checking_init`, `save_title`).

MongoDB has one:
```
mongodb-service.tsx:1709  t('common.create')     ← confirms creating a database
mongodb-service.tsx:1847  t('common.create')     ← confirms creating a user
```
`common` in both locales is `{cancel, confirm, loading, save, saving, edit, delete, unknown_error}` — no `create`.

**Why it is wrong.** The user sees a label reading `redis_service.data_dir_label` above a path field, two
checkbox rows labelled `redis_service.enable_rdb` / `redis_service.enable_aof`, and a confirm button reading
`redis_service.confirm_init`, plus buttons reading `common.create`. This is the "visibly broken" bar.

**Root cause (quantified).** Redis's copy was never synced with its own locale namespace: **13 used-but-undefined
keys and 20 defined-but-unused keys** in the same 57-entry namespace. In particular the panel defines copy it
never renders — `reset_irrecoverable`, `running_warning`, `running_warning_text`, `password_required`,
`service_not_active`, `service_not_active_config`, `activate_service_hint`, `host_label`, `port_from_config`,
`not_configured`, `open_config_dir_title`, `show_advanced`, `hide_advanced`, `start_init`, `resetting`,
`local_access_note`, `initializing`, `not_initialized_short`, `complete_init`, `service_not_active_hint`.
Every other namespace is within ±4 keys, so this is a Redis-only desync, not a repo-wide one.

### 2 · P0 — Text fields are filled with the same surface as their parent card

```
redis-service/index.tsx:344   className="flex-1 h-8 text-xs bg-content1 dark:bg-content1/40 border-divider"
redis-service/index.tsx:386   className="flex-1 h-8 text-xs bg-content1 dark:bg-content1/40 border-divider"   (disabled)
redis-service/index.tsx:406   same   redis-service/index.tsx:427   same   redis-service/index.tsx:437   same
nodejs-service/index.tsx:263,327,368   className="flex-1 h-8 text-xs bg-content1 dark:bg-content1/40 border-divider"
java-service.tsx:597,615,780,810,882,978,1024   className="text-xs h-8 bg-content1 dark:bg-content1/40 border-divider"
rust-service.tsx:95,113   className="text-xs h-8 bg-content1 dark:bg-content1/40 border-divider"
mongodb-service.tsx:1215  "flex-1 h-8 text-xs bg-content1 dark:bg-content1/40 border-divider"
```
Each of these `<Input>`s sits inside a card that is itself `bg-content1`
(e.g. `redis-service/index.tsx:336` `p-3 rounded-xl border border-divider bg-content1 space-y-3`).
`--content1` is `0 0% 100%` light / `0 0% 12.5%` dark (`src/global.css:71` and `:107`). A 40 %-alpha
copy of a colour painted over the identical colour composites to that same colour, so
`dark:bg-content1/40` over `bg-content1` is a no-op too.

**Computed.** Fill-on-fill contrast = **(1.00:1)** — literally indistinguishable. The only remaining cue is the
inherited `border-divider`: `#FFFFFF` vs `#F4F4F4` light → **1.07:1**; `#1F1F1F` vs `#282828` dark → **1.12:1**.
Both are far below the 3:1 WCAG non-text-contrast minimum for UI component boundaries.

**Why it is wrong.** These are the *only* form controls in the section, and in light mode they look like plain
white panel background. The intended token is `content2` (control fill, `src/global.css:72`) — which is exactly what
MySQL/MariaDB/PostgreSQL use for their read-only fields (`mysql-service/index.tsx:1159`
`bg-content2 cursor-not-allowed`). MongoDB is inconsistent **within one file**: 4 read-only fields use
`bg-content2 cursor-not-allowed` (`mongodb-service.tsx:1265,1303,1340,1348`) and 1 uses `bg-content1` (`:1215`).

Note the disabled fields additionally lose the `cursor-not-allowed` affordance (`:386,406,427,437` use bare
`disabled` with no cursor class), whereas the SQL panels pair `disabled`/`readOnly` with it.

### 3 · P1 — Destructive confirmation has three different implementations; Redis's data wipe carries no warning

| file | dialog | danger title | irrecoverable copy | warning `Alert` | confirm button |
|---|---|---|---|---|---|
| MySQL `:695-787` | Radix `Dialog` | `text-danger` + `AlertTriangle` `:699` | `<span className="text-danger font-semibold">{t('mysql_service.reset_irrecoverable')}</span>` `:705` | `<Alert variant="destructive" className="p-2">` `:710` | `variant="destructive"` `:769`, disabled while running `:771` |
| MariaDB `:691-785` | ✓ | ✓ `:695` | ✓ `:701` | ✓ `:706` | ✓ `:765` |
| PostgreSQL `:732-824` | ✓ | ✓ `:735` | ✓ `:741` | ✓ `:746` | ✓ `:805` |
| MongoDB `:940-1090` | ✓ | ✓ `:944` | ✓ `:950` | ✓ `:956` | ✓ `:1073` |
| Redis `:535-581` | Radix `Dialog` | `DialogTitle` **without** `text-danger`/icon `:538` | **absent** | **absent** | `variant="destructive"` `:578` |

Redis defines the warning text it does not show:
```
en.json → redis_service.reset_irrecoverable   = "This action cannot be undone!"
en.json → redis_service.running_warning       = "Redis is running, please stop the service before resetting"
en.json → redis_service.running_warning_text  = "Redis is running! Please stop Redis before resetting."
```
Confirmed unused: `grep -n 'reset_irrecoverable\|running_warning' redis-service/index.tsx` → no matches
(line 284 is the only `warning` hit in the file and it is the init CTA colour). So a user resetting Redis
deletes its data directory after reading only the neutral `DialogDescription`
(`redis-service/index.tsx:539-541`), while a user resetting MySQL, MariaDB, PostgreSQL or MongoDB gets an explicit
danger-coloured, icon-marked "irrecoverable" line — for the *same* class of action.

Redis is also the only one of the five whose destructive confirm is enabled with **everything empty**
(`disabled={isLoading}` `:578`); the SQL panels require the new admin password
(`mysql-service/index.tsx:771` `!dialogData.rootPassword`, MongoDB `:1073` both username and password).
For Redis, an empty form silently means "keep the current config" (`:182-184` pass `|| undefined`), so the
irrecoverable reset ships with no deliberate input at all.

**MongoDB additionally** confirms user deletion through the OS-native blocking dialog:
```
mongodb-service.tsx:420   if (!confirm(t('mongodb.user.delete_confirm', { username: username }))) return
mongodb-service.tsx:1652  onClick={() => handleDeleteUser(user.user)}
```
while MySQL `:1042-1060`, MariaDB `:1451-1470` and PostgreSQL `:1476-1495` use a Radix `Dialog` with
`DialogTitle … text-danger` + `<Trash2>` + `variant="destructive"` confirm. Within MongoDB the two destructive
paths disagree with each other as well (reset = Radix Dialog, delete user = `window.confirm`).

### 4 · P1 — Init and reset dialogs share one live state object, so one prefills the other

```
mysql-service/index.tsx:71-76   const [dialogData, setDialogData] = useState({ rootPassword: '', port: '3306', bindAddress: '127.0.0.1', showAdvanced: false })
mysql-service/index.tsx:611     <Dialog open={showInitDialog} …>   … dialogData.rootPassword  (:626)
mysql-service/index.tsx:696     <Dialog open={showResetDialog} …>  … dialogData.rootPassword  (:724)
```
Identical in MariaDB (`:68,607,693`), PostgreSQL (`:75,648,733`), MongoDB (`:111,795,942` — `adminUsername`,
`adminPassword`, `port`, `bindIp`, `enableReplicaSet`, `showAdvanced`) and Redis
(`:72-78,487,535` — `password`, `port`, `bindIp`, `rdbEnabled`, `aofEnabled`).

**Why it is wrong.** Both dialogs render the *same* field as if it were new: MySQL labels the reset copy
`new_root_password_label` (`:720`) while it is bound to the value already typed into the init dialog's
`root_password_label` (`:623`). The `showAdvanced` disclosure is also shared, so toggling Advanced in the init
dialog silently opens Advanced in the (separate, later, destructive) reset dialog — a one-click path to changing
the bind address during a data wipe. Neither `onOpenChange` handler resets the object
(`:611`/`:696` pass the setter straight through; Redis's does too at `:487`/`:535`), unlike the create-user
dialog, which *does* clear its form on close: `mysql-service/index.tsx:789-792`
`setShowCreateUserDialog(open); if (!open) setUserForm({…})`.

### 5 · P1 — Redis has no client-side validation and no error handling on lifecycle actions

```
redis-service/index.tsx:175   const handleInitialize = async (reset: boolean) => {
redis-service/index.tsx:176     if (!isServiceActive) return
redis-service/index.tsx:182-188 initializeRedis(…, dialogData.password || undefined, dialogData.port || undefined, …)
```
There is no `password_required` check, no port check, no toast guard — yet `redis_service.password_required`
("Please enter a password") is present in both locales and **unused**.
Compare:
```
mysql-service/index.tsx:562-565   if (!dialogData.rootPassword) { toast.error(t('mysql_service.password_required')); return }
mariadb-service/index.tsx:558     same
postgresql-service/index.tsx:583  if (!dialogData.superPassword) { toast.error(t('postgresql_service.password_required')); return }
mongodb-service/index.tsx:685     if (!dialogData.adminUsername || !dialogData.adminPassword) { toast.error(t('mongodb.init_input_required')); return }
```

Separately, Redis's three lifecycle handlers have no `catch`:
```
redis-service/index.tsx:211   const handleStart = async () => {
redis-service/index.tsx:214     const res = await startServiceData(selectedEnvironmentId, serviceData)
redis-service/index.tsx:216     if (res?.success) { toast.success(…) } else { toast.error(…) }
redis-service/index.tsx:221   } finally { setIsStarting(false) }
```
No `catch (error)`. If the IPC call rejects, the spinner clears and the user gets **no feedback at all**, and the
rejection is unhandled. MySQL/MariaDB/PostgreSQL/MongoDB each wrap the same three calls in
`try/catch` + `toast.error` (`mysql-service/index.tsx:507-558`; `sed -n '/const startService = async/,/^  }/p'`
→ `catch` count 1 for all four, 0 for Redis).

### 6 · P1 — Ports are unconstrained free text

`grep -n 'type="number"\|inputMode\|min=\|max=\|pattern=' <9 files>` → **0 hits in all 9 files**.
Every port field is a plain text `<Input>`:
```
mysql-service/index.tsx:645-650    <Label htmlFor="init-port"> … <Input id="init-port" value={dialogData.port} onChange={…} placeholder="3306" />
mysql-service/index.tsx:742-749    reset-port, same shape
postgresql-service/index.tsx:683   postgres-init-port, same shape
mongodb-service.tsx:1006           reset-port, same shape
redis-service/index.tsx:498        <Input value={dialogData.port} onChange={…} placeholder="6379" />
redis-service/index.tsx:546        reset dialog, same shape
```
`redis-service/index.tsx:435` then renders the port back through `String(runtimeConfig.port)` with no validation.
A user can submit `"3306abc"`, `"-1"` or `"99999"`; the only feedback is whatever the backend returns, and
§5 shows Redis does not even do that reliably. The brief's "one shows a port validation error and another does
not" is the case here in its strongest form: **none** of the nine validates, and the two panels that surface any
error at all (`mysql`, `mariadb`, `postgresql`, `mongodb`) only check for emptiness.

### 7 · P1 — `focus-visible:ring-danger` never renders

```
mongodb-service.tsx:1214-1217
  className={cn(
    "flex-1 h-8 text-xs bg-content1 dark:bg-content1/40 border-divider",
    mongoConfig?.parseError && " border-danger focus-visible:ring-danger"
  )}
```
Verified against tailwindcss 3.4.19 source: the `ringColor` core plugin
(`node_modules/tailwindcss/lib/corePlugins.js:3868-3889`) emits **only** the custom properties
`--tw-ring-color`/`--tw-ring-opacity`; the `box-shadow` that consumes them comes from the separate `ringWidth`
plugin (`ring`, `ring-2`, …). No `ring`/`ring-<n>` utility appears in this class string, and the project hash no
global `ring` default, so `focus-visible:ring-danger` contributes zero declarations to the focus state.
The invalid config path therefore gets a red border but the intended danger focus ring silently does nothing.

### 8 · P1 — No input in any of the 9 screens shows keyboard focus

```
components/ui/input.tsx:12-13
  'flex h-9 w-full rounded-lg border border-divider bg-background dark:bg-content3 px-3 py-1 text-sm … focus-visible:outline-none focus:border-divider disabled:cursor-not-allowed disabled:opacity-50'
```
`border-divider` is the *resting* border and `focus:border-divider` re-declares it, so focusing an input changes
nothing but the removed outline. Corroborating counts inside the 9 files: `focus-visible` → 1 occurrence total
(the dead one in §7), `focus:` → 0.
This is the same root cause filed as #5 in `03-env-panel.md`, recorded here because every editable field on
these nine screens uses this primitive, and because §7's dead ring is a *second, independent* focus failure.

### 9 · P1 — Privilege chips are English-only in the MySQL family

```
mysql-service/index.tsx:854    {priv === 'SELECT' ? 'Read' : 'ReadWrite'}
mysql-service/index.tsx:904    {db}: {priv === 'ALL PRIVILEGES' ? 'ReadWrite' : 'Read'}
mysql-service/index.tsx:968    {priv === 'SELECT' ? 'Read' : 'ReadWrite'}
mysql-service/index.tsx:1018   {db}: {priv === 'ALL PRIVILEGES' ? 'ReadWrite' : 'Read'}
mariadb-service/index.tsx:1261,1313,1377,1427   identical four lines
```
The PostgreSQL and MongoDB peers translate the same two values:
```
postgresql-service/index.tsx:1289  {priv === 'SELECT' ? t('postgresql_service.privilege_read') : t('postgresql_service.privilege_read_write')}
mongodb-service.tsx:1777           {role === 'read' ? t('mongodb.role_read') : t('mongodb.role_read_write')}
```
Machine-checked: `en.json` has `postgresql_service.privilege_read/privilege_read_write` and
`mongodb.role_read/role_read_write` = `"Read"`/`"ReadWrite"`, but the namespaces `mysql_service` and
`mariadb_service` contain **no** `privilege_*` key at all. So in a Chinese session the privilege chips in the
MySQL/MariaDB create-user and edit-user dialogs render English `Read` / `ReadWrite` while the identical chips in
PostgreSQL/MongoDB render `只读` / `读写` (or the locale's equivalent). This is a locale leak that is visible in
four places per panel, i.e. eight places across the scope.

### 10 · P1 — Light-theme text tokens fail WCAG AA on their real surfaces

Computed from `src/global.css` (relative luminance; `/10` fills alpha-composited over `content1`):

| token | on | ratio | used at (example) |
|---|---|---|---|
| `text-muted-foreground` (`0 0% 50.2%`) | `content1` `#FFF` | **3.95:1** | every secondary string in the scope, incl. `nodejs-service/index.tsx:250`, `java-service.tsx:589`, `mysql-service/index.tsx:1101` |
| `text-warning` (`32 95% 44%`) | `bg-warning/10` over `content1` | **2.84:1** | `mysql-service/index.tsx:1072`, `java-service.tsx:695,915` |
| `text-danger` (`0 84% 60%`) | `bg-danger/10` over `content1` | **3.32:1** | `nodejs-service/index.tsx:207-215` |
| `text-success` | `bg-success/10` over `content1` | **3.00:1** | grant chips `mysql-service/index.tsx:850` |
| `text-muted-foreground` | `content1` dark | 5.63:1 ✅ | — |
| `text-warning` dark (`43 96% 56%`) | `content1` dark | 9.80:1 ✅ | — |
| `text-danger` | `content1` dark | 4.38:1 ❌ (marginal) | — |

AA requires 4.5:1 for normal text. All of these strings are 10–13 px (`text-[10px]`, `text-[11px]`, `text-xs`),
i.e. unambiguously "normal" size, so the 3:1 large-text exemption does not apply. The practical impact is worst
for the warning callouts, which are the *only* instruction a user gets before an irreversible reset
(`mysql-service/index.tsx:1069-1074` sets both the title at `text-xs` and the body at `text-[11px]` in
`text-warning`) — the least readable text in the scope carries the most consequential copy.

Dark mode is fine for `muted`/`warning`, so this is a light-theme-only regression, not a token-design failure.

### 11 · P1 — Locked-out state is explained in four panels and unexplained in five

The four SQL panels teach the user why the screen is inert, with four mutually different messages:
```
mysql-service/index.tsx:1600   <p className="text-sm">{t('mysql_service.service_not_running')}</p><p className="text-xs">{t('mysql_service.start_first')}</p>
mysql-service/index.tsx:1599   … 'mysql_service.not_initialized_short'  /  'mysql_service.complete_init'
mysql-service/index.tsx:1597   … 'mysql_service.service_not_active_users' / 'mysql_service.cannot_manage_users'
mongodb-service/index.tsx:1984 … 'mongodb.service_inactive' / 'mongodb.cannot_use_other_ops'
```
Redis, Node.js, Java and Rust instead just disable their controls:
```
rust-service.tsx:90     disabled={!isActive}                      (CARGO_HOME input)
rust-service.tsx:106    disabled={isLoading || !isActive}          (Apply)
java-service.tsx:614    disabled={!isServiceDataActive}
java-service.tsx:809    disabled={!isServiceDataActive}
nodejs-service/index.tsx:262   disabled={isLoading || !isServiceDataActive}
nodejs-service/index.tsx:367   disabled={isLoading || !isServiceDataActive}
redis-service/index.tsx:461    disabled={!isServiceActive || !isInstalled || serviceStatus !== ServiceStatus.Running}
redis-service/index.tsx:480    disabled={!isServiceActive || !isServiceActive || !isInstalled || isLoading || …}
```
No string, icon, tooltip or `title` anywhere tells the user *why*. The locale even has the copy for it —
`redis_service.service_not_active` ("Service not activated"), `activate_service_hint`,
`service_not_active_config` — all three unused (§1). Node.js is the only one of the four that has an empty-state
block at all, and it is for the *package list* (`nodejs-service/index.tsx:470-474`), not for the disabled form
above it.

Consequences beyond confusion: Redis is the only one of the five that also has a status indicator
(`:309-316`), so in Rust/Java/Node the user has **no** indication of the service's state and **no** way to change
it inside the panel — the only activation affordance lives in the service list, which nothing in these screens
mentions.

### 12 · P1 — Typography: 12px body, 10px secondary, and inverted heading hierarchy

Census across the 9 files (`grep -oh 'text-…' | sort | uniq -c`):

| class | px | count |
|---|---|---|
| `text-xs` | 12 | 296 |
| `text-[10px]` | 10 | 52 |
| `text-sm` | 13 | 50 |
| `text-[11px]` | 11 | 9 |
| `text-base` / `text-lg` / `text-[9px]` / `text-[12px]` | — | 0 in these files |

Weights: `font-medium` 93, `font-semibold` 14, `font-mono` 12, `font-normal` 7, `font-bold` 0.

`tailwind.config.js` overrides `fontSize.sm = ['13px','20px']` ("macOS native base"), which the brief restates as
the base. In practice the dominant size on these nine screens is **12px** (296 uses vs 50), so the design's base
size is effectively not used here, and 61 strings are rendered at 10–11 px — 77–85 % of the stated base.

The heading hierarchy is *inverted*: section headings are `text-xs` (12px, `font-medium`) while the sentences
they head are `text-sm` (13px):
```
mysql-service/index.tsx:1608   <Label className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-2">{t('mysql_service.other_operations')}</Label>
mysql-service/index.tsx:1600   <p className="text-sm">{t('mysql_service.service_not_running')}</p>
mysql-service/index.tsx:1625   <p className="text-sm">{t('mysql_service.service_not_active_config')}</p>
```
The only genuinely larger type on these screens is the shared 16px `text-base` page title
(`env-panel-header.tsx:25`) and the 18px `text-lg` dialog titles (`components/ui/dialog.tsx:75`).
Per-role `text-[10px]` usage (all 52 lines classified; the categories below are mutually exclusive and
sum to 52): **8** interactive privilege chips (`mysql-service/index.tsx:846,960`), **8** selected-grant badges
(`mysql-service/index.tsx:902,1016`), **4** "ADMIN" pills (`mysql-service/index.tsx:1528`), **4** masked admin
password values (`mysql-service/index.tsx:1532`, `mariadb-service/index.tsx:1502`,
`postgresql-service/index.tsx:1524`, `mongodb-service.tsx:1604`), **4** Java download status/percent strings
(`java-service.tsx:712,722,932,942`), **15** label-help paragraphs (`java-service.tsx:589`,
`nodejs-service/index.tsx:250`, `rust-service.tsx:85` …), **2** uppercase "quick set" section labels
(`nodejs-service/index.tsx:278`, `java-service.tsx:825`), **5** `h-6` quick-set buttons
(`java-service.tsx:831,840,849`, `nodejs-service/index.tsx:284,293`) and **2** `h-6` icon-only buttons
(`nodejs-service/index.tsx:409,420`). The 9 `text-[11px]`
lines are all `text-warning leading-relaxed` "not initialized / not installed" bodies
(`mysql-service/index.tsx:1072`, `java-service.tsx:695,735,915`, `redis-service/index.tsx:273`).

### 13 · P1 — Config content is not monospace, but the password and package names are

Monospace is used for exactly three things, none of them the data the panel is about:
```
mysql-service/index.tsx:1532   <span className="text-[10px] text-muted-foreground font-mono">{serviceData.metadata?.['MYSQL_ROOT_PASSWORD'] ? showPassword ? … : '••••••••' : '—'}</span>
nodejs-service/index.tsx:491   className="font-mono font-normal cursor-pointer"     (npm package name Badge)
java-service.tsx:766,795,868,964,1010   <div className="text-xs font-mono">MAVEN_HOME | M2_HOME</div>   (tooltip env-var names)
rust-service.tsx:81,122          <div className="text-xs font-mono">RUST_HOME</div>
```
Everything that is actually identifier-shaped — config file paths, data dirs, log paths, bind addresses, ports,
database names, table/collection names, GRADLE_HOME, M2 paths — is proportional sans
(`font-family: -apple-system …`, `src/global.css:147`). `redis-service/index.tsx` and `nasm-service/index.tsx` contain
**zero** `font-mono`; the password value is rendered as plain text inside a JSX `<span>`
(`redis-service/index.tsx:553-554`) with no monospace treatment.

**Why it is wrong.** The brief requires monospace for log/console *and* config content. Here the one class of
content where digit/character alignment matters (paths, ports, env values) is the one class excluded, while
opaque npm package names and a stack of bullet masks get the mono treatment — the exact inverse of the intent.

### 14 · P1 — No log or console viewer exists in any of the nine screens

Evidence for absence, not a visual judgement: `grep -c 'whitespace-pre'` → 0 in all 9 files;
`grep -rn 'LogViewer\|ConsoleViewer\|ServiceLog\|<pre'` over all of `src/` → 0 hits. The "log" affordances are:
```
mysql-service/index.tsx:1199-1222   <Label>{t('mysql_service.log_file_label')}</Label> … <Input readOnly value={mysqlConfig?.logPath} …/> … <Button onClick={() => mysqlConfig?.logPath && openFolderInFinder(mysqlConfig.logPath)} title={t('mysql_service.open_dir_title')}><FolderOpen/></Button>
mysql-service/index.tsx:1201        label only; no viewer, no tail, no copy, no clear
mongodb-service.tsx:1295-1331       same shape (mongodb.log_file)
redis-service/index.tsx:381-399     same shape, and the input is `disabled` with no way to open anything but Finder
```
Consequences the brief asked about are therefore all absent by omission rather than mis-implemented: no
monospace (see §13), no background surface, no fixed height, no auto-scroll, no copy/clear, no wrap toggle.
The closest things to an output surface in the scope are list containers — `max-h-40 overflow-y-auto`
(`mysql-service/index.tsx:827`), `max-h-48` (`:941`), `max-h-60` (`nodejs-service/index.tsx:485`) — which are
permission/package lists, not logs.

**Why it is wrong.** A user debugging a failed MySQL/MongoDB start cannot read the error: they must leave the app,
find the path in Finder, open the file in a text editor and match it back to the panel. Every one of the four
database panels surfaces a `parseError`-class failure (§30) with no way to see the underlying output.
Adding a log surface later is also now a 9-file change, because no shared component exists (see the duplication
inventory).

### 15 · P1 — 34–44 % of all `dark:` utilities are no-ops

The semantic tokens are already theme-aware (`src/global.css:63-130`), so a `dark:` variant that names the *same*
token changes nothing. Measured per file (value-identical vs. `bg-content1/40`-over-`content1` no-ops, of total
`dark:` utilities):

| file | value-identical | no-op over `content1` parent | total | share |
|---|---|---|---|---|
| `mysql-service/index.tsx` | 10 | 14 | 43 | **56 %** |
| `mariadb-service/index.tsx` | 10 | 14 | 43 | **56 %** |
| `postgresql-service/index.tsx` | 10 | 14 | 43 | **56 %** |
| `mongodb-service.tsx` | 10 | 20 | 49 | **61 %** |
| `redis-service/index.tsx` | 3 | 10 | 19 | **68 %** |
| `nodejs-service/index.tsx` | 10 | 8 | 24 | 75 % |
| `java-service.tsx` | 20 | 11 | 43 | 72 % |
| `rust-service.tsx` | 3 | 2 | 5 | 100 % |

Concrete examples:
```
mysql-service/index.tsx:1112   bg-content1 dark:bg-content1/40 border-divider        (dark bg == parent card)
mysql-service/index.tsx:1101   text-xs font-normal text-muted-foreground           no dark: variant, but
mysql-service/index.tsx:1099   bg-danger                                            and its peers have
mysql-service/index.tsx:1066   border-warning/30 bg-warning/10 dark:border-warning/30 dark:bg-warning/10
java-service.tsx:1004          text-muted-foreground dark:text-muted-foreground    (11× in this file)
nodejs-service/index.tsx:207   text-danger dark:text-danger                        (3×)
```
The `dark:text-warning` pattern (`mysql-service/index.tsx:1069,1072`; `java-service.tsx` 11×) is the clearest:
`--warning` is *defined differently* per theme (`--c-amber` at `src/global.css:90`, `--c-amber-d` at `:126`), which is precisely the
work the `dark:` variant is duplicating and negating.

### 16 · P1 — Clickable rows are not keyboard-operable

```
mysql-service/index.tsx:1347-1351
  <div
    onClick={() => toggleTables(db.name)}
    className="flex items-center justify-between p-1.5 hover:bg-content2 dark:hover:bg-white/10 rounded-md transition-colors cursor-pointer"
  >
```
Same construct at `mariadb-service/index.tsx:1040`, `postgresql-service/index.tsx:1070`,
`mongodb-service.tsx:1450` (`onClick={() => toggleCollections(db.name)}`). Confirmed absent across the whole
scope: `grep -n 'tabIndex\|role="button"' <9 files>` → **0 hits**. The `onKeyDown` hits that do exist
(`mysql-service/index.tsx:869,983,1478`) are all Enter-to-submit inside dialog inputs, not row activation.

The chevron is a real `<Button>` *inside* the clickable `div` and has no `onClick` of its own:
```
mysql-service/index.tsx:1353-1354
  <Button size="sm" variant="ghost" className="h-5 w-5 p-0 flex-shrink-0 hover:bg-transparent" disabled={db.isLoadingTables}>
```
So the only focusable/keyboard-reachable element in the row is a button that does nothing on its own (its click
bubbles to the `div`), and it deliberately overrides ghost's hover with `hover:bg-transparent`, so keyboard focus
gives neither a visible state change nor a reliable action. `mongodb-service.tsx:1450` has the same structure.

Node.js has the sibling defect in a different primitive:
```
nodejs-service/index.tsx:488-499
  <Badge key={index} variant="outline" className="font-mono font-normal cursor-pointer"
    onClick={() => { navigator.clipboard.writeText(pkg.name); toast.success(…) }}>
```
`Badge` renders a `<div>` (`components/ui/badge.tsx:31`), so this copy-to-clipboard affordance is mouse-only,
has no `title`/`aria-label` explaining that a click copies, and gives no visible affordance beyond
`cursor-pointer`. It also bypasses the app's clipboard helper in favour of `navigator.clipboard` directly.

### 17 · P1 — The same warning callout is built three different ways

| file | markup | padding |
|---|---|---|
| Node.js `:202`, `:219` | `<Alert variant="destructive" className="bg-danger/10 dark:bg-danger/10 border-danger/30 dark:border-danger/20">` with `<AlertTriangle>` as a *direct* child and `<AlertTitle>`/`<AlertDescription>` | primitive default `px-4 py-3` (`components/ui/alert.tsx:7`) |
| MySQL `:710`, MariaDB `:706`, PostgreSQL `:746`, MongoDB `:956` | `<Alert variant="destructive" className="p-2"><div className="flex items-center gap-2"><AlertTriangle/><AlertDescription>…</AlertDescription></div></Alert>` | `p-2` |
| Java `:994` | `<div className="rounded-lg bg-warning/10 dark:bg-warning/10 border border-warning/30 dark:border-warning/30 px-3 py-2.5 text-[11px] text-warning dark:text-warning leading-relaxed">` | `px-3 py-2.5` |

The SQL4 form wraps the icon in a `div`, which **defeats the primitive's own layout rules** — `alert.tsx:7` uses
attribute selectors `[&>svg]:absolute [&>svg~*]:pl-7` that only match direct children. So the same component
renders an absolutely-positioned icon in Node.js and an inline flex icon in the SQL panels, and the SQL panels
additionally shrink padding from `py-3` to `p-2` — a visibly tighter box for the same "this cannot be undone"
message. Java's hand-rolled `div` is the same visual intent with yet another padding and no `role="alert"` at all
(the primitive supplies `role="alert"`; the raw `div` does not).

### 18 · P1 — Icon-only buttons have no accessible name: one `aria-label` in 9 files

```
mysql-service/index.tsx:1260   aria-label={showPassword ? t('mysql_service.hide_password') : t('mysql_service.show_password')}
```
That is the **only** `aria-label` in all 9 files (`grep -c 'aria-label'` → mysql 1, everything else 0).
Every other icon-only button relies on the native `title` attribute, which is not a reliable accessible name and
is not announced as a label by all AT: MySQL `:1167,1192,1217,1566,1578`; MariaDB `:889,914,939`;
PostgreSQL `:922,946,970,1549,1558`; MongoDB `:1225,1645,1654`; Redis `:352,362,394,414`; Java `:657` has **no**
title at all either:
```
java-service.tsx:654-661   <Button size="sm" variant="ghost" onClick={() => openFolderInFinder(javaInfo.home)} className="h-5 w-5 p-0"><FolderOpen className="h-3 w-3" /></Button>
rust-service.tsx:98-103    <Button variant="outline" size="icon" onClick={() => openFolderInFinder(rustHome)} className="h-8 w-8 shrink-0 border-divider"><FolderOpen className="h-3.5 w-3.5" /></Button>
nodejs-service/index.tsx:404-412   <Button size="sm" variant="ghost" onClick={loadGlobalPackages} disabled={isLoadingPackages} className="h-6 px-2 text-[10px]"><RefreshCw className={…}/></Button>
nodejs-service/index.tsx:416-423   <Button size="sm" variant="ghost" disabled={isLoadingPackages} className="h-6 px-2 text-[10px]"><Plus className="h-3 w-3" /></Button>
```
Rust and Java's reveal buttons announce as "button" with no name; Node.js's refresh/add buttons likewise.
(`grep -c 'title=' nodejs-service/index.tsx` → 0; `rust-service.tsx` → 0.)

The rich tooltip primitive is used in only four of nine files, and never in the SQL panels:
`Tooltip` count → MongoDB 9, Node.js 25, Java 41, Rust 17, MySQL/MariaDB/PostgreSQL/Redis **0**, NASM 0.
So the identical "explain this env var" affordance is an accessible Radix tooltip in Java/Rust and a native
`title` in the SQL panels.

### 19 · P1 — Java paints raw backend task identifiers into the UI

```
java-service.tsx:130   const status = String(task?.status || '')      ← "pending" | "installing" | "failed" | "installed"
java-service.tsx:132   setMavenDownloadStatus(status)
java-service.tsx:713   {mavenDownloadStatus}&nbsp;&nbsp;              (rendered at `text-[10px] text-warning`)
java-service.tsx:933   {gradleDownloadStatus}&nbsp;&nbsp;             (same)
```
The user sees the literal token `installing` / `failed` / `cancelled` next to the progress bar, at 10 px, in the
lowest-contrast colour pair in the app (§10). Both locales already carry the intended labels, and both are
**unused**:
```
en.json → java_service.maven_download_status  = "Status"    (defined, 0 references)
en.json → java_service.gradle_download_status = "Status"    (defined, 0 references)
```
The failure path is worse: `java-service.tsx:143` (and `:189`) shows `task?.error_message` verbatim (a raw backend string) with
no wrapping class, in an `Alert`-less `<p className="text-[10px] text-warning dark:text-warning">` (`:712`).
Note also that a `status` label of `"Status"` still would not identify *which* download it belongs to, so the
string itself is under-specified.

### 20 · P1 — Maven and Gradle get different lifecycles inside the same file

```
java-service.tsx:681   {isMavenChecking ? (spinner) : !isMavenInstalled ? (download CTA :688-727)
java-service.tsx:728     : !mavenHome.trim() ? (maven_not_initialized_title + Initialize button :729-751)
java-service.tsx:752     : (config card :753-897)}
java-service.tsx:901   {isGradleChecking ? (spinner) : !isGradleInstalled ? (download CTA :908-947)
java-service.tsx:948     : (config card :949-1039)}          ← no "not initialized" branch
```
The Gradle "Initialize" flow exists in the locale and state machine but has no branch:
`en.json → java_service.gradle_initialize = "Initialize Gradle"`, `gradle_initializing = "Initializing..."`
— both defined, **zero** references in code. Practical effect: after `handleDownloadGradle` reports
`installed` (`:169-180`), the panel renders the GRADLE_HOME field as a **user-editable text input with an Apply
button** (`:972-990`) instead of offering the Initialize action Maven gives. The one path that would have
populated the value is a silent side effect inside the progress poller:
```
java-service.tsx:173-179   const checkRes = await checkGradleInstalled(serviceData.version)
                           const gradleHomePath = (checkRes as any)?.data?.home …
                           if (gradleHomePath) await applyGradleHome(gradleHomePath, false)
```
So the field is either auto-filled by a background poll or left blank for the user to guess — depending on a race.
`isGradleInitializing` has no counterpart variable either, whereas `isMavenInitializing` is wired to the button
(`:748`).

### 21 · P2 — Click targets below the 24×24 minimum

| target | size | location |
|---|---|---|
| row edit / delete / reveal / chevron | `h-5 w-5` = 20×20 | `mysql-service/index.tsx:1354,1543,1564,1573`; `mariadb-service/index.tsx:1049,1513,1536,1545`; `postgresql-service/index.tsx:1079,1535,1557,1566`; `mongodb-service.tsx:1458,1615,1642,1651`; `java-service.tsx:658` |
| privilege chip | `px-2 py-0.5 text-[10px]` ≈ 18 px tall | `mysql-service/index.tsx:846,960`; `mariadb-service/index.tsx:1253,1369`; `postgresql-service/index.tsx:1281,1394`; `mongodb-service.tsx:1769,1884` |
| quick-set registry/repo button | `h-6` = 24 px (borderline) | `nodejs-service/index.tsx:284,293`; `java-service.tsx:831,840,849` |
| package refresh / add | `h-6 px-2` = 24 px | `nodejs-service/index.tsx:409,420` |

The `h-5 w-5 p-0` row buttons are the worst case: 20×20 with a 12 px icon, placed 1 px apart in a row
(`mysql-service/index.tsx:1563-1581`, two buttons in `flex gap-1`). Edit-permissions and delete-user are adjacent
and differ only by icon colour — `hover:text-focus hover:bg-focus/10` vs `hover:text-danger hover:bg-danger/10`
(`:1564` vs `:1573`) — so a 1 px miss is the difference between opening a permissions dialog and arming a
destructive one. The reveal button at `:1543` has an additional dead hover:
`text-muted-foreground hover:text-muted-foreground dark:hover:text-default` — the hover class names the same
colour as the resting class, so it has no hover feedback in light mode at all.

### 22 · P2 — Raw palette hovers and a lost nesting cue

First, raw palette values that bypass the token system (`17` occurrences in 4 files; `0` in Redis/Node/Java/Rust):
```
mysql-service/index.tsx:829    hover:bg-background dark:hover:bg-white/5
mysql-service/index.tsx:943    hover:bg-background dark:hover:bg-white/5
mysql-service/index.tsx:1345   hover:bg-content2 dark:hover:bg-white/10
mysql-service/index.tsx:1375   hover:bg-content2 dark:hover:bg-white/10
mysql-service/index.tsx:1555   hover:bg-background dark:hover:bg-white/5
mariadb-service/index.tsx:1040,1070,1236,1352,1525   same pattern
postgresql-service/index.tsx:1070,1099,1264,1377,1546  same pattern
mongodb-service.tsx:1450,1479,1631,1752,1867           same pattern
```
`bg-white/5` and `bg-white/10` are literal white overlays. In light mode `hover:bg-background` (`--n-98`,
`#FAFAFA`) is *darker* than its `bg-content1` (`#FFF`) parent — the opposite of the "subtle fill" intent — and in
dark mode `bg-white/5` happens to approximate `content4` but is not the token, so it does not track theme changes
to `--content4`.

Second, and more visibly, the parent/child hover pairing that encodes nesting is inconsistent:
```
mysql   db row    :1345  hover:bg-content2 dark:hover:bg-white/10     ← same as its child
mysql   table row :1375  hover:bg-content2 dark:hover:bg-white/10
mariadb db row    :1040  hover:bg-background dark:hover:bg-white/5    ← lighter than its child
mariadb table row :1070  hover:bg-content2 dark:hover:bg-white/10
postgres db row   :1070  hover:bg-background dark:hover:bg-white/5
mongodb row       :1450  hover:bg-background dark:hover:bg-white/5    (onClick row)
mongodb nested    :1479  hover:bg-content2 dark:hover:bg-white/10
```
MySQL is the odd one out: its expandable database row uses the *same* `content2` hover as the table rows nested
inside it, so hovering erases the level distinction the other three panels preserve (parent `background` →
child `content2`). MySQL/PG/MariaDB/MongoDB database rows also disagree on padding (`p-1.5` at
`mysql-service/index.tsx:1345` vs `p-1` at `mariadb-service/index.tsx:1040`,
`postgresql-service/index.tsx:1070`, `mongodb-service.tsx:1450`), so row heights differ between the four panels
by 4 px — visible when switching services. `mariadb-service/index.tsx:1040` additionally contains a double space
inside the class string: `"flex items-center justify-between p-1  hover:bg-background …"`.

### 23 · P2 — Dead imports left behind by the copy-paste

Machine-checked (every braced import specifier searched for outside the import statements):

| file | unused |
|---|---|
| `mongodb-service.tsx` | `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger` (`:5`), `Badge` (`:14`), `Play`, `Square`, `Activity`, `Cpu` (lucide), `useService` (`@/hooks/service`) — 10 |
| `nodejs-service/index.tsx` | `Card`, `CardContent`, `CardHeader`, `CardTitle` (`:1`), `Hexagon` (`:6`) — 5 |
| `java-service.tsx` | `Coffee`, `Package`, `ExternalLink`, `CheckCircle2` (lucide) — 4 |
| `redis-service/index.tsx` | `Settings` (`:8`) — 1 |
| mysql / mariadb / postgresql / rust / nasm | none |

`Tabs` is the strongest signal: MongoDB imports a whole `Tabs` primitive it never renders, in a file that already
has a `{/* MongoDB 状态 */}`-style single-column layout — evidence that a tabbed redesign was started and
abandoned mid-file. `Card` in Node.js is similar: the file imports the card primitive and then hand-rolls
`<div className="w-full p-3 space-y-3 rounded-xl border border-divider bg-content1">` (`:236`), which is what
`Card` (`components/ui/card.tsx:9` = `rounded-xl border bg-content1 text-foreground`) would have given.

### 24 · P2 — Node.js embeds hardcoded Chinese as i18n fallbacks

```
nodejs-service/index.tsx:205   {t('node_service.conflict_manager_title', { defaultValue: '检测到版本管理器冲突' })}
nodejs-service/index.tsx:211   defaultValue: `检测到系统中存在以下 Node.js 版本管理器: ${conflictManagers.join(', ')}。这些工具可能会与当前应用冲突，导致功能异常。`
nodejs-service/index.tsx:472   {t('node_service.service_inactive', { defaultValue: '服务未激活' })}
nodejs-service/index.tsx:473   {t('node_service.activate_to_view_packages', { defaultValue: '请先激活服务以查看全局包' })}
nodejs-service/index.tsx:494   toast.success(t('common.copied', { defaultValue: '已复制到剪贴板' }))
```
No other panel in the scope uses `defaultValue` (`grep -c defaultValue:` → nodejs 5, all others 0). The three
keys `node_service.service_inactive`, `node_service.activate_to_view_packages`, `common.copied` are in fact
missing from both locales, so these fallbacks are **not** dead defensive code — they are the live rendering path.
An English-locale user therefore reads Chinese for the "service not activated" empty state and for the
copy-to-clipboard confirmation, and `common.copied` being missing means *every* other panel that wanted a
"copied" toast had no key to use.

### 25 · P2 — Five spellings of "a bordered panel surface", including one off-scale radius

```
mysql-service/index.tsx:1090     p-3 rounded-xl border border-divider bg-content1
mariadb-service/index.tsx:811    p-3 rounded-xl border border-divider bg-content1
postgresql-service/index.tsx:852 p-3 rounded-xl border border-divider bg-content1
mongodb-service.tsx:1120         p-3 rounded-xl border border-divider bg-content1
redis-service/index.tsx:302      p-3 rounded-xl border border-divider bg-content1 space-y-3
nodejs-service/index.tsx:236     w-full p-3 space-y-3 rounded-xl border border-divider bg-content1
java-service.tsx:581             w-full p-3 space-y-4 rounded-xl border border-divider bg-content1
rust-service.tsx:68              w-full p-3 space-y-4 rounded-xl border border-divider bg-content1
nasm-service/index.tsx:23        rounded-md border border-divider bg-content1 p-3 text-xs text-muted-foreground
```
Two independent divergences: (a) the group gap is `space-y-4` in Java/Rust, `space-y-3` in Node/Redis and implied
by child separators in the SQL panels; (b) NASM uses `rounded-md` (8 px) where its eight peers use `rounded-xl`
(12 px) for the exact same role, and drops `w-full` (`nasm-service/index.tsx:23`). Per the design language a
panel-level surface is `rounded-2xl`/`rounded-xl`; `rounded-md` is the small-control radius, so NASM's box reads
as a form field, not a card.
Java additionally puts an interactive container at `rounded-lg` *inside* a `rounded-xl` card with the same
`bg-content1` (`java-service.tsx:643` `space-y-2 text-xs p-3 rounded-lg border border-divider bg-content1
dark:bg-content1/40`) — a nested surface that is visually indistinguishable from its parent (see §2/§15).

### 26 · P2 — Bare `border` with no colour token, inconsistently applied to the same component

Counts of `border` used with no `border-<token>` on the same element: MySQL 19, MariaDB 18, PostgreSQL 18,
MongoDB 17, Redis 7, Node 3, Java 10, Rust 1. These rely on the global fallback
`* { border-color: hsl(var(--border)) }` (`src/global.css:140-142`), i.e. `--border` (`#F0F0F0` light), not the
`divider` (`#F4F4F4`) the design language reserves for inside-panel separation.

The permission-list container appears four times in MySQL alone, twice *with* and twice *without* the token:
```
mysql-service/index.tsx:827    space-y-1 border rounded-lg p-2 bg-content1 dark:bg-content1/40 max-h-40 overflow-y-auto
mysql-service/index.tsx:941    space-y-1 border rounded-lg p-2 bg-content1 dark:bg-content1/40 max-h-48 overflow-y-auto
mysql-service/index.tsx:1339   space-y-1 border rounded-lg p-2 bg-content1 dark:bg-content1/40 border-divider
mysql-service/index.tsx:1553   border rounded-lg p-1 bg-content1 dark:bg-content1/40 border-divider
```
Same in MariaDB (`:1234` vs `:1350`), PostgreSQL (`:1262` vs `:1375`) and MongoDB (`:1750` vs `:1865`).
The visual delta is small (`#F0F0F0` vs `#F4F4F4`) but the divergence is real and it propagates: fixing
`--border` for panels will change the two copies that omit the token and not the two that include it.
`mysql-service/index.tsx:1339` and `:1553` also differ in padding (`p-2` vs `p-1`) for the same list.

### 27 · P2 — Copy-paste residue: empty `className` strings and a duplicated boolean

```
mysql-service/index.tsx:677    className=""        mariadb-service/index.tsx:673   className=""
mysql-service/index.tsx:728    className=""        mariadb-service/index.tsx:724   className=""
mysql-service/index.tsx:765    className=""        mariadb-service/index.tsx:761   className=""
mysql-service/index.tsx:921    className=""        mariadb-service/index.tsx:1180  className=""
mysql-service/index.tsx:1034   className=""        mariadb-service/index.tsx:1330  className=""
mysql-service/index.tsx:1055   className=""        mariadb-service/index.tsx:1443  className=""
mysql-service/index.tsx:1487   className=""        mariadb-service/index.tsx:1464  className=""
redis-service/index.tsx:321    className=""
redis-service/index.tsx:325    className=""
redis-service/index.tsx:329    className=""
```
`className=""` is inert, but it marks the spots where a class list was deleted and never revisited — several of
them are the exact buttons whose styling then diverges (§3, §21).

The duplicated boolean is a genuine logic artifact, repeated four times in Redis:
```
redis-service/index.tsx:321   disabled={!isServiceActive || !isServiceActive || !isInstalled || !isInitialized || serviceStatus === ServiceStatus.Running || …}
redis-service/index.tsx:325   disabled={!isServiceActive || !isServiceActive || !isInstalled || serviceStatus !== ServiceStatus.Running || …}
redis-service/index.tsx:329   disabled={!isServiceActive || !isServiceActive || !isInstalled || serviceStatus !== ServiceStatus.Running || …}
redis-service/index.tsx:480   disabled={!isServiceActive || !isServiceActive || !isInstalled || isLoading || isInitialized !== true || …}
```
Harmless at runtime, but it is the signature of a rewrite-by-duplication that also produced §1 and §3. Note Redis
is the only panel that gates lifecycle buttons on `isInstalled` (`:321,325,329`) while
`mysql/mariadb/postgresql/mongodb` do not check installation at all — a **fourth** style of action gating
(§11's table). Redis also renders the init button with `variant="outline"` while MySQL/MariaDB/PostgreSQL/MongoDB
use the default variant for the same CTA:
```
redis-service/index.tsx:280-284   <Button size="sm" variant="outline" … className="h-7 text-xs bg-warning hover:bg-warning/90 dark:bg-warning/90 dark:hover:bg-warning/90 text-primary-foreground">
mysql-service/index.tsx:1078-1081 <Button size="sm" onClick={…} className="h-7 text-xs bg-warning hover:bg-warning/90 dark:bg-warning dark:hover:bg-warning/90 text-primary-foreground">
```
`variant="outline"` contributes `border border-divider bg-background dark:bg-content3` which then fights the
inline `bg-warning`; and the dark token differs across three panels (`dark:bg-warning` in MySQL/MariaDB/
PostgreSQL/MongoDB `:1081,:803,:842,:1111`; `dark:bg-warning/90` in Redis `:284` and Java `:746`;
`dark:bg-warning` in Java `:706`) — 3 spellings of one CTA.

### 28 · P2 — Section headings are form labels, and no settings-form label is associated with its control

```
mysql-service/index.tsx:1092   <Label className="flex items-center gap-1.5 text-xs font-medium text-foreground">{t('mysql_service.service_control')}</Label>
mysql-service/index.tsx:1148   <Label className="flex items-center gap-1.5 text-xs font-medium text-foreground">{t('mysql_service.config_management')}</Label>
mysql-service/index.tsx:1318   … 'mysql_service.database_management'
mysql-service/index.tsx:1505   … 'mysql_service.user_management'
mysql-service/index.tsx:1608   <Label … mb-2>{t('mysql_service.other_operations')}</Label>
```
`Label` renders `@radix-ui/react-label` (`components/ui/label.tsx:9-19`), i.e. an HTML `<label>` — used here as a
section heading. `.Counts of this exact class: MySQL 4, MariaDB 4, PostgreSQL 4, MongoDB 4, Redis 1, Node 0,
Java 0.` Because they are labels with no `htmlFor`, they associate with nothing (and a `<label>` whose labelable
descendant is a *nested* input would associate implicitly — which is why the `mb-2` heading `Label` at `:1608`
sitting above a `<div>` is harmless but semantically wrong).

In the settings cards, `htmlFor` is used **only inside dialogs**:
```
mysql-service/index.tsx:1153   <Label className="text-xs font-medium text-foreground">{t('mysql_service.config_file_label')}</Label>
mysql-service/index.tsx:1155     <Input value={configPath} readOnly … />          ← no id
```
`htmlFor`/`id` count per file: MySQL 9, MariaDB 9, PostgreSQL 9, MongoDB 8, Redis 0, Node 0, Java 0, Rust 0 —
and every one of the non-zero ones is inside a `<Dialog>`. So 100 % of the settings-form labels in all nine
screens are unassociated, and Redis/Node/Java/Rust have no association anywhere including dialogs. There is also
no heading element (`h2`–`h6`) in any of the nine panels; the only headings are the shared
`env-panel-header.tsx:25` `<h2>` and the dialog `DialogTitle`/`AlertTitle` primitives.

### 29 · P2 — Path editing is inconsistent and mostly one-way

| file | config path | can type a path? | can pick a file? | commit affordance |
|---|---|---|---|---|
| MySQL `:1155-1170` | `readOnly` + `bg-content2 cursor-not-allowed` | no | no (Finder reveal only) | none |
| MariaDB `:879-894` | `readOnly` | no | no | none |
| PostgreSQL `:915-930` | `readOnly` | no | no | none |
| MongoDB `:1209-1228` | editable | no | no | icon `<Save>` button, `disabled` when unchanged `:1223` |
| Redis `:342-376` | editable | **yes** (`ipcOpenSelectDialog()` `:110`) | yes | text `<Button>{t('common.save')}</Button>`, **conditionally rendered** `:366-376` |
| Node.js `:258-273,322-337,363-378` | editable | no | no | `{t('node_service.apply')}` text button |
| Java `:610-626,805-821,877-893,…` | editable | no | no | `{t('java_service.apply')}` text button |
| Rust `:113-121` | editable | no | no | `{t('rust_service.apply')}` text button |

Three separate problems. (a) A read-only field with no way to enter a value is a dead end:
`mysql-service/index.tsx:1155-1170` renders the config path as an uneditable input whose only action is
`openFolderInFinder(configPath)` — but `configPath` is a *file*, and the button's `title` says
`open_config_dir_title` ("open the config **directory**"), so the label misdescribes the action for every one of
the four SQL panels (`mysql-service/index.tsx:1167`, `mariadb-service/index.tsx:889`,
`postgresql-service/index.tsx:925`, `mongodb-service.tsx:1247`). (b) Only Redis can browse for a file, so for the other eight the user
must already know the absolute path — and MySQL/MariaDB/PostgreSQL will not even let them type it. (c) The commit
affordance both changes shape (text button vs icon button vs nothing) and changes presence: Redis's Save button
appears and disappears as the value changes (`:366`), causing a layout shift in a `flex items-center gap-2` row
next to two other buttons; MongoDB instead keeps its icon button mounted and toggles `disabled`
(`:1223 disabled={isLoading || !editingConfigPath || editingConfigPath === configPath}`). The Save button is also
the only place the accent `focus` token is used as a control colour:
`:370 className="h-8 px-3 text-xs text-focus hover:text-focus border-focus/30 hover:bg-focus/10 dark:border-focus dark:hover:bg-focus/20"`
— a primary-shaped action rendered in the focus/link colour with `outline` chrome, while every other commit
button in the scope is `variant="outline"` with default text.

### 30 · P2 — Config-load failures are silent in all nine panels

No panel has an error state. `grep -n 'const \[.*[Ee]rror' <9 files>` → **0 hits**. Every loader ends in
`console.error` and nothing else:
```
mysql-service/index.tsx:286-297
  const loadMysqlConfig = async () => {
    try { const result = await getMysqlConfig(…); if (result.success && result.config) setMysqlConfig(result.config) }
    catch (error) { console.error('加载 MySQL 配置失败:', error) }
  }
redis-service/index.tsx:149-161
  catch (error) { console.error('检查 Redis 初始化状态失败:', error); setIsInitialized(false); setRuntimeConfig(prev => ({ …prev, dataPath: '', logPath: '', port: 6379, … })) }
java-service.tsx:216-226   catch (error) { console.error('获取 Java 信息失败:', error) }   → setJavaInfo never called, `javaInfo` stays null and the whole 版本信息 block silently disappears (`:632` is gated on `javaInfo &&`)
```
Also `if (result.success && …)` with no `else`: a call that returns `success: false` is treated exactly like a
success with empty data — the panel simply shows blank fields (or, for Redis, silently resets the displayed port
to 6379).

**Why it is wrong.** A user whose `my.cnf` moved gets an empty data-directory row with no red text, no icon and
no toast, and the only record is a `console.error` in a WKWebView console they cannot open. Compare: the
*loading* states are handled properly (`redis-service/index.tsx:259-265` "checking", `java-service.tsx:681-687`,
`mysql-service/index.tsx:1433` spinner), so the deliberate style for this class of state exists — it is
just never reached for failures. The one exception in the scope is MongoDB, which does surface a config problem:
`mongodb-service.tsx:1184-1191` renders `mongoConfig.parseError` inside `<Alert variant="destructive">`. That is
the pattern the other eight lack — and the pattern that has the broken focus ring (§7).

### 31 · P2 — NASM is a 29-line stub, and its class peers are not

```
nasm-service/index.tsx:15-28
  <div className="w-full p-3 space-y-3">
    <Alert className="border border-divider bg-content1">
      <Info className="h-4 w-4" /><AlertTitle>{t('nasm_service.title')}</AlertTitle>
      <AlertDescription className="text-xs leading-5">{t('nasm_service.description')}</AlertDescription>
    </Alert>
    <div className="rounded-md border border-divider bg-content1 p-3 text-xs text-muted-foreground">
      {t('nasm_service.current_version', { version: serviceData.version })}
    </div>
  </div>
```
NASM is a first-class, downloadable service: it is in `NeedDownloadServices` (`src/pc/types/index.ts:136`), it has
an entry in the add-service menu (`add-service-data-menu.tsx:114`), a router case (`env-panel.tsx:59`) and a
display name (`types/index.ts:88`). Its locale namespace has exactly 3 keys, all used.

Rust is the nearest peer — also a compile toolchain, also `NeedDownloadServices`, also `CannotRunServices` — and
gets 156 lines with two configured paths, Tooltips, an Apply action and a disabled-until-active gate. NASM gets
two static boxes, and in particular **no way to configure its install location**, even though the user has just
downloaded it into an app-managed directory. NASM's wrapper is also the only one that ignores
`selectedEnvironment` (`nasm-service/index.tsx:12` destructures only `serviceData`) while its signature declares it
(`:7-10`), i.e. the environment is available but unused.

### 32 · P2 — The shared title bar above all nine screens

```
env-panel-header.tsx:25   <h2 className="text-base font-semibold text-foreground dark:text-primary-foreground cursor-default hover:underline underline-offset-4">
env-panel-header.tsx:27-29  <span className="text-xs text-muted-foreground dark:text-muted-foreground">&nbsp;&nbsp;{selectedServiceData.version}</span>
```
This is the only title above all nine screens, so it is the one place the cross-screen surface is actually
consistent — but it carries four issues. (a) `dark:text-primary-foreground` is `--n-100` white (`src/global.css:69`),
i.e. the *button* foreground token reused as body text; the correct token is `foreground`
(`--c-label-d` = 86.1 %), so the service name is rendered at 100 % white in dark mode instead of the design's
label colour. (b) `hover:underline` on a non-interactive `<h2>` promises a link and delivers nothing
(the cursor is explicitly reset to `default` in the same string). (c) The version is separated with two literal
`&nbsp;` entities inside the heading, so it is part of the accessible name of the title and cannot be laid out or
hidden — the same `&nbsp;`-for-spacing hack appears in Redis's action buttons
(`redis-service/index.tsx:323,327,331`) and in Java's download status (`java-service.tsx:713,723,933,943`),
where the SQL panels use `className="gap-1"` instead (`mysql-service/index.tsx:1112`).
(d) `dark:text-muted-foreground` is a value-identical no-op (§15). There is also no status here — the service
name and version are the entire header, so the running state is only visible if the panel underneath happens to
render a dot (§11).

---

## Duplication inventory

### Quantified overlap

Non-blank lines, service identifiers and `*_service.*` keys normalised to `SVC`, matched with
`difflib.SequenceMatcher`:

| pair | matching normalised lines | % of the smaller file | sizes |
|---|---|---|---|
| mariadb ↔ postgresql | 1245 | **80.8 %** | 1546 / 1541 |
| mysql ↔ mariadb | 1217 | **78.7 %** | 1573 / 1546 |
| mysql ↔ postgresql | 1042 | 67.6 % | 1573 / 1541 |
| mariadb ↔ mongodb | 917 | 59.3 % | 1546 / 1892 |
| mysql ↔ mongodb | 744 | 47.3 % | 1573 / 1892 |
| postgresql ↔ mongodb | 718 | 46.6 % | 1541 / 1892 |
| mysql ↔ redis | 185 | 33.6 % | 1573 / 550 |
| postgresql ↔ redis | 193 | 35.1 % | 1541 / 550 |
| rust ↔ nasm | ~0 (different structure) | — | 137 / 20 |

**Read this as: three of the four database panels are ~80 % one file.** MySQL→MariaDB→PostgreSQL is a
find-and-replace of the service name; that is corroborated by the fact that their 36-line import headers
(`mysql-service/index.tsx:1-36`) are **byte-identical** (`diff` → empty for all three pairs).

### Literally identical blocks (line-for-line, verified with `diff`)

| block | size | content |
|---|---|---|
| `mysql:1-36` == `mariadb:1-36` == `postgresql:1-36` | 36 | imports, including icons and primitives unused in one or more of the files |
| `mysql:981-1035` == `mariadb:1390-1444` | **55** | edit-user dialog: custom-database input, Enter-to-add grant, grant reducer |
| `mysql:360-409` == `mariadb:356-405` | 50 | table-listing state machine (`isLoadingTables` / `showTables` / `showAllTables`) |
| `mysql:938-979` == `mariadb:1347-1388` | 42 | edit-user "current grants" preview list |
| `mysql:826-861` == `mariadb:1233-1268` | 36 | database permission picker (the `'SELECT'`/`'ALL PRIVILEGES'` chip block) |
| `mysql:212-251` == `postgresql:219-258` | 40 | `useServiceDatabasePush` subscription + `watchedDatabasesRef` cleanup |
| `mysql:1338-1344` == `postgresql:1064-1070` == `mongodb:1444-1450` | 7 | database row + `onClick` toggle shell |
| section card `p-3 rounded-xl border border-divider bg-content1` | ×5 per SQL panel | every section container |
| start/stop/restart button trio | 34 lines × 4 | `gap-1 h-8 text-xs bg-content1 dark:bg-content1/40 border-divider` |
| config path/data/log row | 24 lines × 4 | `Label` + `readOnly` `Input` + `FolderOpen` button, same icons in the same order |
| `redis:487-533` vs `redis:535-581` | **47 of 47 vs 47** | init dialog and reset dialog are the same form rendered twice (`persistence_label`, RDB/AOF checkboxes, port, bind, password), sharing one state object (§4) |

**Copy-paste inside a single file** (not just across files):
* `mysql:826-861` (create-user) and `mysql:938-979` (edit-user) are two near-copies of the same permission picker;
  PostgreSQL repeats it at `:1281` and `:1394`, MongoDB at `:1769` and `:1884`.
* `mongodb:1750` and `:1865` are the same permission list container; `:827`/`:941` vs `:1339`/`:1553` in MySQL are
  the same container with two different border tokens (§26).
* `redis:487-533` / `redis:535-581`: 47 lines of dialog duplicated verbatim within one file, including the
  persistence checkbox group twice (`:508-526` and `:556-574`).

### User-visible divergences that the duplication produced

These are the cases where the copy was not kept in sync and the difference is something a user sees or does not
see. Severity in brackets.

1. **Redis renders 13 raw i18n keys; MongoDB 1.** The copy exists in the locale but was never referenced by the
   duplicated file. [P0] §1
2. **Redis's destructive reset has no irreversible-data warning; the other four do.** The strings
   `reset_irrecoverable` and `running_warning` are defined and unused. [P1] §3
3. **MongoDB confirms user deletion with `window.confirm`, the other three with a styled dialog.** [P1] §3
4. **MySQL/MariaDB hardcode English privilege labels; PostgreSQL/MongoDB translate them.** [P1] §9
5. **Redis/Node/Java/Rust never explain why their form is disabled; the SQL four do, in four different wordings.**
   [P1] §11
6. **Five of nine panels have no status indicator; four have no lifecycle controls at all** — and nothing in those
   four points the user at the service list where activation actually happens. [P1] §11
7. **Java's Gradle branch is missing the "not initialized" state its Maven branch has**, so a downloaded Gradle
   dumps the user into a raw `GRADLE_HOME` text box. The `gradle_initialize` copy exists and is unused. [P1] §20
8. **Java shows raw backend status tokens inside the UI**; the `*_download_status` keys exist and are unused.
   [P1] §19
9. **Redis cannot submit its init dialog deliberately** — no required-field gate, no `password_required` check
   (the string is unused), no `catch` on lifecycle actions, while all four SQL panels validate and toast. [P1] §5
10. **A failed config load is silent in nine panels and visible in one** (MongoDB's `parseError` alert). [P2] §30
11. **Privilege chips are 18 px in all four panels that have them**, and the identical chips hardcode/translate
    differently — the copy was duplicated but the i18n wiring was not. [P2] §21, §9
12. **The database-row nesting cue exists in MariaDB/PostgreSQL/MongoDB and is lost in MySQL** (parent hover
    `content2` instead of `background`), plus a 4 px row-padding difference. [P2] §22
13. **NASM got the shell and none of the content**, while its nearest peer (Rust) got a full panel. [P2] §31
14. **The permission-list container uses `--border` in two copies and `--divider` in two others**, within one
    file. [P2] §26
15. **`common.create` is missing from both locales**, so both MongoDB create-confirm buttons render the key —
    a copy-paste of a button that was never locale-checked. [P0] §1
16. **Node.js's `defaultValue` fallbacks are the live path** for three missing keys, so its empty state and copy
    toast render Chinese in an English session. [P2] §24
17. **16 dead imports and 31 empty `className=""` strings** are the residue of the duplication; the empty
    `className` sits precisely where the styling later diverged (Redis's `variant="outline"` init CTA with an
    empty override, §27). [P2] §23, §27

### Cost of the duplication, concretely

* Adding a log viewer (§14) is a 9-file change with no shared component to extend.
* Fixing the control-fill step (§2) is a 15-site change across 5 files.
* Fixing the `dark:` no-ops (§15) is 111 deletions across 8 files.
* The Redis panel is the clearest casualty: it was rewritten as a 584-line copy and its locale namespace ended up
  with 13 missing keys and 20 orphaned ones — the only namespace in the scope with a two-way desync.
