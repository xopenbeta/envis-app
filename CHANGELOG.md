# 更新日志 / Changelog

## [0.12.1] - 2026-04-15

### 新增 / Added
- ✨ 新增独立 CLI 可执行入口：后端拆分为 Cargo workspace，并引入 `envis-core` 与 `envis-cli`，支持复用统一的环境命令处理链路
- ✨ Nginx 服务配置概览新增 Error Log 路径展示，便于快速定位日志文件

### 修复 / Fixed
- 🐛 修复 Nginx 配置与启动流程在日志目录不存在时的失败问题：启动前会自动补齐 `logs` 目录与相关运行路径，提升跨平台稳定性
- 🐛 修复新建/编辑环境名称时中文输入法组合输入阶段按回车会误触发保存的问题，兼容 composition 状态与回车确认场景

### 改进 / Improved
- ♻️ 后端工程升级为 Cargo workspace，核心服务与 CLI 能力从 Tauri GUI 工程中抽离复用，降低后续维护与扩展成本
- ♻️ 优化 Nginx 配置解析逻辑：解析前忽略注释并补充 `error_log` 提取，配置概览信息更完整

## [0.12.0] - 2026-04-14

### 修复 / Fixed
- 🐛 修复环境激活流程在部分服务激活失败时仍显示成功的问题：后端会汇总失败服务并返回明确错误，前端会直接提示失败原因并中止加载流程
- 🐛 修复 Nginx 安装与运行流程：改用预编译归档包下载，内置 tar/zip 解压与旧安装目录清理逻辑，并在启动、停止、重载时显式传入运行前缀与配置路径，提升跨平台稳定性
- 🐛 修复 Python 安装与激活路径处理：zip 解压时自动剥离顶层目录，Windows 平台按安装根目录识别可执行文件，并补充 `PYTHON_HOME` 环境变量
- 🐛 修复 Host 服务在 Windows 平台激活/停用时错误要求管理员密码的问题，非 Windows 平台仍保持密码校验

### 改进 / Improved
- ♻️ 更新 Nginx 可用版本列表至 1.28.3 与 1.26.3，并同步优化启动命令的错误回传逻辑
- ♻️ 更新 MongoDB 可用版本列表，提升版本选项的时效性

## [0.11.3] - 2026-04-13

### 新增 / Added
- ✨ MySQL 服务新增完整用户管理能力：支持用户列表查询、创建用户、删除用户与数据库授权更新（SELECT / ALL PRIVILEGES）
- ✨ PostgreSQL 服务新增初始化与管理能力：支持初始化状态检查、数据库列表/创建、表列表查询、角色列表/创建/删除与权限更新

### 修复 / Fixed
- 🐛 修复 MongoDB（mongosh）zip 解压对系统 `unzip` 命令的依赖，改为 Rust `zip` 库内置解压，提升跨平台安装稳定性（尤其是 Windows）
- 🐛 修复服务下载超时过短导致的大文件下载失败问题，将 HTTP 下载超时从 5 分钟延长到 30 分钟
- 🐛 修复服务激活/停用流程在密码场景下的兼容性问题，支持按次传入密码覆盖默认凭据

---

## [0.11.2] - 2026-04-09

### 新增 / Added
- ✨ MariaDB 服务面板新增配置信息展示区：从实际配置文件实时读取并展示数据目录、日志文件路径、监听主机及端口，支持一键在访达中打开对应目录
- ✨ 新增后端 `get_mariadb_config` Tauri 命令，解析 MariaDB `.cnf` 配置文件，结构化输出 port、bind-address、datadir、log-error 等运行时配置

### 改进 / Improved
- ♻️ MariaDB 服务面板 UI 重构：将 Root 密码从"配置信息"区移至"用户管理"区行内显示，与普通用户保持一致的视觉风格
- ♻️ MariaDB 用户列表精简：移除每行权限标签展示，列表更紧凑
- ♻️ MongoDB 管理员用户展示改为行内样式，密码内联显示；普通用户列表视觉精简；更换相关操作图标（UserPlus、ShieldCheck、Pencil）
- 💄 服务列表头部由固定文案改为动态显示当前环境名称

