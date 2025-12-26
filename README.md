# Envis

<p align="center">
  <img src="./app-icon.png" alt="Envis Logo" width="120" height="120">
</p>

<p align="center">
  <strong>A modern cross-platform environment and service management tool</strong>
</p>

<p align="center">
  [中文文档](./README.zh-CN.md) | English
</p>

## 📸 Screenshot

<p align="center">
  <img src="./doc/Shot.png" alt="Envis Screenshot" width="800">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Services-10+-blue" alt="10+ Supported Services">
  <img src="https://img.shields.io/badge/Platform-Cross%20Platform-green" alt="Cross-platform">
  <img src="https://img.shields.io/badge/License-MIT-orange" alt="Open Source MIT License">
</p>

## 💡 Use Cases

### 🚀 Rapid Environment Setup

Setting up the environment is often the most challenging part when starting a new project - difficult downloads, tedious configurations, and dependency errors. With Envis, you can **install service programs with one click**, eliminating tedious manual configuration and dependency troubleshooting, getting your project up and running immediately.

### 🔄 Seamless Project Switching

When working on multiple projects, Project A requires Node 14, Java 8, and MySQL, while another project needs Node 20, Java 11, and MariaDB. Switching between projects means switching a series of environments, which can be cumbersome. With Envis, you can **switch environments with one click**, easily managing complex project dependencies.

### 👥 Team Environment Standardization

Configuring environments on each computer can be tedious. Envis supports **exporting and importing environment configurations**, allowing you to set up identical environments with one click and get projects running stably. Eliminate the "works on my machine" problem, ensuring all team members have consistent development environments and guaranteeing stable project operation across different devices.

## ✨ Core Features

<table>
  <tr>
    <td align="center">
      <h3>⚡ One-Click Installation</h3>
      <p>Automatically download, configure, and start service programs</p>
    </td>
    <td align="center">
      <h3>🔒 Environment Isolation</h3>
      <p>Complete isolation between multi-project environments</p>
    </td>
  </tr>
  <tr>
    <td align="center">
      <h3>📦 Configuration Export</h3>
      <p>Support one-click export and import of environment configurations</p>
    </td>
    <td align="center">
      <h3>🛡️ Secure & Reliable</h3>
      <p>Runs locally with full control over your data</p>
    </td>
  </tr>
</table>

## 🎯 Quick Start

### Main Features

- 🌍 **Environment Management** - Manage multiple environments and configurations
- 🚀 **Service Management** - Easy service deployment and monitoring
- 🤖 **AI Integration** - Built-in AI assistant panel
- 📊 **Data Visualization** - Rich data display components

## 🛠️ Tech Stack

- **Frontend Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Desktop Framework**: Tauri 2
- **UI Component Library**: Radix UI + Tailwind CSS
- **State Management**: Jotai
- **Animation**: Framer Motion
- **Internationalization**: i18next
- **Drag & Drop**: dnd-kit
- **Form Handling**: React Hook Form

## 📦 Installation

### Prerequisites

- Node.js 18 or higher
- pnpm (recommended) or npm
- Rust (for Tauri development)

### Installation Steps

```bash
# Clone the repository
git clone <your-repo-url>
cd envis-app

# Install dependencies
pnpm install

# Start development server
pnpm dev:pc
```

## 🚀 Development

### Development Mode

```bash
# Start development mode (frontend only)
pnpm dev

# Start Tauri development mode (full application)
pnpm dev:pc
```

### Build

```bash
# Build the application
pnpm build

# Package the application
pnpm pack

# Preview production build
pnpm preview
```

## 📝 Available Scripts

- `pnpm dev` - Start Vite development server
- `pnpm dev:pc` - Start Tauri development mode
- `pnpm build` - Build the application
- `pnpm pack` - Package the application
- `pnpm publish` - Release a new version
- `pnpm tauri` - Run Tauri CLI commands

## 🎨 Main Features

### Environment Management

- Manage multiple runtime environments
- Environment variable configuration
- Quick environment switching

### Service Management

- Service deployment and startup
- Service status monitoring
- Service log viewing
- Download progress tracking

### AI Assistant

Built-in AI assistant panel providing intelligent assistance features.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Contributing Steps

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---
