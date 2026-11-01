# Envis

<p align="center">
  <img src="./app-icon.png" alt="Envis Logo" width="120" height="120">
</p>

<p align="center">
  <strong>A modern cross-platform environment and service manager for developers</strong>
</p>

<p align="center">
  English | [中文文档](./README.zh-CN.md)
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Services-15-blue" alt="15 supported services">
  <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-green" alt="Cross platform">
  <img src="https://img.shields.io/badge/Mobile-Android%20terminal-9cf" alt="Android terminal client">
  <img src="https://img.shields.io/badge/License-GPL--3.0-orange" alt="GPL-3.0 License">
</p>

## 📸 Screenshot

<p align="center">
  <img src="./doc/Shot.png" alt="Envis Screenshot" width="800">
</p>

## 💡 Why Envis

<div align="center">

| Pain | What Envis does |
| --- | --- |
| Setting up a new project means hunting downloads, fighting proxies, and untangling dependency conflicts | **One-click install** — downloads, unpacks, configures and starts a service for you |
| Project A wants Node 14 + Java 8 + MySQL, project B wants Node 20 + Java 11 + MariaDB | **One-click environment switching** — every environment owns its own binaries, data dirs, ports and config files |
| Every teammate configures their machine by hand, then "works on my machine" happens | **Export / import environment configs** — new machines get an identical setup in one click |
| Services are scattered across `brew services`, `systemctl`, Docker Desktop and stray terminals | **One window** for install, start/stop, config, data browsing, logs and terminals |

</div>

## 🧩 Supported services

Envis groups services into two kinds. **Runnable** services can be started, stopped and restarted from Envis; **toolchain** services are installed and configured but are used from your terminal.

| Service | Kind | Panel |
| --- | --- | --- |
| **MySQL** · **MariaDB** | Runnable | Initialise, start/stop, port & data dir, databases, users and privileges |
| **PostgreSQL** | Runnable | Initialise, start/stop, configuration, databases, roles |
| **MongoDB** | Runnable | Initialise, start/stop, data/log paths, databases, collections, users |
| **Redis** | Runnable | Initialise, start/stop, persistence (RDB / AOF), key browser |
| **Nginx** | Runnable | Start/stop, config file parsing, server blocks, listen / server_name |
| **Dnsmasq** | Runnable | Start/stop, config file, macOS `/etc/resolver` guidance |
| **Node.js** | Toolchain | Version install, global npm packages |
| **Python** | Toolchain | Version install, pip index config, virtual environments |
| **Java** | Toolchain | Version install, Maven / Gradle info |
| **Rust** | Toolchain | Toolchain install, `rustc` / `cargo` info |
| **NASM** | Toolchain | Version install |
| **Custom service** | Toolchain | Executable path, environment variables, aliases, working directory, auto-`cd` |
| **Hosts** | Toolchain | Visual editor for `/etc/hosts` (requires admin privileges) |
| **SSL** | Toolchain | Local certificate authority, issue certificates, certificate list |

## ✨ Features

### Environment management
- Multiple isolated environments, each with its own service programs, versions and data directories
- One-click activate / deactivate, with optional auto-activation of the last used environment on launch
- Optionally deactivate other environments when activating one, or stop every service on exit
- Drag-and-drop reordering, search, and per-environment **export / import** of configuration

### Service management
- One-click download, verify, unpack and install, with live download progress
- Per-service version selection and start / stop / restart
- Configuration editing directly in the UI, with validation feedback
- Data panels: databases, users and privileges, collections, keys, npm packages, virtual environments

### Developer tooling
- **AI assistant** panel — works with any **OpenAI** or **DeepSeek** compatible API. Analyses issues, explains configuration and drafts commands. Chat history stays on your machine
- **Built-in terminal** — open a shell already scoped to an activated environment, with optional environment name and service info banner
- **Log panel and diagnostics** — application logs plus a state inspector for troubleshooting
- **System monitor** — CPU, memory, disk I/O and network at a glance
- **Proxy support** — `none` / `http` / `socks5` / `system`, used for service downloads and API calls
- **Themes** — light, dark, or follow the system
- **Localisation** — Chinese and English, fully key-aligned

## 📱 Mobile (Android terminal client)

The repository also ships a mobile build: a lightweight login → host list → environment list → terminal client that connects to your machine through the mobile terminal session API. It shares the design system and the release pipeline with the desktop app.

```bash
pnpm dev:mobile      # Vite dev server for the mobile entry
pnpm build:mobile    # production build for the mobile entry
pnpm android:init    # one-off: generate the Android project
pnpm android:dev     # run on a device / emulator
pnpm android:build   # build the Android package
```

## 🏗 Architecture

Envis is a thin React UI on top of a Rust core. The frontend never touches the filesystem or spawns a
process directly — every privileged action goes through a typed IPC wrapper.