---

## [0.11.1] - 2026-04-08

### 新增 / Added
- ✨ MariaDB 服务面板新增完整用户管理功能：支持查看用户列表、创建用户（含权限配置）、删除用户、修改用户数据库权限（支持 SELECT / ALL PRIVILEGES 粒度控制），定时自动刷新
- ✨ 服务总览面板新增进程资源监控模块，实时展示活跃服务的 CPU 使用率、内存占用及磁盘 I/O，每 2 秒自动刷新
- ✨ 新增 `useServiceProcessStatus`、`useServiceActivationStatus`、`useServiceDownloadStatus` 三个服务状态轮询 Hooks，统一管理响应式轮询逻辑，替代各面板中内联的 `setInterval` 代码
- ✨ 新增后端 `get_services_process_stats` Tauri 命令，支持按服务类型批量查询进程资源统计（CPU、内存、磁盘读写、进程数）
- ✨ 新增后端 `list_mariadb_users`、`create_mariadb_user`、`delete_mariadb_user`、`update_mariadb_user_grants` Tauri 命令，完整支持 MariaDB 用户生命周期管理
- ✨ MariaDB 服务面板新增「打开终端客户端」功能，支持在系统终端（macOS Terminal / Windows CMD / Linux xterm）中直接连接 MariaDB，无需手动输入连接参数
- ✨ Redis 服务面板新增「Redis CLI」快捷按钮，服务运行中可一键打开系统终端并连接 Redis CLI

### 修复 / Fixed
- 🐛 修复 MariaDB 客户端命令未显式传入 `-u root` 参数，导致在部分系统上以当前 OS 用户身份连接而鉴权失败的问题
- 🐛 修复 Java / Maven / Gradle 安装包解压后出现多层嵌套目录的问题：tar.gz 格式新增 `--strip-components=1` 参数，zip 格式实现自定义 `extract_zip` 函数并自动剥离顶层公共目录
- 🐛 修复 Redis zip 安装包解压时未处理顶层目录前缀的问题，新增 `extract_zip` 通用函数，同时过滤 macOS `__MACOSX` 元数据文件
- 🐛 修复 MariaDB 激活状态变更后前端状态未自动同步的问题，新增激活状态轮询并回写到 store

---

## [0.10.0] - 2026-04-03

### 新增 / Added
- ✨ 新增 Redis 服务完整支持：接入后端服务管理器、Tauri 命令、前端服务面板与类型定义
- ✨ 新增 Redis 客户端连接能力，支持在 Redis 服务面板中配置与使用客户端选项
- ✨ 新增 Redis 持久化选项配置能力

### 修复 / Fixed
- 🐛 修复 Redis 服务接入与服务列表展示过程中的相关问题
- 🐛 修复 Redis 服务面板中的部分交互与配置问题

---

## [0.9.0] - 2026-04-01

### 新增 / Added
- ✨ 新增 MinGW 服务支持，为 Windows 平台提供原生 GCC 编译环境
- ✨ Java 服务模块化重构：将 Java 服务拆分为 Gradle、Maven 和核心 Java 三个独立模块，提升代码可维护性和扩展性

### 改进 / Improved
- ♻️ 优化 CLI 处理流程，实现早期 CLI 处理机制，无需依赖 Tauri 初始化，提升命令行工具响应速度
- ♻️ MySQL 服务功能增强，优化数据库管理和配置流程
- 💄 优化 Java 服务卡片 UI 样式，提升视觉展示效果和可读性

### 修复 / Fixed
- 🐛 修复环境变量处理相关问题
- 🐛 修复服务管理器中的多个边界情况和稳定性问题

---

## [0.8.0] - 2026-03-19

