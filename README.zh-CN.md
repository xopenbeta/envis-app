# Envis

<p align="center">
  <img src="./app-icon.png" alt="Envis Logo" width="120" height="120">
</p>

<p align="center">
  <strong>一个现代化的跨平台环境和服务管理工具</strong>
</p>

<p align="center">
  中文文档 | [English](./README.md)
</p>

## 📸 应用截图

<p align="center">
  <img src="./doc/Shot.png" alt="Envis 应用截图" width="800">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/服务支持-10+-blue" alt="10+ 支持服务">
  <img src="https://img.shields.io/badge/平台-全平台支持-green" alt="跨平台">
  <img src="https://img.shields.io/badge/协议-MIT-orange" alt="开源 MIT 协议">
</p>

## 💡 使用场景

### 🚀 极速环境搭建

开发一个新项目，搭建环境往往是最难的，下载困难，配置繁琐，依赖错误。这时候就可以用 Envis **一键下载安装服务程序**，告别繁琐的手动配置与依赖排错，让项目立即进入可运行状态。

### 🔄 多项目无缝切换

多项目开发时，项目 A 需要 Node 14、Java 8、MySQL，而另一个项目需要 Node 20、Java 11、MariaDB。每次切换项目开发都要先切换一串环境，比较麻烦。用 Envis 可**一键切换环境**，轻松切换复杂的项目依赖。

### 👥 团队环境标准化

每个电脑都要配置一遍环境，比较麻烦。Envis 支持**导出导入环境配置**，一键搭建完全相同环境，让项目稳定运行起来。消除"在我电脑上能跑"的困扰，确保所有团队成员拥有一致的开发环境，保障项目在不同设备上的稳定运行。

## ✨ 核心特性

<table>
  <tr>
    <td align="center">
      <h3>⚡ 一键安装</h3>
      <p>自动下载、配置、启动服务程序</p>
    </td>
    <td align="center">
      <h3>🔒 环境隔离</h3>
      <p>多项目环境完全独立，互不干扰</p>
    </td>
  </tr>
  <tr>
    <td align="center">
      <h3>📦 配置导出</h3>
      <p>支持一键导出导入环境配置</p>
    </td>
    <td align="center">
      <h3>🛡️ 安全可靠</h3>
      <p>本地运行，数据完全掌控</p>
    </td>
  </tr>
</table>

## 🎯 快速开始

### 主要功能

- 🌍 **环境管理** - 管理多个环境和配置
- 🚀 **服务管理** - 轻松部署和监控服务
- 🤖 **AI 集成** - 内置 AI 助手面板
- 📊 **数据可视化** - 丰富的数据展示组件

## 🛠️ 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite
- **桌面框架**: Tauri 2
- **UI 组件库**: Radix UI + Tailwind CSS
- **状态管理**: Jotai
- **动画**: Framer Motion
- **国际化**: i18next
- **拖拽排序**: dnd-kit
- **表单处理**: React Hook Form

## 📦 安装

### 环境要求

- Node.js 18 或更高版本
- pnpm（推荐）或 npm
- Rust（用于 Tauri 开发）

### 安装步骤

```bash
# 克隆仓库
git clone <your-repo-url>
cd envis-app

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev:pc
```

## 🚀 开发

### 开发模式

```bash
# 启动开发模式（仅前端）
pnpm dev

# 启动 Tauri 开发模式（完整应用）
pnpm dev:pc
```

### 构建

```bash
# 构建应用
pnpm build

# 打包应用
pnpm pack

# 预览生产构建
pnpm preview
```

## 📝 可用脚本

- `pnpm dev` - 启动 Vite 开发服务器
- `pnpm dev:pc` - 启动 Tauri 开发模式
- `pnpm build` - 构建应用
- `pnpm pack` - 打包应用
- `pnpm publish` - 发布新版本
- `pnpm tauri` - 运行 Tauri CLI 命令

## 🎨 主要功能

### 环境管理

- 管理多个运行环境
- 环境变量配置
- 环境快速切换

### 服务管理

- 服务部署和启动
- 服务状态监控
- 服务日志查看
- 下载进度跟踪

### AI 助手

内置 AI 助手面板，提供智能辅助功能。

## 🤝 贡献

欢迎贡献代码！请随时提交 Pull Request。

### 贡献步骤

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

---