```
┌──────────────────────────────────────────────────────────┐
│ React UI            src/pc/**            src/mobile/**   │
│   Jotai stores · i18next · Tailwind tokens · Radix UI    │
├──────────────────────────────────────────────────────────┤
│ IPC layer           src/pc/ipc/**  (typed invoke wrappers)│
├──────────────────────────────────────────────────────────┤
│ Tauri commands      src-tauri/src/**   (~240 commands)   │
│   window · tray · updater · dialogs · process spawning   │
├──────────────────────────────────────────────────────────┤
│ envis-core          src-tauri/crates/envis-core (submodule)│
│   manager/** · types/** · utils/**                       │
└──────────────────────────────────────────────────────────┘
```

- **Install state is derived, not stored in the UI.** `envis-core` reports what is installed and what is
  running; the interface renders that truth.
- **Everything is themed from tokens.** Components read the three-tier tokens in `src/global.css`;
  no component hardcodes a colour.
- **Two frontends, one design system.** The PC and mobile entries share tokens, primitives and the
  release pipeline.

## 🛠 Tech stack

| Layer | Choice |
| --- | --- |
| Desktop shell | **Tauri 2** (Rust, `tray-icon`, updater, opener, dialog, process plugins) |
| Frontend | **React 18** + **TypeScript** |
| Build | **Vite 6** (two entries: `index.html` for PC, `mobile.html` for mobile) |
| Styling | **Tailwind CSS 3** + **Radix UI** primitives |
| State | **Jotai** |
| i18n | **i18next** / react-i18next (`zh-CN`, `en`) |
| Motion | **Framer Motion** |
| Lists & layout | **react-virtuoso**, **react-resizable-panels**, **dnd-kit** |
| Forms | **react-hook-form** |
| Markdown & highlight | **react-markdown** + **rehype-highlight** |
| Icons | **lucide-react** |
| Notifications | **sonner** |

## 🚀 Getting started

### Prerequisites

- **Node.js 20+**
- **pnpm** (the repo is pnpm-managed; `pnpm-lock.yaml` is the source of truth)
- **Rust** stable toolchain — required by Tauri
- Platform build dependencies for Tauri 2 — see the official
  [Tauri prerequisites](https://tauri.app/start/prerequisites/) (Xcode Command Line Tools on macOS,
  WebView2 + MSVC on Windows, WebKitGTK + `libssl-dev` etc. on Linux)

### Clone

The Rust core lives in a **git submodule** (`src-tauri/crates/envis-core`, branch `enterprise`),
so it must be checked out together with the app. Access to that repository is required to build the
desktop app.

```bash
git clone --recurse-submodules https://github.com/xopenbeta/envis-app.git
cd envis-app
```

If you already cloned without submodules:

```bash
pnpm git:pull        # git pull --recurse-submodules
```

### Install and run

```bash
pnpm install
pnpm dev:pc          # full desktop app (Tauri + Vite)
```