### 新增 / Added
- ✨ MariaDB 服务面板新增完整数据库管理功能：支持查看数据库列表、展开查看表列表、创建数据库、以及一键打开 MariaDB 客户端连接
- ✨ MariaDB 新增多版本支持（10.6 LTS、10.11 LTS、11.4 LTS、11.8 Current Stable、12.2/12.3 Development），可自由选择安装版本
- ✨ MariaDB 新增多来源多平台下载支持：macOS 从 GitHub Release 下载（支持主源与官方备用源），Linux/Windows 优先走清华镜像、阿里云镜像，最终回落官方下载站
- ✨ MariaDB 初始化流程新增图形化配置弹窗，支持设置 root 密码、监听端口、绑定地址，并提供高级选项展开
- ✨ 新增 `useMariadb()` Hook，统一封装 MariaDB 全部操作方法，方便前端调用
- ✨ 新增 `MariaDBMetadata` 类型接口，规范 MariaDB 服务元数据结构

### 修复 / Fixed
- 🐛 修复下载管理器未校验响应 Content-Type 的问题：服务器返回 HTML 错误页面时将被识别并抛出明确错误，避免误将 HTML 页面当作二进制文件保存

---

## [0.7.1] - 2026-03-06

### 修复 / Fixed
- 🐛 修复 Windows 平台下所有服务（Dnsmasq、Java、MariaDB、MongoDB、MySQL、Nginx、Node.js、PostgreSQL、Python、SSL、Shell Manager、System Info）在执行外部命令时弹出黑色 CMD 窗口的问题

### 改进 / Improved
- ♻️ 提取 `create_command` 统一工具函数，集中管理 Windows `CREATE_NO_WINDOW` 标志，消除各服务模块中重复的平台判断代码

---

## [0.7.0] - 2026-03-05

### 新增 / Added
- ✨ 新增自定义服务「终端自动跳转目录」功能，允许用户为每个自定义服务配置终端启动时自动 `cd` 进入指定目录，支持启用/禁用开关与路径持久化
- ✨ 新增 Windows 欢迎页 CMD 环境提示横幅，告知用户 CMD 配置与 PowerShell/Bash 的差异及示例，支持一键关闭并记住状态

### 修复 / Fixed
- 🐛 修复 Windows PowerShell profile 中 PATH 写入方式，由 `"...;$env:Path"` 改为 `"...;" + $env:PATH`，避免 profile 加载时 PATH 被静态展开导致后续变更失效
- 🐛 修复 CMD AutoRun 注册表写入方式，从依赖 PowerShell 改为原生 `reg.exe`，降低权限要求并避免 PowerShell 策略限制
- 🐛 修复 CMD AutoRun 初始化逻辑，优先复用注册表中已有的脚本路径，避免重复覆盖
- 🐛 修复 PowerShell 别名（Alias）写入逻辑，无参数别名改用 `Set-Alias`，含参数别名回退为 `function { @args }` 包装，并兼容旧格式清理
- 🐛 修复旧版 `$env:Path =` 格式的清理逻辑，添加向后兼容处理，避免升级后旧 profile 中残留重复 PATH 行
- 🐛 修复 `envis` Shell 函数：`refresh` 子命令与 `use` 一样触发环境刷新，确保手动刷新时也能同步 Shell 变量
- 🐛 修复 Windows 平台执行 `reg` 相关注册表命令时弹出黑色 CMD 窗口的问题，统一添加 `CREATE_NO_WINDOW` 标志

---

## [0.6.1] - 2026-03-05

### 修复 / Fixed
- 🐛 修复 Windows 平台执行 PostgreSQL 停止命令（`taskkill`）时弹出黑色 CMD 窗口的问题，添加 `CREATE_NO_WINDOW` 标志隐藏控制台窗口
- 🐛 修复 Windows 平台执行 PowerShell 命令（Shell 自动运行配置、环境变量注入）时弹出黑色 CMD 窗口的问题
- 🐛 修复 Windows 平台执行 `wmic`、`ipconfig` 等系统信息采集命令时弹出黑色 CMD 窗口的问题

