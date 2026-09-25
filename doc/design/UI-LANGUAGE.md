# Envis · UI 设计语言

> 版本 v1.0 · 适用范围：`src/pc/**`（桌面端）与 `src/mobile/**`（移动终端端）
> 本文是 Envis 全部界面表现的唯一权威规范。任何页面、组件、样式的取舍以本文为准；
> 本文没有写到的情况，按「已有一致性优先，其次向本文原则靠拢」处理。

---

## 目录

0. [定位与设计原则](#0-定位与设计原则)
1. [色彩系统](#1-色彩系统)
2. [表面层级与层次](#2-表面层级与层次)
3. [字体与排版](#3-字体与排版)
4. [间距与布局栅格](#4-间距与布局栅格)
5. [形状：圆角、描边、阴影](#5-形状圆角描边阴影)
6. [图标](#6-图标)
7. [动效](#7-动效)
8. [组件规范](#8-组件规范)
9. [状态语义](#9-状态语义)
10. [暗色模式](#10-暗色模式)
11. [无障碍](#11-无障碍)
12. [文案与国际化](#12-文案与国际化)
13. [Token 架构与落地](#13-token-架构与落地)
14. [禁止清单](#14-禁止清单)
15. [迁移优先级](#15-迁移优先级)

---

## 0. 定位与设计原则

Envis 是一个**本地开发环境与服务管理器**：用户在这里安装 MySQL/Redis/Nginx、切换项目环境、
看日志、改配置。它的 UI 不是营销页面，是**每天要盯几小时的专业工具**。

### 产品性格

| 维度 | 取值 | 依据 |
| --- | --- | --- |
| 气质 | 安静、精确、可信 | 管理的是本机真实的进程与数据，花哨会削弱信任感 |
| 密度 | 偏紧（compact） | 一屏要放环境 + 服务列表 + 配置表单 + 日志 |
| 参照系 | macOS AppKit 原生 | 目标用户是 Mac/Windows 开发者，原生感 = 零学习成本 |
| 主题色 | **蓝** `212 100% 47%` | 取自最初提交 `38e2150` 的 `--primary` / `--ring` / `--focus` 原值。全应用单一强调色 |

### 六条原则

1. **主题色是蓝色，全应用只有一个强调色。**
   `--primary`、`--focus`、`--ring` 三者取同一个蓝（`212 100% 47%`，亮/暗两套主题同值）。
   主按钮、链接、焦点环、勾选态、进度条、选中指示都用它；除此之外**不引入第二种强调色**。
   中性表面负责层次，蓝色负责"这里可以交互 / 这里是当前项"——
   两者分工明确，不要把蓝色铺成大面积背景，也不要用中性色去承载主操作。

   > 历史注记：最初提交（`38e2150`，HeroUI 设计）的 `--primary`/`--ring`/`--focus` 就是这个蓝。
   > 2026-09-21 的 `6075877`（"Voxt" 风格重构）把它改成了近黑并在注释里写下"不是蓝色"，
   > 而本规范初稿错误地把那个中间状态当成了基准。**以已定套装为准，不以中间重构为准。**

2. **层级用表面，不用阴影。**
   页面内的层次靠 `content1 → content2 → content3 → content4` 四级灰阶铺出来。
   阴影**全应用只有一个**（`shadow-pop`），只给真正浮在内容之上的层。

3. **状态是"色 + 形 + 字"三元组。**
   任何状态都不能只靠颜色表达（色盲用户 + WCAG 1.4.1）。允许用颜色，但必须同时有
   文字，有条件时加一个形状（圆点/图标）。

4. **尺寸来自刻度，不来自手感。**
   字号、圆角、间距、动效时长都必须取自已定义的刻度。出现 `text-[10px]`、`w-[625px]`
   这类临时值时，说明刻度缺了一档 —— 补刻度，而不是就地写死。

5. **默认态安静，交互态才有声音。**
   静止界面上不出现悬停色、不出现高亮边框、不出现闪烁。悬停/按下/选中才引入变化，
   且变化幅度小（背景变化 1～2 级灰阶，或描边出现）。

6. **深色是一等公民，不是反色。**
   两套主题各自调过，`dark:` 变体只用于**极少数确实无法用 token 表达**的场景。
   90% 的 `dark:` 都是坏味道，意味着某个颜色被写死了。

### 与既有实现的关系

本规范**不是推翻现状**，而是把项目里已经存在的一套 macOS 风格体系（见 `src/global.css`
的三级 token）补全、收敛、可执行化。既有的大方向是对的：中性表面、蓝色主题色、
单一阴影、`shadow-pop` 纪律（全库 19 处，无滥用）。问题集中在**刻度缺档**和
**token 失效**两类，不是方向问题。

---

## 1. 色彩系统

### 1.1 三级 Token 结构

```
一级 原始值 (primitives)   --n-*  --c-*        主题无关，只声明一次
        ↓
二级 语义 Token (semantic) --background --content1 --danger ...  在 :root / .dark 重声明
        ↓
三级 组件 Token (component)--radius-* --shadow-* --dur-*         与主题无关
```

**铁律：业务代码只允许使用二级和三级 token。** 页面里出现 `--n-94`、`#333`、`bg-white`
都属于越级，必须改成语义 token。

### 1.2 中性灰阶（一级）

中性阶用**明度锚点**命名，而不是 `gray-100/200` 这种序号 —— 因为亮暗两套主题复用的是
同一组原始值，序号命名会误导。

| Token | 亮色值 | 暗色值 | 来源 |
| --- | --- | --- | --- |
| `--n-100` | `0 0% 100%` | — | 纯白 |
| `--n-98` | `0 0% 98%` | — | windowBackground |
| `--n-96` | `0 0% 96.5%` | — | controlFill |
| `--n-95` | `0 0% 95.5%` | — | modelGroupFill |
| `--n-94` | `0 0% 94%` | — | panelBorder |
| `--n-93` | `0 0% 93.3%` | — | sidebarItemFill |
| `--n-90` | `0 0% 90.2%` | — | controlHoverBorder |
| `--n-30` | — | `0 0% 30%` | 暗色中性阶的一档（位于 n-27 与 n-90 之间的补档） |
| `--n-27` | — | `0 0% 27%` | sidebarItemPressedFill |
| `--n-22` | — | `0 0% 22%` | controlHoverBorder 暗 |
| `--n-20` | — | `0 0% 20%` | controlFill 暗 |
| `--n-18` | — | `0 0% 18%` | modelGroupFill 暗 |
| `--n-16` | — | `0 0% 15.8%` | subtleBorder 暗 |
| `--n-15` | — | `0 0% 15.4%` | panelBorder 暗 |
| `--n-13` | — | `0 0% 12.7%` | dialogBorder 暗 |
| `--n-12` | — | `0 0% 12.5%` | panelFill 暗 |
| `--n-9` | — | `0 0% 9%` | windowBackground 暗 |
| `--n-8` | — | `0 0% 8%` | 近黑（现用于 `--warning-foreground`） |

> **刻度是刻意不均的**：从 98 到 90 每档 1～4 个明度点（细），从 30 到 8 每档 2～9 点（粗）。
> 因为亮色主题需要"几乎看不出但能分辨"的细层次，暗色主题需要更宽的分档才能在低亮度下
> 保持可分辨。改刻度时保持这个密度分布。

### 1.3 语义色（二级）

#### 表面与文字

| Token | 用途 | 亮 | 暗 |
| --- | --- | --- | --- |
| `--background` | 窗口底色（三栏之间的缝隙） | n-98 | n-9 |
| `--foreground` | 主文字 | 15.3% | 86.1% |
| `--muted-foreground` | 次要文字、说明、占位符 | 44% | 59% |
| `--primary` | **主题色**：主按钮填充、选中填充、强调文字 | 主题蓝 | 主题蓝（同值） |
| `--primary-foreground` | 压在主题色上的文字 | n-100 | n-100 |

#### 表面四级

| Token | 语义 | 亮 | 暗 | 典型宿主 |
| --- | --- | --- | --- | --- |
| `--content1` | 面板底 | n-100 | n-12 | 主内容面板、Card、菜单、弹层 |
| `--content2` | 控件填充 / 悬浮行 | n-96 | n-20 | 输入框、Select 触发器、列表 hover |
| `--content3` | 分组块 | n-95 | n-18 | 表单分组、代码块、次级面板 |
| `--content4` | 选中填充 | n-93 | n-22 | 选中行、Toggle 激活态 |

#### 描边

| Token | 语义 | 用途 |
| --- | --- | --- |
| `--border` | 结构描边 | 容器外框、Card 边 |
| `--divider` | 内部分隔 | 列表行分隔、表单字段边、区块内分隔 |
| `--dialog-border` | 浮层描边 | 对话框外框（比 border 更淡，减少"框感"） |
| `--default` | 悬停描边 / 拖拽把手 | 只在 hover / active 出现，**静止态禁止出现** |

> `--border` 与 `--divider` 的差别是**语义**不是深浅：外框用 `border`，内部切线用 `divider`。
> 现有代码里 `border-divider`（361 处）远多于 `border`（5 处），说明大量容器把"内部切线"
> 的 token 用在了外框上 —— 迁移时按语义纠正，不要按视觉纠正。

#### 状态色

| Token | 值 | 语义 | 使用场景 |
| --- | --- | --- | --- |
| `--success` | `142 76% 36%` | 运行中 / 已安装 / 成功 | 服务 running、下载完成 |
| `--warning` | 亮 `32 95% 44%` / 暗 `43 96% 56%` | 需要关注 / 未完成 / 有风险 | 未激活但有进程、端口冲突、证书即将过期 |
| `--danger` | `0 84% 60%` | 失败 / 不可逆操作 | 安装失败、停止服务、删除数据 |
| `--focus` | **同 `--primary`**（主题蓝） | **交互信号** | 焦点环、链接、当前步骤。与 `--primary` 同值，保证"主操作色"与"焦点色"永远一致 |

**`--warning` 在暗色下换成更亮的琥珀**，因为 `32 95% 44%` 在 n-9 上对比度不足；
两个值都保证 ≥ 4.5:1。新增状态色时必须同时给出亮/暗两个值。

**状态色禁止直接当大面积填充。** 允许：
- 文字色：`text-danger`
- 描边色：`border-danger`
- 低透明度底：`bg-danger/10`（且必须配 `text-danger` 文字）
禁止：`bg-danger` 整块填满再放白字（除了 Badge/Dot 这种小面积，或"删除"这类主动危险主按钮）。

#### 浮层遮罩

`--overlay`：`0 0% 0%`，永远以透明度使用（`bg-overlay/40`）。固定值：
- 对话框：`/40` + `backdrop-blur-sm`
- 全屏加载：`/40` + `backdrop-blur-sm`
- 移动端抽屉/弹层：`/45` + `backdrop-blur-sm`

### 1.4 对比度红线

下表是**实测值**（相对亮度公式，白底取 `content1`，暗底取 `content1` = n-12）：

| 组合 | 实测 | 底线 |
| --- | --- | --- |
| `foreground` on `content1` | 14.94:1 ✅ | ≥ 7:1（AAA，正文可长时间阅读） |
| `muted-foreground` on `content1` | 4.95:1 ✅ | ≥ 4.5:1（AA） |
| `muted-foreground` on `content2` / `content3` | 4.58 / 4.50:1 ✅ | ≥ 4.5:1 |
| `muted-foreground` on `content4` | 4.27:1 ⚠️ | — 见下方禁令 |
| `muted-foreground`（暗）on `content1` | 5.51:1 ✅ | ≥ 4.5:1 |
| `primary-foreground`（白）on `primary`（主题蓝） | 4.59:1 ✅ | ≥ 4.5:1 |
| `background` on `foreground`（tooltip 反色） | 14.31 / 13.07:1 ✅ | ≥ 4.5:1 |
| `text-success` on `content1` | 3.33:1 ❌ | — 见下方禁令 |
| `text-warning` on `content1` | 3.16:1 ❌ | — 见下方禁令 |
| `text-danger` on `content1` | 3.78:1 ❌ | — 见下方禁令 |

**两条由此产生的硬性禁令：**

1. **`muted-foreground` 不得用在 `content4`（选中填充）及以上。** 那里改用 `foreground`。
   `content4` 是选中态，选中行上的文字本来就应该是主文字色。

2. **状态色（`success` / `warning` / `danger`）不得作为小字号关键信息的唯一载体。**
   它们作为文字色在白底上只有 3.2–3.8:1，达不到 AA。这三色来源于 macOS 系统色，
   为保持原生观感不改其值，因此**必须在使用处以「色 + 形 + 字」三元组补偿**（见 §9.2）：
   状态色文字旁必须有图标或明确文案，让色觉障碍用户也能读到状态。
   若某处确实需要"只有颜色"的小字状态，应改用 `foreground` 或 `muted-foreground` 表达，
   把状态语义交给形状承担。

> **历史说明**：`--c-label2-l` 原值为 macOS secondaryLabel 的实测合成值 `50.2%`，
> 但在白底上仅 3.95:1。由于本应用把次要文字大量用在 10–12px 的元信息上，
> 该值低于 AA 底线，已调整为 `44%`（content1/2/3 上 4.95/4.58/4.50:1）。
> 这是本规范中**唯一一处有意偏离 macOS 参考值**的改动，理由与回退方式记录在
> `src/global.css` 的 `--c-label2-l` 注释里。

---

## 2. 表面层级与层次

### 2.1 四级表面的选用规则

问自己"这一层离窗口底有多远"，答案决定用哪级：

```
窗口底 (background, n-98/n-9)
  └─ 面板 content1        ← 主内容区、导航栏、Card、菜单、对话框
       └─ 控件/行 content2  ← 输入框、Select、按钮 hover、列表行 hover
            └─ 分组 content3 ← 表单分组块、代码块、内嵌卡片
                 └─ 选中 content4 ← 选中行、Toggle 按下
```

**反向是错的。** 一个 `content3` 的容器里放 `content1` 的子块，会让子块"浮起来"，
和 §2.2 的单一阴影规则打架。

### 2.2 阴影规则

全应用**只有一个阴影值**：`--shadow-pop`。

```css
--shadow-pop-l: 0 6px 20px rgba(0,0,0,.10), 0 1px 3px rgba(0,0,0,.06);
--shadow-pop-d: 0 6px 20px rgba(0,0,0,.45), 0 1px 3px rgba(0,0,0,.30);
```

**允许使用 shadow-pop 的完整清单**（就是全部，不得增加）：
Dialog / AlertDialog / Sheet / Drawer / DropdownMenu / ContextMenu / Menubar /
Select 内容区 / Popover / HoverCard / Tooltip / Toast / Command 弹层。

**禁止使用阴影**：Card、面板、列表行、按钮、输入框、Tab、分组块、
"看起来想浮起来"的任何静态容器。

浮动层在 Tauri 的 WebView 里还要额外加 `backdrop-blur-pop`（20px）+ 半透明底，
模拟 macOS 的材质感。非浮层不使用毛玻璃。

### 2.3 描边 vs 分隔线

| 场景 | 用什么 |
| --- | --- |
| 面板/Card/对话框 外框 | `border-border`（对话框用 `border-dialog-border`） |
| 列表行之间的横线 | `border-divider` |
| 表单字段的框 | `border-divider` |
| 区块标题下的横线 | `border-divider` |
| 悬停时才出现的框 | `border-transparent` → `hover:border-default` |
| 分隔线元素（`<Separator />`） | `bg-divider` / `bg-border`，1px |

**`border-transparent` 预置 + hover 换色**是本项目做列表行的标准手法：
避免 hover 时布局跳动。

### 2.4 三栏骨架

```
┌──────────────┬────────┬─────────────────────────────────┐
│   NavBar     │ 1px 线 │  EnvPanel            │ 1px │ AIPanel │
│  (环境列表)   │        │  (服务)              │     │ (AI)    │
└──────────────┴────────┴─────────────────────────────────┘
                    ↑ 拖动把手
```

| 部位 | 规则 |
| --- | --- |
| 窗口底 | `bg-content2`，让三块面板"浮"在灰色缝隙上 |
| 主面板 | `bg-content1`，圆角 `rounded-lg`(10px)，四周留 4～5px 缝隙 |
| 拖动把手 | 视觉 1px（`bg-content2`），hover 变 `bg-default`；**实际命中区扩展见 §8.9** |
| 面板最小宽度 | NavBar ≥ 10%，EnvPanel ≥ 20%，AIPanel 20%～50% |
| 面板圆角 | 统一 `rounded-lg`。**不允许一个面板 rounded-lg 另一个 rounded-xl** |

> 现状问题：`pages/index.tsx` 里主面板用 `bg-white dark:bg-background`（绕开 token），
> AI 面板用 `bg-white dark:bg-content3`，两者暗色底不一致。应统一为 `bg-content1`。

---

## 3. 字体与排版

### 3.1 字族

| 用途 | Token | 字族 |
| --- | --- | --- |
| UI 文字 | `font-sans` | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif` |
| 等宽（路径、命令、日志、配置、端口、版本号、ID） | `font-mono` | `ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace` |

**必须用 `font-mono` 的内容**（现状漏了很多）：
文件路径、可执行文件名、命令行、环境变量名、日志正文、配置文件内容
（nginx / dnsmasq / hosts / my.cnf）、端口号、版本号、证书序列号、哈希、ID、PID。

**中文栈必须显式声明**：`PingFang SC`（macOS）/ `Microsoft YaHei`（Windows）。
否则 Windows 下中文会落到宋体，与 UI 明显割裂。

### 3.2 字号阶梯

基准是 **13px**（macOS 控件默认）。这是全应用的"正文"，不是 16px。

| Token | 字号/行高 | 语义 | 允许的用途 |
| --- | --- | --- | --- |
| `text-3xs` | 10px / 14px | 微标签 | 角标计数、进度百分比、纯数字/英文的状态点标签。**中文禁止低于 12px** |
| `text-2xs` | 11px / 16px | 辅助 | tag、表格辅助列、时间戳、次要元信息 |
| `text-xs` | 12px / 16px | 次要正文 | **主力**：元信息、描述、列表副标题、表单提示 |
| `text-sm` | 13px / 20px | **正文 / 控件默认** | 输入框、按钮、列表主标题、表单标签、段落 |
| `text-md` | 14px / 20px | 强调正文 | 需要突出的正文、列表主标题加粗版 |
| `text-base` | 16px / 24px | 小标题 | 卡片标题 |
| `text-lg` | 18px / 26px | 区块标题 | 对话框标题、面板区块标题 |
| `text-xl` | 20px / 28px | 面板标题 | 环境名、服务名大标题 |
| `text-2xl` | 24px / 32px | 页面标题 | 欢迎页、空状态主标题 |

> `text-3xs` / `text-2xs` / `text-md` 是**本项目新增档位**（见 §13.2）。
> 它们的存在是为了消灭现在 136 处 `text-[9px]`/`text-[10px]`/`text-[11px]` 和
> 1 处 `text-[15px]` 的临时值。

**关键：每个档位都带行高。** `text-[10px]` 这类任意值只设 font-size，行高会继承父级，
导致 10px 的字拿到 16px 行高、纵向节奏全乱 —— 这是本仓库排版松散感的主要来源之一。

### 3.3 字重

只用三档，别的一律不用：

| Token | 用途 |
| --- | --- |
| `font-normal` (400) | 正文、描述、表单值 |
| `font-medium` (500) | 标签、列表主标题、按钮、区块标题（**主力**） |
| `font-semibold` (600) | 对话框标题、页面大标题、需要强调的数字 |

`font-bold` (700) **禁止**（现有 5 处需降级）。系统 UI 字体的 700 在 13px 下会糊。

### 3.4 排版角色（Role）—— 直接照抄使用

| 角色 | 类名 | 场景 |
| --- | --- | --- |
| 页面主标题 | `text-2xl font-semibold tracking-tight text-foreground` | 欢迎页、空状态 |
| 面板标题 | `text-xl font-semibold text-foreground` | 服务面板大标题 |
| **列表行主标题** | `text-md font-medium text-foreground` | 环境列表行、服务列表行 |
| 区块标题（卡片标题） | `text-sm font-semibold text-foreground` | 服务面板里每个 `bg-content1` 卡片的标题 |
| **列表行副标题** | `text-xs text-muted-foreground`（与标题间 `mt-0.5`） | 状态、版本、路径等依附于标题的第二行。**行内标题/副标题固定为 14 / 12** |
| 微分组标签 | `text-xs font-medium text-muted-foreground uppercase tracking-wider` | 设置分组、列表分组 |
| 正文 | `text-sm text-foreground` | 段落、说明 |
| 次要文字 | `text-xs text-muted-foreground` | 描述、提示、时间 |
| 表单标签 | `text-sm font-medium text-foreground` | 所有字段 Label |
| 表单值 / 等宽值 | `text-sm font-mono text-foreground` | 路径、命令、端口 |
| 数据数字 | `text-sm tabular-nums` | 进度、进程数、内存 |
| 对话框标题 | `text-lg font-semibold leading-none tracking-tight` | DialogTitle |
| 日志正文 | `text-xs font-mono leading-relaxed` | 日志面板 |

### 3.5 层级铁律（这一条比上面任何一条都重要）

**标题必须明显大于它所统领的正文。** 判据是「一眼能看出谁是标题」，而不是「CSS 里数值不同」。

本项目的固定比例：

| 位置 | 标题 | 副标题 | 区别手段 |
| --- | --- | --- | --- |
| 列表行（环境 / 服务） | **14px**（`text-md`）`font-medium` `foreground` | **12px**（`text-xs`）`muted-foreground` | 字号 +1 档 / 字重 500 / 颜色 |
| 卡片区块标题 | **13px**（`text-sm`）`font-semibold` `foreground` | 卡片正文 13px `font-normal` | 同尺寸，靠字重 + 颜色（卡片内成立） |

```
✅ 列表行  14px medium   ←→  12px muted    差一档 + 字重 + 色，成立
✅ 卡片    13px semibold ←→  13px normal   同尺寸靠字重+色，仅在卡片内成立
❌ 列表行  13px medium   ←→  12px muted    标题落在正文档上，且只差 1px，看起来同级
❌ 卡片    12px medium   ←→  13px normal   标题比正文还小，层级倒挂
❌ 同字号  title 13px    ←→  desc 13px     完全无法区分
```

三条由此产生的硬性规则：

1. **行内标题必须取「标题档」而不是「正文档」。** 正文基准是 13px（`text-sm`），
   把它当标题用就没有档位差。列表行标题固定 **14px**（`text-md`）、副标题固定 **12px**（`text-xs`）。
   本项目踩过的坑：标题 13px + 副标题 12px，只差 1px，用户反馈「看起来一样大」。
2. **标题不得小于或等于它所统领的正文。** 卡片标题（13px semibold）与卡片内正文（13px normal）
   同尺寸是可以的，因为字重和颜色已经在区分；但**标题 12px 配正文 13px 是明确错误**。
   本项目的服务面板曾有 34 处卡片标题是 12px `font-medium`，比卡片内的输入框文字（13px）还小。
3. **不要指望用颜色补层级。** `muted-foreground` 为了达到 AA 对比度只能压到 44%，
   与主文字（15.3%）的差异不足以承担层级；层级主要由**字号**承担，字重与颜色是辅助。

**层级只能同时用三种手段表达**：字号（主）→ 字重（辅）→ 颜色（辅）。
只改颜色（例如把标题从 `foreground` 换成 `muted-foreground`）不构成层级。

### 3.6 排版禁令

- 禁止用 `text-[Npx]` / `text-[0.8rem]` 等任意字号。
- 禁止用颜色**代替**层级：`text-3xs text-muted-foreground` 上再叠 `opacity-70` 是双重削弱，禁止。
- 禁止标题小于等于其正文（见 §3.5）。
- 禁止行内标题取 13px（正文档）——固定 14px，副标题固定 12px。
- 禁止 `tracking-*` 用在正文（仅在微标签 `uppercase` 时用 `tracking-wider`）。
- 中文不使用 `italic`。
- 数字对齐场景必须 `tabular-nums`。

---

## 4. 间距与布局栅格

### 4.1 基准

**4px 基准**，取 Tailwind 默认刻度。允许的档位：

| 类 | px | 用途 |
| --- | --- | --- |
| `0.5` | 2 | 图标与文字的微调、Badge 内纵向 |
| `1` | 4 | 图标与文字、紧凑标签组 |
| `1.5` | 6 | 控件内边距（`px-1.5`）、小 gap |
| `2` | 8 | **主力 gap**（横排、竖排都常用） |
| `2.5` | 10 | 控件内边距（`px-2.5`） |
| `3` | 12 | 区块内边距 |
| `4` | 16 | **面板内边距、区块间距** |
| `6` | 24 | 对话框内边距、大区块分隔 |
| `8` | 32 | 空状态上下留白 |

`gap-5` / `p-5` / `gap-7` 等**不在上表的一律不用**（现有 `gap-3`/`p-3` 属允许档）。

### 4.2 场景标准值

| 场景 | 值 |
| --- | --- |
| 面板内边距 | `p-4` |
| 对话框内边距 | `p-6`，标题与内容 `gap-4` |
| 表单字段纵向间距 | `space-y-4`；同一网段多字段用 `space-y-3` |
| 表单 标签→控件 | `space-y-1.5` |
| 表单行内 标签↔控件（横排） | `gap-4`，标签固定 `w-[100px]` 右对齐 |
| 列表行内边距 | `px-2 py-1.5`（紧凑）～ `px-3 py-2`（常规） |
| 列表行间距 | `space-y-1` 或 `space-y-0.5` |
| 区块之间 | `space-y-6`（同一面板内不同区块） |
| 按钮组内间隙 | `gap-2` |
| 图标与文字 | `gap-1.5`（小图标）/ `gap-2`（常规） |
| 设置页分栏 | 标签列 `w-[140px]`，控件列 `flex-1` |

### 4.3 控件高度

| 尺寸 | 高度 | 用途 |
| --- | --- | --- |
| `xs` | `h-6` (24) | 表格内嵌行内按钮、tag |
| `sm` | `h-8` (32) | 表单密集区、工具条 |
| `md`（默认） | `h-9` (36) | **标准控件**：Button / Input / Select |
| `lg` | `h-10` (40) | 页面主 CTA |

同一行的控件必须等高。**禁止出现 `h-7` 的 Button 旁边是 `h-9` 的 Input**（现有多处）。

### 4.4 宽度约束

- 表单控件默认 `w-full`，在宽面板里加 `max-w-[520px]` 避免输入框拉满 1400px 屏幕。
- 对话框宽度按内容定档：简单确认 `max-w-md`(448)、表单 `max-w-lg`(512)、
  复杂配置 `max-w-2xl`(672)、引导/向导 `max-w-3xl`(768)。**禁止 `w-[625px]` 这种魔数**。
- 列表/表格中的 ID、哈希、路径必须 `truncate` + `title` 提示完整值。

---

## 5. 形状：圆角、描边、阴影

### 5.1 圆角刻度

| Token | 值 | 用途 |
| --- | --- | --- |
| `rounded-xs` | 4px | 行内 tag、Badge、小色块、checkbox（**新增**） |
| `rounded-sm` | 6px | 小按钮、菜单项、输入框内嵌件 |
| `rounded-md` | 8px | 次级按钮、Badge、图标按钮 |
| `rounded-lg` | 10px | **主力**：Button、Input、Select、面板、列表行 |
| `rounded-xl` | 12px | Card、分组块、代码块 |
| `rounded-2xl` | 16px | 对话框、大型浮层 |
| `rounded-full` | 9999 | 头像、状态点、开关、进度条 |

嵌套圆角公式：**内层 = 外层 − 内边距**。外层 16 的对话框内边距 24，则内层取 8 左右；
实际做法是内层比外层小两档。

> 现状不一致：`dialog.tsx` 用 `rounded-sm`（6px）当对话框圆角，与本文（16px）和
> global.css 注释（"面板/对话框 16"）都矛盾 —— 对话框是唯一一处违反自己规范的组件。

### 5.2 描边宽度

永远 `1px`（Tailwind `border`）。**禁止 `border-2`**（现有 18 处 `border-2` 需清理），
唯一例外是 Switch 的 `border-2 border-transparent` 占位技巧。

### 5.3 阴影

见 §2.2。补充：**同一时刻屏幕上叠加的浮层不超过 2 层**，三层以上说明交互设计有问题。

---

## 6. 图标

### 6.1 唯一图标库：`lucide-react`

现状是**两个库混用**：`lucide-react`（34 个文件）与 `@radix-ui/react-icons`
（18 个文件，全部在 `components/ui/**` 里，是 shadcn 模板残留）。
两套图标的描边粗细、端点、光学尺寸都不同，放在一起能看出来。

**规则：**
- 业务代码（`src/pc/pages/**`、`src/mobile/**`）**只允许** `lucide-react`。
- `components/ui/**` 里的 radix 图标在改动该文件时顺手换成 lucide 等价物，
  不单独发起大改造。
- 新引入第三方图标集（Font Awesome、heroicons…）**需要在本文件登记**。

### 6.2 尺寸与描边

| 场景 | 类 | 说明 |
| --- | --- | --- |
| 行内 / 按钮内 | `h-4 w-4` (16px) | **默认** |
| 密集表单 / 小按钮 | `h-3.5 w-3.5` (14px) | 不可再小 |
| 区块标题 / 导航项 | `h-4 w-4` | |
| 空状态插图 | `h-10 w-10` ~ `h-12 w-12` + `text-muted-foreground` | |
| 大图标装饰 | `h-16 w-16` | |

- 描边统一 lucide 默认 `stroke-width: 2`，**不要**混用 1.5/2.5。
- 图标**永远**与文字配对，`gap-1.5` 或 `gap-2`。
- 图标色继承文字色（`currentColor`），**不要**单独给图标上色，
  除非表达状态（`text-success` / `text-danger`）。

### 6.3 图标按钮

```tsx
// ✅ 正确
<Button size="icon" variant="ghost" aria-label={t('common.delete')}>
  <Trash2 className="h-4 w-4" />
</Button>

// ❌ 错误：无可访问名、无 label
<Button size="icon" variant="ghost"><Trash2 className="h-4 w-4" /></Button>
```

图标按钮必须满足：`size="icon"` + `aria-label` + `title`（桌面端 hover 提示）。

### 6.4 交互可见性（affordance）—— 三个数字与两条禁令

这一节是被真实踩坑补上的：界面里最常用的几个按钮曾经「太浅、太小、按下反而更淡」。

| 项 | 规范 | 为什么 |
| --- | --- | --- |
| **图标色** | 主操作（导航、工具栏、面板头部）用 `text-foreground`；只有真正的次要/装饰图标才用 `text-muted-foreground` | `muted-foreground` 在白底上 4.95:1，是**勉强达标的次要信息色**，用它承载主操作会让按钮退进背景里 |
| **命中区** | 图标按钮 ≥ 28×28（`h-7 w-7`）；导航栏/工具栏的主操作 32×32（`h-8 w-8`） | 只给图标本身尺寸（16×16）的做法，hover 背景就只有 16px 见方，明显偏小 |
| **图标尺寸** | 行内 14px（`h-3.5 w-3.5`）为下限；按钮与导航项默认 16px（`h-4 w-4`） | 12px 图标在密集界面里几乎看不清 |
| **hover 填充** | 用 `content4`，不要在 `background`/`content1` 面上用 `content2`/`content3` | `content2`(96.5%) 压在 `background`(98%) 上只差 1.5 个明度点，hover 几乎看不见 |
| **按下反馈** | 用更深的填充（`active:bg-pressed`）或 `active:scale-95` | **禁止按下时变淡**（`active:text-muted-foreground/70`、`active:opacity-60`）——按下应该更强调，不是更弱 |

**禁令：不要拿「某个参考设计里信息图标的浅灰处理」套到主操作上。**
参考设计里的浅灰图标按钮（如设置侧栏的 info icon）语义是「次要信息」；
套到导航栏的设置/主题/终端/诊断上，就把主操作降级成了背景装饰。

### 6.5 不要用语义不符的图标

`RefreshCw`（刷新）在本项目被当成 loading spinner 用了 **52 次**，
而 `Loader2`（真正的 spinner）只用了 2 次。

**规则：加载中一律用 `Loader2` + `animate-spin`**，或统一封装 `<Spinner />`。
`RefreshCw` 只用于"刷新/重新加载"这个动作本身。

---

## 7. 动效

### 7.1 时长刻度

| Token | 值 | 用途 |
| --- | --- | --- |
| `duration-100` | 100ms | 按下反馈、颜色即时切换 |
| `duration-150` | 150ms | **悬停 / 焦点**（主力） |
| `duration-250` | 250ms | 浮层进出、面板展开收起（本项目既有主力值） |
| `duration-400` | 400ms | 大范围布局变化、页面级过渡 |

现状分布：`duration-250`(48) 为主，杂有 100/200/300/500/1000。收敛为上述四档。
`duration-1000` 只允许出现在骨架屏脉动这类循环动画里。

### 7.2 缓动

| 场景 | 缓动 |
| --- | --- |
| 默认（悬停、颜色） | `ease-out` |
| 浮层进入 | `ease-out` |
| 浮层退出 | `ease-in` |
| 布局/尺寸变化 | `cubic-bezier(0.2, 0, 0, 1)`（macOS 风格，用 `ease-[cubic-bezier(0.2,0,0,1)]`） |

避免 Tailwind 默认的 `ease`（`cubic-bezier(0.4,0,0.2,1)`）用于尺寸变化，它在中段过慢。

### 7.3 只动这些属性

**允许动画**：`background-color`、`color`、`border-color`、`opacity`、`transform`（scale/translate/rotate）。
**禁止动画**：`width`、`height`、`top`、`left`、`margin`、`box-shadow`、`filter`。

**`transition-all` 应当收敛为具体属性**（现有 67 处 `transition-all`）。
尤其列表项、表格行这类多实例元素，`transition-all` 会让浏览器监听全部属性。

### 7.4 该动与不该动

**要动**：浮层进出（fade + 轻微 zoom 95→100）、悬停色、加载指示、进度条、
面板展开收起、toast 进出、拖拽排序的位移动画。

**不要动**：
- 列表首次渲染的逐项入场动画（工具类应用打开要快，不要表演）
- 数字滚动动画（会让人以为数据在变）
- 悬停时的位移/放大（`hover:scale-105` 之类）
- 页面切换转场

**按下反馈**：`active:scale-95` 是本项目现有手法，但**只允许用在 Button 上**，
且必须与 `duration-100` 配对（现在是 `duration-250`，按下去会有"黏"的感觉）。

### 7.5 无障碍

必须支持 `prefers-reduced-motion: reduce`：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
```

目前全项目**没有任何一处**处理 reduced-motion（`theme.ts` 里的 `prefers-color-scheme`
是主题监听，不算）。

---

## 8. 组件规范

### 8.1 Button

```
变体          背景          文字        描边              用途
default       primary       primary-fg  —                 一屏一个的主操作
secondary     content2      foreground  —                 次级操作
outline       content1      foreground  divider           工具条、表单内操作
ghost         transparent   foreground  —                 图标按钮、列表行内操作
link          transparent   focus       —                 导航式链接
destructive   danger        danger-fg   —                 删除/停止等不可逆操作
```

| 属性 | 规范 |
| --- | --- |
| 尺寸 | `sm` h-8 / 默认 h-9 / `lg` h-10 / `icon` h-9 w-9 |
| 圆角 | `rounded-lg`（10px）；`sm` 尺寸可 `rounded-md` |
| 字号 | `text-sm`（13px）；`sm` 尺寸用 `text-xs` |
| 字重 | `font-medium` |
| 图标 | 左侧，`h-4 w-4`，与文字 `gap-2` |
| 焦点 | `focus-visible:ring-2 ring-focus ring-offset-2 ring-offset-background` |
| 禁用 | `disabled:opacity-50 disabled:pointer-events-none` |
| 加载 | 图标换成 `<Loader2 className="animate-spin" />`，**保留原文字宽度**，禁用点击 |

**一屏一个 `default`（主）按钮。** 出现两个说明信息层级没想清楚。

**按钮文案是动词**："安装 Node.js" 而不是 "确定"；"停止 MySQL" 而不是 "提交"。

**破坏性按钮**：
- 在对话框里：`variant="destructive"`
- 在列表行里：默认 `ghost`，hover 时才变 `text-danger`
- **必须二次确认**，且用应用内 `<AlertDialog>`，**禁止 `window.confirm()`**
  （现有 2 处：`mongodb-service.tsx:419`、`VenvView.tsx:159`）

### 8.2 Input / Textarea

```tsx
<Input className="h-9 rounded-lg border-divider bg-content2 text-sm
                  focus-visible:ring-2 focus-visible:ring-focus" />
```

| 属性 | 规范 |
| --- | --- |
| 高度 | `h-9`（与 Button/Select 一致） |
| 填充 | `bg-content2`（**不是** `bg-background` —— 输入框是"控件"不是"面板"） |
| 描边 | `border-divider`；聚焦时 `border-focus` **且** 有 `ring-2 ring-focus` |
| 占位符 | `placeholder:text-muted-foreground` |
| 禁用 | `disabled:opacity-50 disabled:cursor-not-allowed` |
| 错误 | `border-danger` + 下方 `text-xs text-danger` 说明 |

**聚焦必须有可见反馈。** 现状 `input.tsx` 聚焦时 `focus:border-divider` —— 和静止态
完全一样，等于没有焦点指示。这是必须修的（见审计 P1）。

**Textarea**：默认 `min-h-[60px]`，配置内容（nginx / hosts / dnsmasq）
必须 `font-mono text-xs leading-relaxed` + 可纵向 resize。

**密码/密钥字段**：必须带显示/隐藏切换（眼睛图标），
且默认 `type="password"`。现有大量数据库密码字段缺这个。

### 8.3 Select

- 触发器与 Input 等高（`h-9`）、同圆角、同填充（`bg-content2`）。
- 内容区 `bg-content1` + `border-divider` + `shadow-pop` + `rounded-sm`。
- 选项 `rounded-md`，选中项左侧加 `Check` 图标，**不要**只靠背景色区分。
- 选项超过 12 个时**必须支持搜索**（用 `Command` 组合），
  版本号列表、数据库列表都属此类。
- 触发器文字超长 `[&>span]:line-clamp-1` + `title`。

### 8.4 Switch / Checkbox / Radio

| 控件 | 尺寸 | 选中态 | 说明 |
| --- | --- | --- | --- |
| Switch | `h-5 w-9`，滑块 `h-4 w-4` | 轨道 `bg-primary`（亮）/ `bg-focus`（可选） | 用于"立即生效"的设置项 |
| Checkbox | `h-4 w-4` `rounded-xs` | `bg-primary` + 白色对勾 | 多选、列表批量操作 |
| Radio | `h-4 w-4` | `border-focus` + `text-focus` 圆点 | 互斥选项 |

- 每个控件都必须有 `<Label htmlFor>` 关联，点击 label 可切换。
- 禁用态 `disabled:opacity-50 disabled:cursor-not-allowed`。
- **不要用 Switch 表达"提交型"设置**（如"是否删除数据库"），那要用 Checkbox + 主按钮。

### 8.5 Tabs

- 容器 `bg-content2` `rounded-lg` `p-1`，触发器 `rounded-md`。
- 激活项 `bg-content1` + `text-foreground`；未激活 `text-muted-foreground`。
- 激活态**不能只有背景色**差异，必须同时有字重差（`font-medium` vs `font-normal`）
  或底部指示条。
- Tabs 超过 5 个时改用侧边导航。

### 8.6 Dialog / AlertDialog

| 类型 | 圆角 | 宽度 | 用途 |
| --- | --- | --- | --- |
| AlertDialog | `rounded-2xl` | `max-w-md` | 确认/警告，最多 1 个主按钮 |
| Dialog（表单） | `rounded-2xl` | `max-w-lg` | 创建/编辑实体 |
| Dialog（复杂） | `rounded-2xl` | `max-w-2xl` | 多步配置、证书签发 |
| Dialog（引导） | `rounded-2xl` | `max-w-3xl` | CA 安装引导这类图文说明 |

结构固定为：

```
DialogHeader
  DialogTitle        text-lg font-semibold          ← 必需
  DialogDescription  text-sm text-muted-foreground  ← 必需
DialogContent 区     gap-4
DialogFooter        按钮右对齐，取消在左、主操作在右
```

**`DialogTitle` 和 `DialogDescription` 是必需的**（Radix 无障碍要求：屏幕阅读器要播报
标题；缺失时 Radix 会在控制台告警并且对话框对读屏用户是"空白页"）。
现状 114 处 `DialogContent` 只有 35 处有 `DialogTitle` —— 有 79 处对话框没有标题。

关闭按钮：右上角 `absolute right-4 top-4`，`h-4 w-4`，带 `sr-only` 文案，`aria-label`。
**`Esc` 必须能关闭**（Radix 默认行为，不要 `onEscapeKeyDown={e => e.preventDefault()}`）。
破坏性对话框初始焦点落在"取消"上，**不要**落在危险按钮上。

### 8.7 反馈：Toast / Loading / Empty / Error

**Toast 只用 sonner。**
现状有两套：sonner（25 个文件在用）+ `components/ui/toast.tsx` + `use-toast.ts`
（Radix 版，无人引用，是死代码）。删除 Radix 那套。

| 类型 | 规范 |
| --- | --- |
| 位置 | `bottom-center` |
| 容器 | `bg-content1 border border-divider rounded-2xl` + 毛玻璃 |
| 时长 | 成功 3s / 信息 4s / 错误 6s（错误必须够长，且可手动关） |
| 内容 | 标题（必填）+ 描述（可选）+ 操作按钮（可选） |
| 文案 | 描述**结果**不描述动作："MySQL 已启动" 而不是 "正在启动…" |

**Toast 不用于表单校验错误** —— 那是内联反馈的职责。

**Loading**：三种粒度
1. 全局初始化 → 全屏遮罩 + spinner（`Loading.tsx`）
2. 区块加载 → 骨架屏（`Skeleton`），**不要**用 spinner 占位
3. 按钮加载 → 按钮内 `<Loader2 className="animate-spin" />`

**Empty State**：统一结构，居中，`py-8`：

```
<Icon className="h-10 w-10 text-muted-foreground" />
标题   text-sm font-medium text-foreground
说明   text-xs text-muted-foreground max-w-[280px] text-center
操作   <Button variant="outline" size="sm">
```

**Error State**：`text-danger` 图标 + 标题 + **可执行的下一步**
（"重试"/"查看日志"/"打开设置"）。只报错不给出口是不合格的。

### 8.8 列表与表格

| 项 | 规范 |
| --- | --- |
| 行高 | 紧凑 `h-8`，常规 `h-10`，带副标题 `h-12` |
| 行 hover | `bg-content2`（暗色） / `hover:bg-content2` |
| 行选中 | `bg-content4`，**同时**左侧加 2px `bg-focus` 指示条 |
| 行内边距 | `px-2 py-1.5` |
| 分隔 | `border-b border-divider`，最后一行去掉 |
| 列对齐 | 文本左对齐，数字右对齐 + `tabular-nums` |
| 长值 | `truncate` + `title`；路径/命令用 `font-mono` |
| 排序 | 表头可点击，激活列显示方向箭头 |
| 批量操作 | 出现选择框时，顶部替换为操作条，显示"已选 N 项" |

**拖动排序**：把手必须始终可见（`GripVertical`，`h-4 w-4`，`text-muted-foreground`），
hover 变 `text-foreground`；拖动中 `opacity-50` + `shadow-pop`；
放置目标位置显示 2px `bg-focus` 插入线。

### 8.9 拖动把手（Panel Resizer）

视觉 1px，但**命中区必须加宽到 ≥ 8px**：

```tsx
<ResizableHandle className="relative w-px bg-content2
                            before:absolute before:inset-y-0 before:-left-1 before:w-[9px]
                            hover:bg-default data-[resize-handle-active]:bg-focus" />
```

- hover / 拖动中变 `bg-focus`。
- 光标：`cursor-col-resize`（`react-resizable-panels` 默认已处理）。
- 双击恢复默认宽度（可选增强）。

### 8.10 日志 / 控制台查看器

| 项 | 规范 |
| --- | --- |
| 字体 | `font-mono text-xs leading-relaxed`（**必须等宽**） |
| 背景 | `bg-content3`（暗色下更深一档更易读） |
| 行 | 不换行 + 横向滚动；提供"自动换行"开关 |
| 自动滚动 | 默认跟随尾部；用户手动上滚时**自动暂停**并显示"回到最新"按钮 |
| 行号 | 可选，`text-3xs text-muted-foreground select-none` |
| 级别着色 | ERROR `text-danger` / WARN `text-warning` / INFO `text-foreground` / DEBUG `text-muted-foreground` |
| 操作 | 复制全部、清空、下载、搜索（`Ctrl/Cmd+F`） |
| 空态 | "暂无日志" + 当前服务状态 |

### 8.11 状态指示（StatusView）

见 §9。**绝不允许只输出一个颜色不同的文本。**

---

## 9. 状态语义

### 9.1 状态 → 表现 的映射表

Envis 有两组状态：环境/服务激活状态（`ServiceDataStatus`）与进程状态（`ServiceStatus`），
外加下载状态（`DownloadStatus`）。

| 状态 | 颜色 | 形状 | 文案 key |
| --- | --- | --- | --- |
| 已激活 / active | `text-success` | ● 实心圆点 | `service_item.status.active` |
| 未激活 / inactive | `text-muted-foreground` | ○ 空心圆点 | `service_item.status.inactive` |
| 运行中 / running | `text-success` | ● + 文字 | `service_item.status.running` |
| 已停止 / stopped | `text-muted-foreground` | ○ + 文字 | `service_item.status.stopped` |
| 错误 / error | `text-danger` | ▲ 警告图标 | `service_item.status.error` |
| 未知 / unknown | `text-muted-foreground` | ? | `service_item.status.unknown` |
| 未安装 / notinstalled | `text-muted-foreground` | ↓ 下载图标 | `...not_installed` |
| 排队中 / pending | `text-warning` | ◷ | `...pending` |
| 下载中 / downloading | `text-warning` + 进度条 | ◐ + 百分比 | `...downloading` |
| 已下载 / downloaded | `text-focus` | ▪ | `...downloaded` |
| 安装中 / installing | `text-warning` + 进度条 | ◐ + 百分比 | `...installing` |
| 已安装 / installed | `text-success` | ✔ | `...installed` |
| 已取消 / cancelled | `text-muted-foreground` | ⊘ | `...cancelled` |
| 失败 / failed | `text-danger` | ✕ | `...failed` |

**关键修正**：现状把 `pending / downloading / downloaded / installing` **四态全部映射成
`text-success`**（`service-data-item.tsx:365-370`），用户无法区分"正在下载"和"已装好"。
上表把"进行中"归到 `warning` + 进度条，"已下载待安装"归 `focus`，"已完成"才归 `success`。

### 9.2 三元组原则

状态表达 = **颜色 + 形状 + 文字**，三者至少取其二，颜色永远不能是唯一手段。

推荐实现：抽一个 `<StatusBadge status tone label />` 组件，
内部查表决定颜色/图标，业务代码只传枚举值。
**现状是每个服务面板各写一套 `cn(status === X && 'text-success')` 链**，
这是跨文件不一致的根源。

### 9.3 进度表达

| 场景 | 组件 |
| --- | --- |
| 已知百分比 | `Progress` + 右侧 `text-2xs tabular-nums` 百分比 |
| 未知时长 | 不确定进度条（`animate-pulse` 条）或 spinner |
| 步骤型（安装 5 步） | Stepper + 当前步高亮 `text-focus` |
| 后台任务 | 列表行内联进度 + 顶部全局进度条（多任务时） |

**`Progress` 的颜色**：默认 `bg-focus`；失败 `bg-danger`；完成 `bg-success`。
注意 `progress.tsx` 现在用 `bg-primary`，暗色下会因为 `--primary` 解析失败而不可见。

---

## 10. 暗色模式

### 10.1 机制

- `darkMode: ['class']`。
- **`.dark` 是普通类选择器，不是 `html.dark`** —— 这样移动端终端这种恒定深色子树
  可以在自己的根节点挂 `dark` 类重声明变量，而不受全局主题影响。这是本项目的
  有意设计，不要改成 `html.dark`。
- 主题状态：`light` / `dark` / `system`，由 `src/theme.ts` 写到 `documentElement`，
  `system` 模式监听 `prefers-color-scheme` 变化并实时切换。

### 10.2 规则

1. **优先用 token，不用 `dark:`。** 需要写 `dark:bg-X` 时先问："这个颜色为什么不能由
   token 自动切换？" 90% 的情况答案是"因为我写死了亮色值"。
2. 允许 `dark:` 的**全部**合法场景（白名单）：
   - 毛玻璃层的透明度差异：`dark:bg-content1/40`
   - 图片/图标的亮度补偿：`dark:brightness-90`
   - 第三方组件无法用 token 覆盖时的补丁
   - 阴影（已由 `--shadow-pop` 处理，无需 `dark:`）
3. 白名单外的 `dark:` 变体全部应改为 token。现状 `welcome-fragment.tsx` 一个文件就有
   **66 处 `dark:`**，需要重点治理。
4. **禁止 `dark:text-white`** —— 白不是 token。需要更亮的文字时用 `text-foreground`；
   如果 `foreground` 不够亮，说明 token 该调，而不是就地写白。
5. 暗色下**降低**饱和度感知：状态色在暗色背景上要取更亮的值（`--warning` 已示范）。
6. **`color-scheme` 必须声明**：`:root { color-scheme: light }` / `.dark { color-scheme: dark }`，
   否则原生滚动条、`<input type="date">`、下拉框、表单自动填充会保持亮色。
   现状完全缺失。

### 10.3 图片与第三方资源

- devicon 服务图标等彩色资源在暗色下需 `brightness` 补偿或加浅色底；
  **不要**用 `filter: brightness(1.2)` 这种写死值（现状 `service-data-item.tsx:452`），
  改用 `dark:brightness-[0.9]` 明确的暗色规则，或用 CSS 变量。
- 本地截图/图表：提供亮暗两套。

---

## 11. 无障碍

| 项 | 要求 | 现状 |
| --- | --- | --- |
| 焦点可见 | 所有可聚焦元素必须有 `focus-visible:ring-2 ring-focus ring-offset-2 ring-offset-background` | Input 聚焦无指示 |
| 焦点不被遮挡 | 焦点环不能被 `overflow-hidden` 裁掉 | 需排查 |
| 键盘可达 | Tab 顺序符合视觉顺序；列表行可 Enter 触发；`Esc` 关浮层 | 基本可用 |
| 对话框 | 必须有 `DialogTitle`；焦点陷阱；关闭后焦点回到触发元素 | 79 处缺 Title |
| 图标按钮 | `aria-label` + Tooltip | 9 处缺失 |
| 状态 | 不只用颜色（§9.2） | 违反 |
| 触控目标 | ≥ 24×24px（桌面）/ ≥ 44×44px（移动） | 部分图标按钮 28px |
| 对比度 | §1.4 红线 | `muted-foreground` on `content4` 需修 |
| 表单 | 每个控件有 `<Label htmlFor>`；错误用 `aria-describedby` + `aria-invalid` | 大量 placeholder 当 label |
| 图片 | 装饰性 `alt=""`，信息性 `alt` 有意义 | 已较好 |
| 读屏 | 动态内容（下载进度）用 `aria-live="polite"` | 缺失 |
| 动效 | 尊重 `prefers-reduced-motion` | 缺失 |

### 焦点环规范

```tsx
// ✅ 标准焦点环
'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus
 focus-visible:ring-offset-2 focus-visible:ring-offset-background'
```

`ring-offset-color` **必须显式声明**。Tailwind 默认 offset 是白色（`#fff`），
在暗色下会变成一圈刺眼的白边（现状 `button.tsx`、`badge.tsx` 等都只写了
`ring-offset-2` 没写颜色）。

---

## 12. 文案与国际化

### 12.1 i18n 机制

- `i18next` + `react-i18next`，资源 `src/pc/i18n/locales/{en,zh}.json`。
- 现状 **1412 个 key，中英完全对齐**，这是很好的基础，务必保持。
- **禁止在 `.tsx` 里写死面向用户的字符串**（现有少量残留，如
  `HostManagementView.tsx:421` 的「还没有配置任何 host」）。
- key 命名：`模块.子模块.语义`，全小写下划线，如 `mysql_service.no_databases`。

### 12.2 文案风格

| 规则 | 示例 |
| --- | --- |
| 按钮是动词短语 | 「安装 Node.js」✅ / 「确定」❌ |
| 用主动语态 | 「服务已停止」✅ / 「服务被停止」❌ |
| 说结果不说过程 | 「MySQL 已启动」✅ / 「正在启动…」❌ |
| 错误给下一步 | 「端口 3306 被占用，改为 3307？」✅ / 「启动失败」❌ |
| 不用感叹号 | 「环境已删除」✅ / 「环境已删除！」❌ |
| 术语统一 | 统一用「环境 / 服务 / 版本 / 端口 / 激活」，不要混用「实例/应用/号」 |
| 中英之间加空格 | 「安装 Node.js」✅ / 「安装Node.js」❌ |
| 省略号用 `…` | 「加载中…」✅ / 「加载中...」❌ |
| 句末不加句号（短标签） | 「未安装」✅ / 「未安装。」❌ |

### 12.3 术语表

| 中文 | English | 不要用 |
| --- | --- | --- |
| 环境 | Environment | 项目、空间、实例 |
| 服务 | Service | 应用、软件 |
| 激活 / 停用 | Activate / Deactivate | 启用、开启、启动 |
| 安装 / 卸载 | Install / Uninstall | 下载（下载是 install 的子步骤） |
| 启动 / 停止 | Start / Stop | 运行、关闭（进程层面才用"运行中"） |
| 版本 | Version | 版号 |
| 端口 | Port | 口 |
| 日志 | Log | 记录 |
| 证书 | Certificate | 凭证 |

### 12.4 长度弹性

- **不要**把标签和控件写死在同一行固定宽度里。中文→英文→德文会膨胀 30%～60%。
- 按钮宽度由内容决定（`whitespace-nowrap` + padding），**不要** `w-[80px]`。
- 侧边栏/导航项用 `truncate` + `title`。
- 标签在英文下过长的场景改用上下布局（label 在上），而不是加宽固定列。

---

## 13. Token 架构与落地

### 13.1 文件职责

| 文件 | 职责 |
| --- | --- |
| `src/global.css` | 三级 token 的**唯一**声明处 + 全局基础样式 |
| `tailwind.config.js` | token → utility class 的**唯一**映射处 |
| `src/pc/components/ui/*` | 原子组件，样式全部来自 token |
| `src/pc/pages/**` | 业务布局，只用二级/三级 token |

### 13.2 本次补充的 token

**修复**

| Token | 问题 | 修复 |
| --- | --- | --- |
| `--c-blue` | 主题色一度被写成 macOS 焦点蓝 `211 100% 52%`，而最初的已定套装是 `212 100% 47%` | 恢复为已定套装原值，并让 `--primary` / `--focus` / `--ring` 三者同值 |
| `--primary` | 曾被改成近黑（`.dark` 下引用一个**未声明**的 `--n-30`，导致暗色下 `bg-primary`/`text-primary`/`border-primary` 全部解析失败，主按钮、链接、选中态、进度条、勾选框集体失效） | 亮/暗两套主题统一指向主题蓝，不再依赖中性档位 |

**新增**

| Token | 值 | 用途 |
| --- | --- | --- |
| `--radius-xs` | 4px | 替代裸 `rounded`（4px）与 `rounded-sm` 的混用 |
| `--text-3xs` / `--lh-3xs` | 10px / 14px | 微标签 |
| `--text-2xs` / `--lh-2xs` | 11px / 16px | 辅助文字 |
| `--text-md` / `--lh-md` | 14px / 20px | 强调正文 |
| `--font-sans` / `--font-mono` | 见 §3.1 | 显式字族（含中文字族） |
| `--dur-1..4` | 100/150/250/400ms | 动效时长语义化 |
| `--ease-standard` | `cubic-bezier(0.2,0,0,1)` | macOS 风格缓动 |

**全局基础样式补充**

- `color-scheme: light` / `.dark { color-scheme: dark }`
- `::selection` 背景 `--focus` / 前景白
- `@media (prefers-reduced-motion: reduce)` 全局降级
- `text-rendering: optimizeLegibility` 仅用于标题；正文保持默认
- 滚动条：亮色 `--default`，暗色 `--n-27`；hover 加深
- `overflow-wrap: break-word` + `word-break` 处理长路径

### 13.3 命名规则

- 一级：`--n-{明度}` / `--c-{语义}-{l|d}` / `--shadow-pop-{l|d}`
- 二级：语义名词，**不带方向/明度**（`--border` 而不是 `--border-light`）
- 三级：`--{类别}-{档位}`（`--radius-lg`、`--dur-2`）
- HSL 三段式无单位书写：`0 0% 30%`（配合 `hsl(var(--x))` 才能加透明度）
- Tailwind 颜色名用点分语义：`content1` / `muted-foreground` / `dialog-border`

**禁止**：在二级 token 名里出现具体色相（`--blue-500`）、
出现 `-100..900` 序号（`content1-100`）—— 这类命名无法随主题切换。

### 13.4 业务代码写法

```tsx
// ✅ 正确
<div className="bg-content1 border border-divider rounded-xl p-4">
  <Label className="text-sm font-medium">端口</Label>
  <Input className="h-9 font-mono" />
  <p className="text-xs text-muted-foreground">默认 3306</p>
</div>

// ❌ 错误
<div className="bg-white dark:bg-[#1f1f1f] border border-gray-200 rounded p-4">
  <label className="text-[13px] font-bold text-gray-900">端口</label>
  <input className="h-[36px] border-gray-300" />
  <p className="text-[10px] text-gray-400">默认 3306</p>
</div>
```

### 13.5 分期落地

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| P0 | 主题色恢复为已定套装的蓝（`--primary`/`--focus`/`--ring` 同值）；补齐字阶/字族/动效 token；补 `color-scheme`、`::selection`、reduced-motion；修复失效的字色类 | ✅ 已完成 |
| P1 | `components/ui/**` 收敛到 token（对话框圆角、Input 焦点、ring-offset 颜色、勾选色、阴影清单）；删除 Radix toast 死代码 | 🔶 大体完成（对话框圆角与 toast 死代码待做） |
| P1 | i18n：修失效键、三页接入 i18n、补 `DialogTitle` 与图标按钮可访问名 | ✅ 已完成 |
| P2 | 抽公共组件：`Spinner` / `EmptyState` / `ErrorState` / `StatusBadge` / `SectionHeader` / `SettingsRow` / `ConfirmDialog` / `LogViewer` | ⏳ 待做 |
| P3 | 九个服务面板去重（现有 4 个 1600+ 行的近拷贝文件），统一为「服务页模板 + 配置差异」 | ⏳ 待做 |
| P4 | 消除 `text-[Npx]`（136 处）、`bg-white`、`dark:` 补偿（476 处冗余）、魔数宽高；图标统一到 lucide | ⏳ 待做 |

### 13.6 自动化守卫

设计语言里凡是**能被静态检查验证**的规则，都已落成脚本并挂到 `npm run build`，
避免同类缺陷再次出现：

| 脚本 | 检查内容 |
| --- | --- |
| `scripts/check-i18n.mjs` | ① 词条表重复键（`JSON.parse` 会静默保留最后一个，键数校验发现不了）② en/zh 叶子键对齐 ③ `t('literal')` 与 `<Trans i18nKey>` 是否可解析——不可解析时 i18next 会把原始 key 直接渲染到界面上 |
| `scripts/a11y-scan.mjs` | ① 每个 `<DialogContent>` 子树里是否有 `<DialogTitle>`（Radix 要求对话框有可访问名）② 纯图标控件是否有 `aria-label`/`aria-labelledby`/`title`/`sr-only`（已屏蔽注释，避免把注释掉的 JSX 当真实节点） |

```
npm run check:i18n     # ✓ en N = zh N 叶子键，0 重复键，全部引用可解析
npm run check:a11y     # ✓ 全部对话框有标题，全部纯图标控件有可访问名
npm run build          # 上面两个守卫 → tsc → vite build
```

后续如果新增了可静态验证的规则（例如「禁止 `text-[Npx]`」「禁止裸 `rounded`」），
建议同样加成脚本而不是写进评审清单——写进文档的规则会被忘记，写进构建的不会。

### 13.7 本轮未落地的规则（需要人工评审）

以下规则无法靠脚本可靠判定，仍依赖评审：

- 表面层级选得对不对（`content1..4` 是否匹配嵌套深度）
- 一屏是否出现两个主按钮
- 空状态 / 错误态 / 加载态的三态完整性（错误态是否给了可执行的下一步）
- 破坏性操作是否都有确认、且确认文案说明了后果
- 状态表达是否满足「色 + 形 + 字」三元组
- 文案是否是动词短语、是否描述结果而非过程

---

## 14. 禁止清单

写 UI 代码时，以下写法一律不接受：

| 禁止 | 替代 |
| --- | --- |
| `text-[10px]` `text-[11px]` `text-[9px]` `text-[15px]` `text-[0.8rem]` | `text-3xs` / `text-2xs` / `text-md` |
| `bg-white` `bg-black` `text-white` `text-black` | `bg-content1` / `bg-overlay` / `text-foreground` / `text-primary-foreground` |
| `bg-gray-*` `text-blue-*` 等 Tailwind 调色板 | 语义 token |
| `bg-white/5` `bg-white/10` 当暗色 hover | `bg-content2` / `bg-content4` |
| `text-default-300/400/500/600` | `text-muted-foreground`（**这些类不存在，写了等于没写**） |
| `dark:text-white` `dark:bg-white/5` | 用 token；说明 token 缺档就补 token |
| `shadow-sm/md/lg/xl/2xl` | `shadow-pop`（仅浮层）或不加 |
| `rounded` 裸值 | `rounded-xs`（4px）或 `rounded-lg`（10px） |
| `border-2` | `border` |
| `w-[625px]` `h-[38px]` 等魔数 | 取刻度值或加语义 token |
| `window.confirm()` / `window.alert()` | 应用内 `AlertDialog` / sonner toast |
| `font-bold` | `font-semibold` / `font-medium` |
| `hover:scale-105` 等悬停位移 | 只改颜色/描边 |
| `transition-all` 加在列表项上 | `transition-colors` |
| `size="icon"` 无 `aria-label` | 加 `aria-label` + Tooltip |
| `DialogContent` 无 `DialogTitle` | 补 Title + Description |
| 两套 toast / 两套图标库 | sonner + lucide |

---

## 15. 迁移优先级

按「用户可感知的严重度 × 修复成本」排序：

1. **主题色恢复为蓝** —— 一行 CSS，同时修复"暗色下主按钮/链接/勾选/进度条失效"与"主按钮被改成近黑"两个问题。（本次已做）
2. **修失效的字色类** `text-default-4/5/600`（11 处）→ `text-muted-foreground`。（本次已做）
3. **补 `color-scheme`** —— 一行，修复原生控件在暗色下的违和。
4. **Input 焦点可见** —— 改 `input.tsx` 一处，影响全站表单。
5. **`ring-offset` 颜色** —— 改 button/badge/switch 等，修复暗色下的白圈。
6. **对话框圆角 + DialogTitle** —— 圆角一处；Title 需逐个补，优先补用户高频路径。
7. **AI 面板 `prose` 全部失效** —— 装 `@tailwindcss/typography` 或改用手写 markdown 样式。
8. **状态语义从"4 态同色"改为三元组** —— 抽 `StatusBadge`。
9. **`text-[Npx]` 收敛到字阶**（136 处）—— 全局替换 + 目检。
10. **`window.confirm` 替换**（2 处）。
11. **九个服务面板去重** —— 最大的工程量，放在稳定期做。

---

## 附录 A：常用片段速查

```tsx
// 面板
<div className="flex flex-col h-full bg-content1 rounded-lg border border-divider overflow-hidden">
  <header className="flex items-center gap-2 px-4 h-12 border-b border-divider shrink-0">
    <h2 className="text-sm font-semibold text-foreground truncate">{title}</h2>
    <div className="ml-auto flex items-center gap-2">{actions}</div>
  </header>
  <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6">{children}</div>
</div>

// 设置行（标签 + 控件）
<div className="flex items-start gap-4">
  <Label className="w-[100px] shrink-0 pt-2 text-sm font-medium text-right">{label}</Label>
  <div className="flex-1 min-w-0 space-y-1.5">
    {control}
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
</div>

// 分组块
<section className="rounded-xl border border-divider bg-content3 p-4 space-y-4">
  <h3 className="text-sm font-semibold text-foreground">{title}</h3>
  {children}
</section>

// 等宽值（路径/命令/端口）
<code className="font-mono text-sm text-foreground bg-content2 px-1.5 py-0.5 rounded-xs">
  {value}
</code>

// 空状态
<div className="flex flex-col items-center justify-center py-8 text-center">
  <Icon className="h-10 w-10 text-muted-foreground mb-3" />
  <p className="text-sm font-medium text-foreground">{title}</p>
  <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">{description}</p>
  {action && <div className="mt-4">{action}</div>}
</div>

// 图标按钮
<Button size="icon" variant="ghost" aria-label={label} title={label}>
  <Icon className="h-4 w-4" />
</Button>

// 焦点环（所有自绘可聚焦元素）
"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
```

---

## 附录 B：Token 一览

完整定义见 `src/global.css`。速查：

```
表面   background · content1 · content2 · content3 · content4
文字   foreground · muted-foreground · primary-foreground · *-foreground
描边   border · divider · dialog-border · default · ring · focus
状态   success · warning · danger
浮层   overlay · shadow-pop · backdrop-blur-pop
形状   radius-xs/sm/md/lg/xl/2xl
字号   text-3xs · text-2xs · text-xs · text-sm · text-md · text-base · text-lg · text-xl · text-2xl
字族   font-sans · font-mono
动效   duration-100/150/250/400 · ease-out · ease-in · ease-[var(--ease-standard)]
间距   4px 基准，档位 0.5/1/1.5/2/2.5/3/4/6/8
高度   h-6 / h-8 / h-9 / h-10
```