## 📝 Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server for the **PC** entry only (no Tauri shell) |
| `pnpm dev:pc` | Full desktop development: Tauri shell + Vite |
| `pnpm dev:mobile` | Vite dev server for the **mobile** entry |
| `pnpm build` | Guard checks → `tsc` → production build of the PC entry |
| `pnpm build:mobile` | Guard checks → `tsc` → production build of the mobile entry |
| `pnpm preview` | Preview a production build |
| `pnpm check:i18n` | Locale sanity check (see [Development notes](#-development-notes)) |
| `pnpm check:a11y` | Accessibility scan (see [Development notes](#-development-notes)) |
| `pnpm pack` | Package the desktop app (`tauri build`) |
| `pnpm tauri` | Run any Tauri CLI command |
| `pnpm icon` | Regenerate every platform icon from the icon source |
| `pnpm android:init` / `android:dev` / `android:build` | Android project lifecycle |
| `pnpm publish -- v0.13.16` | Release a new version (bumps versions, tags, pushes) |
| `pnpm git:pull` | `git pull --recurse-submodules` |

## 📁 Project structure

```
envis-app/
├── index.html                PC entry
├── mobile.html               Mobile entry
├── app-icon.png              Icon source (1024×1024) — regenerate platform icons from this
├── E.svg                     Vector master of the app icon
├── src/
│   ├── global.css            Design tokens (3 tiers: raw → semantic → component)
│   ├── theme.ts              light / dark / system theme application
│   ├── pc/                   Desktop app
│   │   ├── pages/            nav-bar · env-panel (15 service panels) · ai-panel · log-panel
│   │   ├── components/ui/    Radix-based primitives
│   │   ├── hooks/            settings, services, status, environment data
│   │   ├── ipc/              typed wrappers around Tauri commands
│   │   └── i18n/locales/     en.json · zh.json
│   └── mobile/               Android terminal client
├── src-tauri/                Rust shell
│   ├── icons/                Generated platform icons
│   └── crates/envis-core/    Core logic (git submodule)
├── scripts/                  release tooling + repo guards
└── doc/design/               UI design language & audit
```

## ⚙️ Configuration & data

### Build target

`vite.config.ts` branches on a single variable, set by the mode-specific env files:

| File | `VITE_APP_TARGET` | Source root | HTML entry | Output |
| --- | --- | --- | --- | --- |
| `.env.pc` | `pc` | `src/pc` | `index.html` | `dist/` |
| `.env.mobile` | `mobile` | `src/mobile` | `mobile.html` | `build/` |

Because `@` is aliased to the active target's source root, `@/components/ui/button` resolves to
`src/pc/components/ui/button` on PC and `src/mobile/components/ui/button` on mobile.

### Where settings live

- **App settings** (theme, language, AI provider/key/model) are UI-scoped and kept in local storage.
- **System settings** (`envisFolder`, auto-start on login, deactivate-others, stop-on-exit, terminal
  program, proxy mode and URL) are persisted by the Rust core.

### On-disk layout

Downloaded programs and per-environment data live under the folder you pick as `envisFolder`:

```
<envisFolder>/
└── envs/
    └── <environmentId>/
        └── <serviceType>/          e.g. mysql, redis, nodejs
            └── <version>/          binary + data directory for that version
```

Each environment is therefore self-contained: deactivating or deleting it cannot leave stray
processes or shared state behind.

## 🧭 Development notes

### Repo guards

Two checks run before every production build, because both classes of defect are invisible in review:

```bash
pnpm check:i18n   # duplicate keys · en/zh key parity · every t('…') resolves to a real key
pnpm check:a11y   # every dialog has a title · every icon-only control has an accessible name
```

A `t('some.key')` that does not exist renders the raw key string to the user, and duplicate keys are
silently swallowed by `JSON.parse` — neither shows up in a diff, so they are enforced by script.

### Internationalisation

`src/pc/i18n/locales/en.json` and `zh.json` must stay **key-complete in both directions**.
`pnpm check:i18n` fails the build otherwise. Never hardcode user-facing strings in components.

### Design system

All UI work follows [`doc/design/UI-LANGUAGE.md`](./doc/design/UI-LANGUAGE.md) — colour, surface
elevation, type scale, spacing, radii, motion, components, status semantics, dark mode and
accessibility rules. Open
[`doc/design/preview.html`](./doc/design/preview.html) in a browser for a live visual reference
rendered from the real tokens. [`doc/design/UI-AUDIT.md`](./doc/design/UI-AUDIT.md) tracks the
audit findings and what has been fixed.

### Icons

Platform icons are generated, not hand-edited:

```bash
pnpm icon                 # reads ./app-icon.png
pnpm tauri icon E.svg     # or render straight from the vector master
```

The macOS **tray** icon (`src-tauri/icons/envis.png`) is a transparent-background glyph compiled into
the binary via `include_bytes!`, and macOS runs it in template mode — only its alpha channel is used.
Do not replace it with the square app icon.

## 📦 Build & release

```bash
pnpm build           # type-check + build the frontend
pnpm pack            # package the desktop app
pnpm publish -- v0.13.16   # tag and release; CI builds macOS / Windows / Linux
```

See [CHANGELOG.md](./CHANGELOG.md) for release history.

## ❓ FAQ

**The Rust build fails, or `src-tauri/crates/envis-core` is missing.**
The core is a git submodule. Run `pnpm git:pull` (or clone with `--recurse-submodules`). Access to the
`envis-core` repository is required.

**`pnpm build` fails at `check:i18n` or `check:a11y`.**
That is the guard working. The output names the file, line and key — a raw `t('some.key')` would
otherwise be rendered to the user, and a missing dialog title or unlabelled icon button is invisible
in review.

**Editing `/etc/hosts` asks for my password.**
Expected — host management needs administrator privileges. The password is used for that single
operation.

**A service does not start.**
Check the port first, then open the log panel in the bottom bar. Most start failures are a port already
in use or a data directory that was not initialised yet.

**Some panels look macOS-specific.**
Dnsmasq's `/etc/resolver` guidance and the Hosts editor are platform-specific by nature and say so
inline on other systems.

**Icons look wrong in the menu bar.**
The tray icon must stay a transparent-background glyph — macOS renders it in template mode and reads
only the alpha channel. See [Icons](#icons).

## 🤝 Contributing

Contributions are welcome — issues and pull requests alike.

1. Fork the repository
2. Create a branch (`git checkout -b feature/amazing-feature`)
3. Make your change, then run `pnpm check:i18n && pnpm check:a11y && pnpm build`
4. Commit (`git commit -m 'Add some amazing feature'`)
5. Push and open a pull request

Please keep UI changes consistent with the design language, and add new strings to **both** locale
files.

## 🙏 Acknowledgements

- [Tauri](https://tauri.app/) — the desktop shell and bundler
- [Radix UI](https://www.radix-ui.com/) — the accessible primitives the UI is built on
- [shadcn/ui](https://ui.shadcn.com/) — the component structure `src/pc/components/ui` started from
- [Lucide](https://lucide.dev/) — the icon set
- [HeroUI](https://www.heroui.com/) — the original colour language the design tokens descend from
- [Tailwind CSS](https://tailwindcss.com/), [Jotai](https://jotai.org/), [i18next](https://www.i18next.com/)

## 📄 License

This project is licensed under the **GNU General Public License v3.0**. See [LICENSE](./LICENSE)
for the full text.

---

<p align="center">
  Made for developers who would rather write code than configure their machine.
</p>