---

## [0.6.0] - 2026-03-03

### 新增 / Added
- ✨ 新增 NASM 服务完整支持（后端服务管理器、Tauri 命令、前端服务面板、服务路由接入）
- ✨ 新增 NASM 版本下载与安装流程，支持安装状态检测、下载进度查询、下载取消与安装完成状态更新
- ✨ 新增 NASM 服务类型与图标接入，支持在“添加服务”菜单中选择并创建 NASM 服务
- ✨ 新增 NASM 中英文国际化文案（标题、描述、当前版本）

### 修复 / Fixed
- 🐛 修复/优化 Node.js 全局包安装弹窗挂载位置，避免配置区域交互割裂

### 改进 / Improved
- ♻️ 优化 Node.js Registry 与全局包配置区域间距与布局层次，提升可读性
- ♻️ 优化 Python Pip 配置卡片间距与快捷配置区域布局细节
- ♻️ 优化 MongoDB 服务未运行状态提示文案，提示语更通用

---

## [0.5.0] - 2026-03-03

### 新增 / Added
- ✨ 新增 Maven 完整支持：自动下载安装、进度跟踪、`MAVEN_HOME` 初始化、远程仓库配置（含阿里云/清华镜像快捷切换）、本地仓库路径配置
- ✨ 新增 Maven 安装状态检测，未安装时展示独立下载卡片，已安装未初始化时展示独立初始化卡片
- ✨ 新增 Maven `settings.xml` 自动管理，支持读写远程镜像仓库地址与本地仓库路径
- ✨ 新增 Gradle 完整支持：自动下载安装、进度跟踪、`GRADLE_HOME` 自动配置、`GRADLE_USER_HOME` 配置
- ✨ 新增 Gradle 安装状态检测，未安装时展示独立下载卡片，下载完成后自动配置 `GRADLE_HOME`
- ✨ 新增 Java 服务 Maven/Gradle 相关 IPC 命令：检测安装状态、初始化、获取下载进度、设置各环境变量、设置本地仓库
- ✨ 新增 Java 版本信息折叠面板，可查看运行时版本、供应商、安装路径等详细信息
- ✨ 新增 Node.js 服务 Registry 与全局包路径配置的 Tooltip 说明

### 修复 / Fixed
- 🐛 修复 Java 服务面板部分国际化文案缺失的问题，补齐 Maven/Gradle 相关中英文翻译键
- 🐛 修复 Gradle 下载完成后未自动写入 `GRADLE_HOME` 环境变量的问题
- 🐛 修复 Gradle 轮询下载进度完成时未通过 `check_gradle_installed` 获取实际安装路径的问题

### 改进 / Improved
- ♻️ 重构 Java 服务面板 UI，Maven 与 Gradle 配置区域拆分为独立卡片，状态感知更清晰（检测中 / 未安装 / 未初始化 / 已配置）
- ♻️ Maven 初始化入口从内嵌按钮升级为独立状态卡片，视觉层级与下载卡片对齐
- ♻️ 优化 Python 虚拟环境面板与 Pip 配置面板的布局细节

---

## [0.4.0] - 2026-02-27

### 新增 / Added
- ✨ 新增 Python 服务 `uv` 安装检测与冲突告警，提示可能的环境变量与命令行为风险
- ✨ 新增 Python `venv` 一键激活能力，可直接打开终端并自动激活目标虚拟环境
- ✨ 新增 Python `venv` 更多操作入口，支持从列表直接打开虚拟环境文件夹

### 修复 / Fixed
- 🐛 修复 Python 服务设置与虚拟环境相关操作缺少统一反馈的问题，补齐成功/失败提示
- 🐛 修复 Python 服务部分交互文案未完整国际化的问题，统一中英文翻译键与提示内容

### 改进 / Improved
- ♻️ 优化 Python 虚拟环境管理交互，列表操作从单一按钮升级为“激活 + 菜单”组合操作
- ♻️ 优化 Python 配置面板与虚拟环境面板的布局细节与可读性

---

## [0.3.3] - 2026-02-25

### 新增 / Added
- ✨ 无

### 修复 / Fixed
- 🐛 修复设置对话框中部分提示文案缺失国际化的问题，统一中英文文案键
- 🐛 修复设置项切换与错误提示逻辑，失败提示统一使用国际化文案
- 🐛 修复应用退出清理流程：按配置停止活跃环境服务并清理 Shell 环境块
- 🐛 修复启动时自动恢复上次环境的健壮性，规范化并去重历史环境 ID

### 改进 / Improved
- ♻️ 改进终端配置方式：支持自定义终端程序名/路径，留空时回退系统默认终端
- ♻️ 改进导航面板折叠体验，侧边面板收起/展开增加平滑过渡动画

---

## [0.3.2] - 2026-02-24

### 新增 / Added
- ✨ 无

### 修复 / Fixed
- 🐛 无

### 改进 / Improved
- ♻️ 新增QQ群曝光

---

## [0.3.1] - 2026-02-12

### 新增 / Added
- ✨ 新增 Java 23 版本支持（non-LTS, 2024-09-17）

### 修复 / Fixed
- 🐛 修复 Python 预编译下载文件命名格式，统一为小写格式以匹配实际文件名（macOS→macos, ARM64→arm64, X64→x86_64）

### 改进 / Improved
- ♻️ 切换 Java 下载源为 `xopenbeta/java-archive`，采用简化的 URL 和文件命名格式
- ♻️ 简化 Java 架构映射逻辑，移除 Java 8 在 macOS ARM 上的特殊处理
- ♻️ 统一 Java 平台标识符命名（mac→macos）
- ♻️ 简化 Java 版本验证逻辑，移除特定 release 版本号映射

---

## [0.3.0] - 2026-02-11

### 新增 / Added
- ✨ 新增 Java 服务完整支持（后端管理器、Tauri 命令、前端面板、IPC 通信、Hooks）
- ✨ 新增 Java 服务版本管理，支持 JDK 8/11/17/21 的下载与安装
- ✨ 新增 Java 服务面板 UI，支持版本切换、环境变量配置（JAVA_HOME、JAVA_OPTS、MAVEN_HOME、GRADLE_HOME）
- ✨ 新增 Java 服务的默认 metadata 构建器
- ✨ 新增 `ServiceType::Java` 类型定义及相关 PATH/环境变量配置

### 修复 / Fixed
- 无

### 改进 / Improved
- ♻️ 重构 Python 服务下载源，改用自定义预编译版本（xopenbeta/python-archive）
- ♻️ 简化 Python 预编译安装流程，统一 tar.gz/zip 解压方式，移除 Python 2.7 特殊的 .pkg/.msi 处理
- ♻️ 新增 macOS 平台 Python 安装后自动修复 dylib 动态链接库路径
- ♻️ 更新 Python 可用版本列表（3.13.1、2.7.18）

---

## [0.2.1] - 2026-02-09

### 新增 / Added
- 无

### 修复 / Fixed
- 🐛 修正 Shell 管理器配置路径查找逻辑并改进命令行处理
- 🐛 移除冗余的 Python 安装方法并更新错误消息
- 🐛 修复服务类型转换及数据处理问题
- 🐛 修复应用锁机制相关问题
- 🐛 修复 Prompt 提示显示问题
- 🐛 修复多个通用逻辑错误

### 改进 / Improved
- ♻️ 重构 Python 服务面板代码，抽取 VenvView 组件
- ♻️ 优化 Shell 管理器及其配置路径处理

---

## [0.1.5] - 2026-01-15

### 新增 / Added
- 无

### 修复 / Fixed
- 无

### 改进 / Improved
- ♻️ 改进逻辑

---

## [0.1.4] - 2026-01-15

### 新增 / Added
- 无

### 修复 / Fixed
- 无

### 改进 / Improved
- ♻️ 移除 `BaseService` 组件包装，简化服务面板组件层级
- ♻️ 优化 MariaDB、MongoDB、MySQL、Nginx、Node.js、PostgreSQL、Python、SSL 服务面板布局结构
- ♻️ 统一服务面板的布局样式，使用 `p-3` 和 `space-y-4` 进行一致化处理
- 🗑️ 删除未使用的 `service-layout.tsx` 文件
- 💄 优化 Node.js 服务面板的代码结构和缩进
- 💄 改进 Nginx 配置视图的内边距样式

---

## [0.1.3] - 2026-01-14

### 新增 / Added
- 无

### 修复 / Fixed
- 🐛 修复 MongoDB 服务面板用户图标显示问题
- 🐛 修复滚动区域显示问题

### 改进 / Improved
- ♻️ 重构环境面板组件结构，优化代码组织
- ♻️ 将服务路由器组件整合到主面板中，简化组件层级
- ♻️ 抽离环境面板头部为独立组件 `EnvPanelHeader`
- ♻️ 简化 `BaseService` 组件，移除冗余头部渲染逻辑
- ♻️ 恢复导航栏诊断功能按钮显示
- 💄 优化服务面板布局结构和滚动区域

---

## [0.1.2] - 2026-01-12

### 新增 / Added
- ✨ 右键菜单打开环境文件夹
- ✨ nodejs面板显示全局npm包

### 修复 / Fixed
- 无

### 改进 / Improved
- npm prefix 设置优化

---

## [0.1.1] - 2026-01-12

### 新增 / Added
- ✨ pnpm隔离

### 修复 / Fixed
- 无

### 改进 / Improved
- 服务active逻辑优化

---

## [0.0.16] - 2025-12-26

### 新增 / Added
- ✨ 实现自动更新功能，冷启动时自动检查更新
- ✨ 新增更新对话框，展示完整更新内容
- ✨ 支持中英文国际化的更新提示

### 改进 / Improved
- 💄 优化更新对话框 UI，增加滚动区域展示更新内容
- 🌐 完善国际化支持，优化用户体验

---

## [0.0.13] - 2025-12-26

### 新增 / Added
- ✨ 实现自动更新功能，冷启动时自动检查更新
- ✨ 新增更新对话框，展示完整更新内容
- ✨ 支持中英文国际化的更新提示

### 修复 / Fixed
- 🐛 修复环境切换时的状态同步问题

### 改进 / Improved
- 💄 优化更新对话框 UI，增加滚动区域展示更新内容
- 🌐 完善国际化支持，优化用户体验

---

## [0.0.8] - 2025-12-26

### 新增 / Added
- 新功能实现

### 修复 / Fixed
- 修复 bug

### 改进 / Improved
- 性能优化

---

## [0.0.7] - 2025-12-26

### 新增 / Added
- 新功能实现

### 修复 / Fixed
- 修复 bug

### 改进 / Improved
- 性能优化

---

## [0.0.6] - 2025-12-26

### 新增 / Added
- 新功能实现

### 修复 / Fixed
- 修复 bug

### 改进 / Improved
- 性能优化

---

## [0.0.5] - 2025-12-26

### 新增 / Added
- 新功能实现

### 修复 / Fixed
- 修复 bug

### 改进 / Improved
- 性能优化

---

## [0.0.4] - 2025-12-26

### 新增 / Added
- 新功能实现

### 修复 / Fixed
- 修复 bug

### 改进 / Improved
- 性能优化

---

## [0.0.3] - 2025-12-26

### 新增 / Added
- 新功能实现

### 修复 / Fixed
- 修复 bug

### 改进 / Improved
- 性能优化

---

## [0.0.2] - 2025-12-26

### 新增 / Added
- 新功能实现

### 修复 / Fixed
- 修复 bug

### 改进 / Improved
- 性能优化

---

## [0.0.1] - 2025-XX-XX

### 新增 / Added
- 初始版本发布
- 基础功能实现
