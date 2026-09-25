# Envis · 前端 UI 审计报告

> 审计对象：`src/pc/**` + `src/mobile/**`（32,169 行）
> 规范依据：[`UI-LANGUAGE.md`](./UI-LANGUAGE.md)
> 原始分区报告：[`../ui-audit-raw/`](../ui-audit-raw/)（5 份，共 3,940 行，含全部 file:line 证据）

---

## 0. 基线说明（重要，先读）

本报告的结论建立在**当前工作区**，而不是 `HEAD`：

| | |
| --- | --- |
| Git | `HEAD = 8ea75f1`，工作区**本来就有 22 个未提交的改动**（一轮进行中的 "Voxt" 风格重构：`components/ui/*` 的描边/圆角、`nav-bar` 的图标尺寸与操作按钮样式） |
| 本轮追加 | token 层修复（见 §7）。**没有**逐个改业务页面 |
| 因此 | 报告中的行号相对本工作区；`git stash` 后部分行号会偏移 |
| 方法 | 5 个并行子审计，逐一 `read`/`grep` 验证；"某个类不生效"这类判断全部通过**真实 Tailwind 构建产物**核对（`tailwindcss 3.4.19`），不是目测 |

审计过程中发现的、被本轮修复的问题，在 §7 单独列出，**不计入**下面的缺陷统计。

---

## 1. 总量结论

| 严重度 | 数量 | 说明 |
| --- | --- | --- |
| **P0** | 6 类 | 功能可见地坏掉：界面显示原始 i18n key、markdown 无排版、暗色下控件失效、输入框无边界、主导航键盘不可用 |
| **P1** | 41 项 | 明显偏离设计语言或造成真实使用障碍 |
| **P2** | 38 项 | 一致性与打磨问题 |
| 已在本轮修复 | 见 §7 | 含全部 6 类 P0 |

> **本报告是首轮审计的原始记录**；§7 记录了随后一轮集中修复的内容与验证方式。
> 修复覆盖了全部 6 类 P0、以及 i18n / 无障碍 / 破坏性确认 / 状态语义 / 排版等处的一批 P1。
> 剩余项在 §3、§4 中按主题保留，可直接作为后续工单使用。

### 一句话总结

> **方向是对的，地基是漏的。**
> 项目已经有一套自洽的 macOS 风格体系（中性表面、近黑主按钮、单一 `shadow-pop` 且 19 处无滥用、
> 中英 1412 键完全对齐、零调色板/零 hex 硬编码、零多余阴影），这说明设计意图清晰且被执行过。
> 真正的问题集中在两处：
> **（a）少量 token/类失效，导致整块 UI 静默失去样式**；
> **（b）跨文件的同类界面各写一遍，导致九个服务面板与三个配置页彼此不一致。**

### 数据总览

| 维度 | 实测 | 结论 |
| --- | --- | --- |
| 语义 token 使用 | `bg-content1` 413 · `text-muted-foreground` 403 · `border-divider` 361 · `text-foreground` 269 | ✅ 语义层被真正采纳，不是摆设 |
| 非语义颜色 | 仅 40 处、8 个值（`bg-white` 11 / `bg-white/5` 16 / `bg-white/10` 6 / `bg-black/45` 2 / `text-white` 2 …） | ⚠️ 数量少但每处都带一个 `dark:` 补丁 |
| Tailwind 调色板类（`bg-gray-*` 等） | **0** | ✅ |
| 十六进制字面量 | **0** | ✅ |
| 阴影 | 只有 `shadow-pop`（19 处），`shadow-sm/md/lg/xl` = 0 | ✅ 纪律极好 |
| 字号 | 命名档 704（`text-xs` 515 / `text-sm` 177）+ **任意值 138**（`text-[10px]` 97、`text-[11px]` 33、`text-[9px]` 3、`text-[15px]` 1、`text-[0.8rem]` 3） | ❌ 声明基准 13px，实际基准是 12px |
| `dark:` 变体 | 597 处，其中 **476 处是冗余空操作**（如 `bg-background dark:bg-background`） | ❌ 大部分在给写死的颜色打补丁 |
| 焦点可见 | `focus-visible:` 23 处 vs `outline-none` 58 处 | ❌ 覆盖严重不足 |
| 图标按钮无可访问名 | 56 个 | ❌ |
| 对话框 | 真实计数：`<DialogContent` 36 + `<AlertDialogContent` 10 = 46 个；标题 35 + 10 = 45 个 | ✅ 实际只有 1 处缺标题（`components/ui/command.tsx`）。**本报告初稿写的「114 vs 35」是 grep 伪计数**——每个对话框会贡献 import 行 + 开标签 + 闭标签共 3 次 `DialogContent` 命中 |
| i18n | en 1412 = zh 1412，双向零缺失 | ✅ 但存在重复键与整页硬编码，见 P0-1 |
| 重复代码 | mariadb↔postgresql 归一化行重合 **80.8%**；mysql↔mariadb 78.7%；mysql↔pg 67.6% | ❌ 最长逐字重复块 55 行 |

---

## 2. P0 —— 必须修

### P0-1 · 三类 i18n 破口：界面上会直接出现原始 key / 与语言无关的中文

**(a) 14 个 `t()` 键在词条表里不存在 → 屏幕上直接渲染 key 字符串**

| 位置 | 键 |
| --- | --- |
| `redis-service/index.tsx:263,372,401,509,516,523,530,578` | redis 相关 13 个 |
| `redis-service/index.tsx:200,205,485` | toast 文案 |
| `mongodb-service.tsx:1709,1847` | `common.create` |

Redis 的命名空间是**双向错位**的：13 个"用了但没定义"，同时有 **20 个"定义了但没人用"**——
包括 `reset_irrecoverable`、`running_warning` 这两段危险操作警告，中英词条都写好了却没接上。

```tsx
// redis-service/index.tsx:263 —— 界面会显示 "redis_service.xxx" 字面量
{t('redis_service.reset_irrecoverable')}
```

**(b) 三个整页完全绕过 i18n，全中文硬编码**

`nginx-service/NginxConfigView.tsx`（20+ 处）、`dnsmasq-service/DnsmasqConfigView.tsx`（22 处）、
`host-service/HostManagementView.tsx`（38 处）没有任何 `useTranslation`。

讽刺的是**词条早就写好了**：`nginx_service.*` 24 键、`dnsmasq_service.*` 23 键、
`host_service.*` 34 键，中英双语齐全。`dnsmasq_service.macos_resolver_hint` 甚至带着
`<0>` 占位符，正好对应 `DnsmasqConfigView.tsx:170` 硬编码的那个
`<span className="font-mono">/etc/resolver</span>`。

这纯粹是接线工作，没有翻译成本。英文用户当前看到的是整页中文。

**(c) 移动端零 i18n**

`src/mobile/**` 的 `useTranslation` 数量 = 0，16 处 JSX 字面量字符串，
外加一条**随生产包发出去的英文调试横幅**（`mobile/App.tsx:57-58`）。

**(d) 其它散点**

- `nav-bar-item.tsx:117` 硬编码 `'Active'/'Inactive'`，而 `nav_bar_item.active/inactive` 词条存在；`unknown` 状态被显示成 "Inactive"（信息错误，不只是文案问题）
- 权限标签在 mysql / mariadb 里硬编码英文 `'Read'` / `'ReadWrite'`（各 4 处），而 pg / mongo 用的是 `privilege_read` 键
- `nav-bar.tsx:168` 中文 toast 兜底；`settings-dialog.tsx:86-92` 按后端字面量（`'计算中...'`/`'计算失败'`）判断样式，而 core 只会输出 `计算中`/`未知` → 失败分支是死代码
- `service-data-list.tsx:134` 侧栏标题硬编码 `Servs`；`service-data-item.tsx:259` 硬编码 `请输入密码`

**(e) 词条表自身有重复键（键数校验发现不了）**

- `en.json` 顶层 `"welcome"` 出现两次（第 530 / 645 行）
- `zh.json` 的 `advanced_options` / `use_prebuilt` / `compile_from_source` 各出现两次（374-376 vs 377-379）

`JSON.parse` 保留后者，因此前一块是**静默死词条**。当前"键数相等"的检查方式无法发现这类问题，
建议加一条 CI 校验（保留原始文本做重复键扫描）。

---

### P0-2 · AI 面板的 Markdown 完全没有排版

`ai-panel.tsx:47` 用了 15 个 `prose*` 类，但 **`@tailwindcss/typography` 根本没有安装**，
也没有注册进 `tailwind.config.js` 的 plugins。真实构建产物里 `grep -c prose` = **0**。

后果：AI 回答的标题、列表、引用、代码块**全部退化成浏览器默认样式**，
并且 `prose-pre:overflow-x-auto` 也是死的 → 长代码块**溢出且无法横向滚动**。

雪上加霜的是 `rehype-highlight` 在用（`ai-panel.tsx:49`），但**没有任何 highlight.js 主题 CSS**
（`grep -rn hljs src` = 0），所以 `hljs-*` 的 span 全无颜色。

**修复**：二选一
1. 装 `@tailwindcss/typography` 并在 config 注册（同时补一份 hljs 主题）；
2. 或者去掉 `prose` 依赖，在 `global.css` 里手写一组 `.md-body h1/h2/pre/code/ul` 样式。

推荐 (1)，改动最小。

---

### P0-3 · 暗色下 Tooltip 不可读（**本轮已修**）

```tsx
// tooltip.tsx:22（修复前）
'bg-foreground text-primary-foreground'   // 暗色：86.1% 灰底 + 白字 = 1.38:1
```

`.dark` 下 `--foreground` = 86.1% 浅灰，`--primary-foreground` = 纯白 → **1.38:1**，几乎看不见。
Tooltip 有 13 个使用方，`env-panel-header.tsx:22-35` 是高频入口。

**已修为 `text-background`**（实测亮色 14.31:1 / 暗色 13.07:1）。

---

### P0-4 · 暗色下主按钮、链接、勾选、进度条集体失效（**本轮已修**）

`.dark { --primary: var(--n-30) }` 引用了一个**从未声明**的变量。
`hsl(var(--primary))` 在计算值阶段失效 → `background-color`/`color`/`border-color` 全部退回初始值。

实际后果（暗色下）：
- 所有主按钮 = 透明底 + 白字 → 看起来像幽灵按钮
- `text-primary` 链接失去所有链接样式
- `switch` / `checkbox` / `progress` / `skeleton` 的选中与填充态不可见

**已修**：`:root` 声明 `--n-30: 0 0% 30%`（白字对比度 8.59:1）。
用速查页验证：暗色主按钮现已可见。

> 这是整个审计里性价比最高的一行修复：一个变量，救回整套暗色主题。

---

### P0-5 · 15 处输入框与所在卡片同色 → 输入框"消失"

```tsx
// redis-service/index.tsx:344 等 15 处
<div className="... bg-content1 ...">          {/* 卡片 */}
  <Input className="... bg-content1 ..." />     {/* 输入框：与卡片 1.00:1 */}
</div>
```

填充对比度 **1.00:1**，唯一的边界线索是 `border-divider` 的 ~1.07:1。
用户看不见可输入区域在哪。

分布：`redis-service` 5 处、`java-service` 7 处、`nodejs-service` 3 处、`rust-service` 2 处、
`mongodb-service` 1 处。**mysql / mariadb / postgresql 是对的**（用 `bg-content2`）——
这正好说明是复制粘贴时漏改，而不是有意的设计。

**修复**：`bg-content1` → `bg-content2`（控件填充档），与 SQL 面板对齐。

---

### P0-6 · 环境列表是 `div onClick`，键盘完全不可用

```tsx
// nav-bar-item.tsx:89-97
<div
  className={...}
  onClick={...}
  {...attributes} {...listeners}   // dnd-kit，但不是键盘可达
>
```

没有 `tabIndex`、没有 `role="button"`、没有 `onKeyDown`。
**应用最核心的导航（切换环境）无法用键盘操作**，也拿不到焦点，读屏用户完全访问不到。

同类问题：服务列表行（`service-data-item.tsx:420-435`）、host 行（`HostManagementView.tsx:406-455`）
也都是不可聚焦的 `onClick` div，且行内操作按钮只在 hover 时显形（部分已在本轮补 `focus-within`）。

**修复**：列表行改为 `role="button" tabIndex={0} onKeyDown`（Enter/Space），
或直接用 `<button>`；行内操作按钮保持 `opacity-0` 但补 `group-focus-within:opacity-100`。

---

## 3. P1 —— 明显偏离或造成真实障碍

按主题归并（每项都有 file:line 证据，细节见 `../ui-audit-raw/`）。

### 3.1 跨屏幕一致性（最高价值的一组）

| # | 问题 | 证据 |
| --- | --- | --- |
| 1 | **"什么时候保存"有三种心智模型**：批量显式保存（custom-service）/ 写穿无保存（ssl、部分 python）/ 按字段单独保存（nginx 路径、dnsmasq 路径、pip）。用户无法建立一个统一预期 | 九个服务面板 |
| 2 | **空状态有 5 种规格**：`py-6` 虚线+`bg-content1` / `py-6` 虚线无底 / `py-8` 无底无图标 / `py-8`+48px 图标 / 实线边框 | `PathConfigView.tsx:176`、`HostManagementView.tsx:420`、`certificate-list.tsx:97`、`VenvView.tsx:272` |
| 3 | ~~破坏性确认有 3 套~~ → **原生 `window.confirm` 已全部替换**为应用内 `AlertDialog`（mongodb 用户删除、python venv 删除）。**仍待统一**：redis reset 的弹窗没有不可恢复警告，而 `redis_service.reset_irrecoverable` 词条是现成的、未被引用 | ✅ 部分修复 |
| 4 | ~~完全无确认的破坏性操作~~ → **均已补 `AlertDialog` 二次确认**：环境删除、日志「清空全部」、日志面板「刷新页面」。**仍待补**：host 删除（`HostManagementView.tsx:476`，一次点击永久改 `/etc/hosts`） | ✅ 大部分修复 |
| 5 | **保存按钮文案复制粘贴错误**：别名与环境变量两个视图的保存按钮都渲染 `custom_service.save_path_config`（"保存路径配置"），而它们保存的不是路径 | `AliasesConfigView.tsx:264`、`EnvironmentVariablesView.tsx:222` |
| 6 | 初始化弹窗与重置弹窗**共用同一个 `dialogData` 对象**（5 个 DB 面板全部如此）→ 重置弹窗的"新 root 密码"会被预填成刚在初始化里输入的密码 | `mysql:71,611,696`、`mariadb:68,607,693`、`pg:75,648,733`、`mongo:111,795,942`、`redis:72,487,535` |
| 7 | 新增行的 disabled 逻辑写反：`disabled={!isServiceDataActive && isLoading}`（应为 `\|\|`）→ 服务未激活时"添加"按钮仍可点，能加出一排禁用输入框 | `PathConfigView.tsx:141` vs 三个兄弟视图 |
| 8 | 九屏都没有日志/控制台查看器（全仓 `whitespace-pre` = 0、`<pre>` = 0）。服务面板里有安装/启动按钮，却看不到输出 | 九个服务面板 |
| 9 | 配置正文（路径、端口、host、库名）**不是等宽**；只有被掩码的密码、npm 包名、tooltip 里的环境变量名是 | redis、nasm 的 `font-mono` = 0 |
| 10 | `services-dashboard.tsx:186` `bg-gradient-to-br` 没有终点色 → 死类；`:218` 是全面板唯一一处渐变背景，与"安静的中性表面"相悖 | 见左 |

### 3.2 表面与层级

- **`bg-white dark:bg-content1/40` 嵌套在 `bg-content1` 卡片里**（7 处）：`ssl-service/index.tsx:222`、`ca-install-guide.tsx:39,82,126`、`certificate-list.tsx:113`、`NginxConfigView.tsx:409,423`、`HostManagementView.tsx:430`。同一视觉角色在兄弟文件里又写作 `bg-content2`（`VenvView.tsx:257`）或 `bg-content2/50`（`ca-install-guide.tsx:45`）
- **选中行在亮色下没有任何填充**：`service-data-item.tsx:430` 一个字符串里塞了 4 个冲突的类（`dark:bg-content3` + `dark:bg-content2`、`dark:border-default` + `dark:border-divider`），Tailwind 全部产出，由样式表顺序决定谁生效；亮色分支是 `bg-background`（98%）铺在 `background`（98%）侧栏上 → "我在编辑哪一行"看不出来
- **物理分隔线不可见**：`index.tsx:91` 拖拽把手用 `bg-content2`，而根容器也是 `bg-content2` → 三栏之间没有可见分隔
- **中栏与 AI 栏暗色底不一致**：`bg-white dark:bg-background` vs `bg-white dark:bg-content3`，亮色下相同、暗色下层级相反；相邻面板还用不同的描边 token（`divider` vs `border`）
- **日志面板自带矛盾类**：`log-panel.tsx:187` 同时有 `bg-content1` + `bg-content2`、`rounded-lg` + `rounded-2xl`；作为本区域内唯一的浮层，它**没有 `shadow-pop`**
- `VenvView.tsx:272` 空状态用 `bg-content1` 嵌在 `bg-content1` 容器里 → 零对比
- `HostManagementView.tsx:440` 分组块用 `bg-content2`（应为 `content3`）
- 三处 `border-t` / `border` 不带颜色，靠全局 `* { border-color }` 兜底，而兄弟文件都显式写了 `border-divider` → 同一分隔线在不同屏幕深浅不同
- `add-service-data-menu.tsx:511,553` 用 `border-border`（面板外框色）当区块内分隔

### 3.3 排版

- **声明基准 13px，实际基准 12px**：`text-xs` 515 次 vs `text-sm` 177 次。九个服务面板里 `text-xs` 296 / `text-[10px]` 52 / `text-sm` 50
- **标题比它标题的正文还小**：区块标题是 12px（`text-xs`），正文是 13px（`text-sm`）→ 层级倒挂
- **136 处任意字号**（`text-[10px]` 97、`text-[11px]` 33、`text-[9px]` 3、`text-[15px]` 1、`text-[0.8rem]` 3）。这些类只设 `font-size`，**行高继承父级** → 10px 的字拿到 16px 行高，这是界面"松垮感"的主要来源
- 约 15 处 `text-[10px]` 包着中文或会被翻译的文案，违反项目自己刚写入的"中文不得低于 12px"
- 正文极少用 `font-mono`（36 处），但路径/命令/端口/日志都该用
- `tabular-nums` 只有 1 处（进度）；所有数字列都会跳动
- `font-bold` 5 处（规范只允许 400/500/600）
- 五个不同字重混用（`font-normal` 14 / `medium` 206 / `semibold` 48 / `bold` 5）

### 3.4 无障碍

- ~~79 处对话框没有 `DialogTitle`~~ —— **此项为误报，已撤回**。真实计数是 46 个对话框 / 45 个标题，全仓只有 `components/ui/command.tsx` 的 `CommandDialog` 缺标题（已补 `sr-only` 的 `DialogTitle`）。初稿的「114 vs 35」源于对 `DialogContent` 做字符串计数：每个对话框会产生 import、开标签、闭标签三次命中
- **56 个图标按钮无可访问名**（无 `aria-label` / 无 `sr-only` / 无 `title`）
- 焦点可见覆盖不足：23 处 `focus-visible:` vs 58 处 `outline-none`；`Input` 的焦点指示本轮才补上
- 点击目标过小：大量 `h-5 w-5`(20px) / `h-6 w-6`(24px) / `h-7 w-7`(28px)，低于桌面 24px、移动 44px 底线
- `nav-bar-item.tsx:127`、`service-data-item.tsx:540` 的 hover 显形按钮（本轮已补 `focus-within`；**同类写法在别处仍存在**）
- `<button>` 嵌在 Radix `CollapsibleTrigger`（本身是 `<button>`）里 → 非法 HTML，点击/键盘路由不可预期（`certificate-list.tsx:114-167`）
- SAN 删除是一个 12px 的可点击 `<svg>`（`issue-certificate-dialog.tsx:154-157`）
- 状态大量**只靠颜色**表达（见 3.5）
- 两个弹窗同时挂载时 `id="validityDays"` 重复（`ca-init-dialog.tsx:127` / `issue-certificate-dialog.tsx:107`）
- `aria-live` 缺席：下载进度变化不会播报
- **`prefers-reduced-motion` 此前完全缺失**（本轮已补）

### 3.5 状态语义

- **四态同色**：`service-data-item.tsx:365-370` 把 `pending` / `downloading` / `downloaded` / `installing` **全部**映射成 `text-success`。用户无法区分"正在下载"和"已装好"
- 状态用**纯文本颜色**表达（无圆点、无图标），色觉障碍用户读不到；`unknown` 与 `inactive` 同为 `text-muted-foreground`
- 9 个服务面板各自写一套 `cn(status === X && 'text-success')` 链，没有共享的 `StatusBadge`
- 状态色作为文字在白底上不达 AA（`success` 3.33:1、`warning` 3.16:1、`danger` 3.78:1，实测）
- `unknown` 在导航栏被显示为 "Inactive"（语义错误）
- `services-dashboard.tsx:384,396,413` 曾在白底上用 `text-default`（90.2% 灰 = 1.25:1，不可见；本轮已修为 `text-muted-foreground`）

### 3.6 表单与交互

- **端口是自由文本**：9 个文件里 **0 个**用 `type="number"` / `inputMode` / `min` / `max` / `pattern`，端口可以是 `"abc"`。同类问题在"天数""内存""连接数"字段上重复
- 校验反馈只有 toast，**没有内联错误**；必填项只有 host 编辑弹窗用 `*` 标记
- **密码/密钥字段没有显示切换**（数据库 root 密码、redis 密码、mongodb 用户密码全部只有 `type="password"`）
- Redis 侧**没有任何前端校验**，且 start/stop/restart **没有 `catch`** → 失败静默（`redis-service/index.tsx:175-209, 211-252`）
- `focus-visible:ring-danger` **不产出任何 ring**（`mongodb-service.tsx:1216`）——`ring-<color>` 单独使用只设 `--tw-ring-color`，没有 `ring` 宽度
- 别名/环境变量视图会把**空的键值行静默丢弃**，同时弹出成功 toast（`AliasesConfigView.tsx:108-123`）
- host 编辑的删除/开关不保存、无回滚，且与列表页不同步
- nginx 解析器在找不到配置时**会伪造** `listen 80 (Default)` / `localhost`（`NginxConfigView.tsx:181-187`）——把不存在的配置展示给用户
- dnsmasq **根本没有配置编辑器**：`setConfigContent(res.data.content)` 执行了（`:72`），但 `configContent` / `isSaving` / `setIsSaving` 从未被读取，整个面板里唯一一处 `Textarea` import 是未使用的（`:9`）

### 3.7 移动端

- **不是恒定深色子树**：只有 `android-terminal-panel/index.tsx:39` 挂了 `dark` 类，而 `mobile/App.tsx:16` 调 `setAppTheme('system')` → **浅色手机上会出现"浅色外壳包着深色终端"的硬接缝**
- **触控目标全部低于 44×44**：14 个 `<button>` 和 7 个 `<input>`，多数 19–28px
- 零平台集成：无 `env(safe-area-inset-*)`、无 `viewport-fit=cover`（`mobile.html:6`）、无 `visualViewport` 键盘避让、无横竖屏处理、无 `inputMode` / `enterKeyHint` / `autoCorrect`（**shell 输入框会被手机键盘自动首字母大写和自动更正**）、无 `touch-action` / `overscroll`
- `mobile.html` 标题仍是 `Tauri + React + Typescript`（`index.html` 同）

### 3.8 AI 面板

- **无复制、无重新生成、无"回到最新"**；自定义 `userHasScrolledRef` 会**永久停止**自动滚动，没有任何回到底部的入口
- **零 ARIA**（`aria-*` / `role=` 命中数 = 0）
- 错误态只是一个普通助手气泡（同样的 `bg-content2`、无图标、无 danger 色、无重试）
- `Textarea` 是 `resize-none` + `min-h-[80px] max-h-[200px]`，但**没有自动增高实现** → `max-h` 是死 CSS，输入框永远长不过 80px

### 3.9 其它功能性

- **日志/诊断面板在生产环境永远是空的**：`hooks/log.ts:9` 与 `useRustLogger.ts:23` 都 gate 在 `!PROD`，但导航栏仍然暴露"诊断"按钮 → 用户点开是空面板
- `use-toast.ts` / `toast.tsx` / `toaster.tsx`（Radix 版）是**死代码**，全仓无人引用；实际用的是 sonner（25 个文件）。两套 toast 并存容易误用
- `calendar.tsx` 按 react-day-picker **v8** 的 `classNames` 键编写，实际安装 **9.13.2** → 22 个键里 17 个被静默忽略（被 `shims.d.ts:3` 的 `DayPicker: any` 掩盖；当前 0 个引用者）
- `custom-scrollbar` 类（`welcome-fragment.tsx:122`）全仓无定义
- `AutoChdirView.tsx` 整个文件与 `ProjectDirectoryView.tsx` 逻辑逐字重复，且**全仓无人 import**
- `NginxConfigView.tsx:230,234,244` 残留 `console.log('zws nginx start')`
- `scroll-area.tsx:15` 残留调试类 `qqkk`；`patch.css:4` 残留注释掉的 `background-color: pink`

---

## 4. P2 —— 一致性打磨

| # | 问题 |
| --- | --- |
| 1 | **476 / 597 个 `dark:` 是冗余空操作**（`bg-background dark:bg-background` 这类）。真正需要的只有约 120 个 |
| 2 | **141 处用 `dark:bg-content1/40` 手工模拟表面阶梯**，而 token 里已有 `content1..4` |
| 3 | 三个描边 token（`border` / `divider` / `dialog-border`）承担同一个视觉角色；`border-divider` 361 次 vs `border` 5 次，说明"内部分隔"的 token 被大量用在外框上 |
| 4 | `--overlay` 亮暗两套主题取值相同；遮罩强度不统一：对话框 `/40`，`alert-dialog` / `sheet` / `drawer` `/80` |
| 5 | 61 处裸 `rounded`（4px，不在 6/8/10/12/16 刻度上）；本轮新增的 `rounded-xs` 用了 0 次 |
| 6 | 动效时长散落在 100/200/250/300/500/1000；`--dur-1/2/3` 三个 token 无人引用 |
| 7 | 缓动只有 4 处显式声明，其余走 Tailwind 默认 `ease`（中段偏慢） |
| 8 | `61` 处 `animate-spin`，没有共享的 `<Spinner />`；**`RefreshCw` 被当 spinner 用了 52 次，而 `Loader2` 只用了 2 次** |
| 9 | 没有共享的 `EmptyState` / `ErrorState` / `StatusBadge` / `SectionHeader` / `LogViewer`；三态与状态指示各写各的 |
| 10 | **两套图标库混用**：`lucide-react`（34 文件）与 `@radix-ui/react-icons`（18 文件，全在 `components/ui/**`，shadcn 模板残留）。两者描边粗细与光学尺寸不同 |
| 11 | 24 个 shadcn 原生组件从未被引用（carousel / menubar / navigation-menu / breadcrumb / pagination / input-otp / aspect-ratio / hover-card / context-menu 等） |
| 12 | 圆角不统一：面板用 10px（控件档）而非 16px（面板档）；浮层在 6 / 10 / 16 三种之间跳 |
| 13 | `dialog.tsx` 对话框用 `rounded-sm`（6px），与 `global.css` 自己声明的"面板/对话框 16"矛盾 |
| 14 | `* { border-color }` 漏了 `::before` / `::after` → 伪元素边框无色 |
| 15 | 双主题毛玻璃补丁 `[class*="backdrop-blur"]` 是冗余的（构建产物已自动产出 `-webkit-backdrop-filter`） |
| 16 | `dialog.tsx:41` 在不透明的对话框表面上加 `backdrop-blur-pop`（20px 模糊，零视觉效果） |
| 17 | `index.html` / `mobile.html` 标题仍是 `Tauri + React + Typescript`，且**没有主题引导脚本** → 首屏闪烁（FOUC） |
| 18 | 39 个 `!` 强制覆盖、`patch.css` 用 `!important` 修 ScrollArea 内部 DOM，属于脆性写法 |
| 19 | 日志面板是本仓裸 `rounded`（18 处）与 `text-[11px]`（13 处）最集中的文件 |
| 20 | `services-dashboard.tsx` 用固定 `w-16/w-20/w-28` 表格列宽，长语言会截断 |

---

## 5. 已经在做对的地方（不要动）

明确列出来，避免后续重构顺手破坏：

| 项 | 状态 |
| --- | --- |
| 三级 token 架构（原始值 → 语义 → 组件） | ✅ 结构清晰，注释带实测来源 |
| 语义 token 的实际采纳率 | ✅ 413 / 403 / 361 / 269 次，说明开发者真的在用 |
| 单一阴影纪律 | ✅ 全仓 `shadow-sm/md/lg/xl` = 0，`shadow-pop` 只出现在浮层原语里 |
| 无调色板、无 hex | ✅ `bg-gray-*` 等 = 0，十六进制字面量 = 0 |
| 卡片外壳一致性 | ✅ `p-3 rounded-xl border border-divider bg-content1` 在环境面板里出现 **17 次且逐字相同** |
| 圆角纪律 | ✅ 除裸 `rounded` 外，`sm/md/lg/xl/2xl` 都在刻度上 |
| i18n 键完整性 | ✅ en 1412 = zh 1412，双向零缺失 |
| 错误反馈渠道 | ✅ 九个服务面板统一用 sonner toast |
| 对话框可访问名 | ✅ 46 个对话框里 45 个本来就有标题（唯一缺的已补），说明团队一开始就在认真写 `DialogTitle` |
| `.dark` 用普通类选择器而非 `html.dark` | ✅ 有意设计，让移动端能挂恒定深色子树（虽然目前只挂了一半） |
| 本轮新增的 token 层 | ✅ `--n-30` / 字阶 / 字族 / `--dur-*` / `color-scheme` / `::selection` / reduced-motion |

---

## 6. 建议的修复顺序

按「用户可感知程度 ÷ 改动成本」排序。

| 顺序 | 动作 | 状态 |
| --- | --- | --- |
| 1 | 定义 `--n-30` | ✅ 已完成 |
| 2 | 替换失效类（`text-default-*` / `text-warning-600` / `z-100` / `text-default` 当文字色） | ✅ 已完成 |
| 3 | 修 tooltip 暗色对比度（1.38:1 → 13:1） | ✅ 已完成 |
| 4 | 补 `color-scheme` / `::selection` / reduced-motion / 字阶 / 字族 | ✅ 已完成 |
| 5 | `Input` 焦点指示 + `ring-offset` 颜色 | ✅ 已完成 |
| 6 | 勾选态 `--primary` → `--focus`（checkbox/switch/radio） | ✅ 已完成 |
| 7 | `--c-label2-l` 50.2% → 44%（次要文字达 AA） | ✅ 已完成 |
| 8 | 14 个失效 i18n 键（实际排查出 18 个） | ✅ 已完成 |
| 9 | AI 面板 markdown 排版 + 代码高亮 | ✅ 已完成（改为手写 `.md` 样式，未引入依赖） |
| 10 | 15 处输入框同色（实际 28 处） | ✅ 已完成 |
| 11 | 环境/服务列表行键盘可达 | ✅ 已完成 |
| 12 | nginx / dnsmasq / host 接 i18n | ✅ 已完成 |
| 13 | 补 `DialogTitle` 与图标按钮 `aria-label` | ✅ 已完成 |
| 14 | 状态语义：四态同色改三元组 | ✅ 已完成（下载态重新映射） |
| 15 | 破坏性操作统一确认 | ✅ 已完成（环境删除 / 日志清空 / 刷新页面） |
| 16 | 抽公共件 `StatusBadge` / `EmptyState` / `Spinner` / `LogViewer` | ⏳ 待做（§3.1） |
| 17 | 端口等数字字段 `type=number` + `min/max`；密码显示切换 | ⏳ 待做（§3.6） |
| 18 | 统一保存语义（当前三种心智模型） | ⏳ 待做（§3.1 #1） |
| 19 | 136 处任意字号收敛到新字阶 | ⏳ 待做（§3.3） |
| 20 | 清理 476 处冗余 `dark:`、40 处硬编码 white/black、61 处裸 `rounded` | ⏳ 待做（§4） |
| 21 | 补齐移动端（安全区 / 键盘避让 / 触控尺寸） | 🔶 部分完成（深色接缝已修，触控尺寸与安全区待做） |
| 22 | 九个服务面板去重（80.8% 重合） | ⏳ 待做（最大工程量） |

---

## 7. 本轮实际改动的代码

修复原则：**只动 token 层与「失效 / 不可见 / 不可达」类缺陷**，不做设计改版、不做业务逻辑重构。

### 7.1 Token 层

| 文件 | 改动 |
| --- | --- |
| `src/global.css` | ① 声明缺失的 `--n-30: 0 0% 30%`（修复暗色主按钮/链接/勾选/进度/骨架屏失效）<br>② `--c-label2-l` 50.2% → 44%，并把理由与回退方式写进注释（次要文字 3.95:1 → 4.95:1，达 AA）<br>③ 新增 `--radius-xs` 与完整字阶 `--text-3xs..3xl` + 配对行高 `--lh-*`<br>④ 新增 `--font-sans` / `--font-mono`（含 `PingFang SC` / `Microsoft YaHei`）<br>⑤ 新增 `--dur-1..4` 与 `--ease-standard`<br>⑥ `color-scheme: light/dark`（修原生滚动条、日期控件、自动填充在暗色下保持亮色）<br>⑦ `::selection`、`body { font-size: 13px; line-height: 20px }`、`overflow-wrap: break-word`<br>⑧ `@media (prefers-reduced-motion: reduce)` 全局降级<br>⑨ `.nums` 等宽数字工具类<br>⑩ **新增 `.md` 正文样式组**（替代失效的 `prose-*`）<br>⑪ 新增 `--code-*` 代码高亮色板（亮/暗各 8 个），并写出 `.hljs-*` 映射 |
| `tailwind.config.js` | ① `borderRadius.xs`<br>② `fontFamily.sans/mono` 指向 token<br>③ `fontSize` 全部档位改指 `var(--text-*)` / `var(--lh-*)`，新增 `3xs` / `2xs` / `md`<br>④ `transitionDuration.400`、`transitionTimingFunction.standard` |

### 7.2 P0 修复

| # | 问题 | 修复 |
| --- | --- | --- |
| P0-1a | 18 个 `t()` 键解析不到，界面直接显示原始 key | 12 个新增词条、3 处改指向已存在但未被引用的键（`initializing` / `start_init` / `resetting`）、3 处去掉错误的 `defaultValue` 兜底。另修 `common.general` 这类无兜底、必然显示 key 字面量的调用 |
| P0-1b | nginx / dnsmasq / host 三页 100% 硬编码中文 | 接入 `useTranslation`：nginx 29 处 / dnsmasq 21 处 + 1 处 `<Trans>` / host 39 处；另补 15 个缺失词条（含 4 个 nginx 英文标签、11 处 host toast） |
| P0-1c | 词条表自身有重复键及整块重复 | 删除 `en.json` 中**整块重复的 58 键 `welcome` 块**与 `zh.json` 中 3 个重复键。已用 `JSON.parse` 前后对比证明**解析结果完全一致**（纯删除死文本） |
| P0-2 | AI 面板 15 个 `prose*` 类全部失效，markdown 无排版、代码块溢出不可滚动，且全仓无 hljs 主题 | 手写 `.md` 样式组（标题/段落/列表/引用/表格/行内码/代码块横向滚动）+ `--code-*` 色板 + `.hljs-*` 映射。**不引入新依赖**（本仓由 pnpm 管理而环境无 pnpm，`npm install` 会重构 node_modules） |
| P0-3 | 暗色 tooltip 1.38:1 不可读 | `text-primary-foreground` → `text-background`（实测亮 14.31:1 / 暗 13.07:1） |
| P0-4 | 暗色 `--primary` 失效 | 见 §7.1 ① |
| P0-5 | 28 处输入框与所在卡片同色（1.00:1） | `bg-content1 dark:bg-content1/40` → `bg-content2`（控件填充档），与原本就正确的 SQL 面板对齐 |
| P0-6 | 环境/服务列表行是 `div onClick`，无 `tabIndex`/`role` | 加 `role="button"` + `tabIndex={0}` + Enter/Space `onKeyDown` + `aria-current` + `aria-label`，并加内描边 `focus-visible` 焦点环（密集列表行用 inset 环，避免与外层行重叠） |

### 7.3 P1 修复

| 主题 | 内容 |
| --- | --- |
| 无障碍 | 补唯一缺失的 `DialogTitle`（`command.tsx` 的 `CommandDialog`，用 `sr-only` 标题 + `aria-describedby={undefined}`）；为 **84 个纯图标控件**补 `aria-label` + `title`（含把 3 处硬编码中文 title 换成词条）；`ring-offset` 颜色统一为 `ring-offset-background`（修暗色白圈）；勾选态焦点环 1px → 2px；`Loading.tsx` 的 `z-100` → `z-[100]`（加载遮罩此前没有 z-index，被 `z-40` 日志面板与 `z-50` 弹窗盖住）；`useI18n` 同步 `<html lang>`（中文界面此前以 `lang="en"` 渲染）；AI 消息列表加 `role="log"` + `aria-live` |
| 破坏性确认 | 环境删除、日志「清空全部」、日志面板「刷新页面」改为 `AlertDialog` 二次确认（此前单击即生效，其中环境删除会永久删数据） |
| 状态语义 | 下载状态 `pending / downloading / downloaded / installing` 此前**四态同为 `text-success`**，现改为：进行中 `warning`、已下载待安装 `focus`、中性 `muted-foreground`、失败 `danger`；日志级别配色改为 ERROR danger / WARN warning / INFO 主文字 / DEBUG 次要文字（原 INFO 用绿、DEBUG 用蓝，把「正常信息」染成了状态色） |
| 排版 | 日志面板 12 处 `text-[11px]` → `text-2xs`、16 处 `bg-content2/30 rounded` → `bg-content3 rounded-xs`，日志正文与时间戳改等宽 + `nums`；AI 面板 `text-[15px]` → `text-sm`，空状态按 §8.7 规范收敛 |
| 交互 | 三栏拖动把手此前用 `bg-content2` 落在同为 `bg-content2` 的根容器上 → **三栏之间看不到分隔线**，改为 `bg-divider` + hover/拖动 `bg-focus`，命中区从 4px 加宽到 8px；面板内边距由 `calc(100% - 8px)` / `calc(100% - 5px)` 这组不对称魔数改为统一 `p-1`；中栏与 AI 栏的表面统一为 `bg-content1`（此前 `dark:bg-background` vs `dark:bg-content3`，暗色下层级相反） |
| 组件矛盾类 | 日志面板的 `bg-content1`+`bg-content2`、`rounded-lg`+`rounded-2xl` 收敛为单一状态并补上 `shadow-pop`（它是该区域唯一浮层却是唯一没有阴影的）；服务行选中态的 4 个互相冲突的类（含两个 `dark:bg-*`、两个 `dark:border-*`）收敛为 `bg-content4 border-divider`——此前亮色下选中行与侧栏同色，**看不出选中了哪一行** |
| 硬编码值 | `service-data-item.tsx` 的 `filter: brightness(1.2)`（暗色下成为一块无法用 token 控制的高光）改为 `dark:brightness-[0.8]` |
| i18n 基建 | 新增 `scripts/check-i18n.mjs` 并挂到 `npm run build`：检查①重复键（`JSON.parse` 会静默吞掉，键数校验发现不了）②en/zh 叶子键对齐 ③`t('literal')` 是否可解析。当前 **1451 = 1451 键、0 重复、1804 处引用全部可解析** |
| 移动端 | `mobile/App.tsx` 由 `setAppTheme('system')` 改为固定深色（此前只有终端面板自己挂 `dark`，浅色手机上会出现「浅色外壳包着深色终端」的硬接缝），并删除随生产包发出的英文调试横幅；`mobile.html` 补 `viewport-fit=cover`（`env(safe-area-inset-*)` 才生效）、`color-scheme`、`theme-color`，并在 `<html>` 上直接挂 `dark` 消除启动闪烁 |
| 首屏闪烁 | `index.html` 补主题引导脚本：默认主题是 `system`，在 appSettings 从后端返回之前先按系统偏好落一次主题类 |

### 7.4 视觉复核轮（用户实测反馈后的修正）

首轮修复后用户实测，指出三处观感问题——都是「按已定套装衡量确实不合格」的真实缺陷，
并给出一条原则：**不要为了模仿某个参考设计而牺牲已定型的 UI 套装**。

| # | 反馈 | 根因 | 修正 |
| --- | --- | --- | --- |
| 1 | 环境列表的 title 和 desc 一个字号 | 标题 13px `font-medium` / 副标题 12px `text-muted-foreground`，**只差 1px**，看起来完全同级。（且首轮为达 AA 把 `--c-label2-l` 从 50.2% 调到 44%，副标题变深，颜色也补不了层级） | 行标题改为 **14px**（`text-md font-medium`），副标题 **12px**（`text-xs`）。关键是标题必须离开 13px 正文档——原来既有档位问题又只差 1px。已把「行内标题固定 14 / 副标题固定 12」写进规范的 §3.4 与 §3.5 铁律。环境列表行与服务列表行同步 |
| 2 | 弹窗右上角关闭按钮 hover 背景太小 | `DialogPrimitive.Close` 只写了 `rounded-md` + 一个 16px 图标，**没有给命中区尺寸**，hover 背景就只有 16px 见方；且 hover 填充用 `content2`，压在 `background` 面上只差 1.5 个明度点，几乎看不见 | 改为真正的 **28×28**（`inline-flex h-7 w-7 items-center justify-center`），hover 填充改 `content4`，图标 `muted-foreground` → hover `foreground`。`sheet.tsx` 同一处缺陷一并修 |
| 3 | 左下角（导航栏底部）那几个按钮颜色太浅 | 这几个是**主操作**（设置/主题/终端/诊断），却照搬了参考设计里「设置侧栏信息图标」的浅灰处理：`text-muted-foreground`，图标压到 14px，命中区 28px，且 `active:text-muted-foreground/70` —— **按下反而更淡** | 改 `text-foreground`；命中区 28→**32px**；图标回到规范的 **16px**；去掉反向的按下反馈。写入 §6.4「交互可见性」：「参考设计里的浅灰图标按钮语义是次要信息，套到主操作上就是把主操作降级成背景装饰」 |

同轮一并修正的同类问题（同一根因，不等用户再报）：

| 问题 | 修正 |
| --- | --- |
| **34 处卡片标题是 12px `font-medium`——比卡片内正文（13px）还小，层级倒挂** | 全部改为 **13px `font-semibold`**（区块标题角色）。用「紧贴卡片外壳 / 标题行 `justify-between` / `cursor-help` 提示 / 带图标 / `mb-2`」四个标记判定卡片标题，避免误伤字段标签（字段标签另 4 处保持不动） |
| `update-dialog.tsx` 的「What's New」标题与描述**字面同为 `text-sm`** | 标题 → `text-base font-semibold`，描述保持 `text-sm`；顺带 `border-border`→`border-divider`、`rounded-md`→`rounded-lg` |
| `AlertDialogContent` 圆角 6px，而 `DialogContent` 16px——**同一角色两种圆角**（12 处使用，用户直接可见） | 统一为 16px |
| `sheet` 内边圆角 6px、`drawer` 用 `rounded-t-[6px]` 离刻度魔数 | 统一到面板档 16px |
| `nav-bar-item` 行内操作按钮图标 12px（低于规范下限） | 提到 14px，hover 填充改 `content3` + `text-foreground` |
| `welcome-fragment` 残留 `dark:hover:text-white`（写死白色）与已无定义的 `custom-scrollbar` | 一并清理 |

**验证**：`npm run check:i18n` / `check:a11y` / `tsc` / `vite build` 全绿；
速查页新增第 **10 节「列表行层级与主操作」**（亮/暗双栏，含环境行、服务行、导航栏主操作），
与对话框一节一起用于逐项目视核对。

### 7.5 主题色修正（最重要的一处反向修正）

**用户指出：主题色是蓝色。核对提交历史，用户是对的，而本报告初稿把一次重构当成了基准。**

```
38e2150 init（最初提交 · HeroUI 设计）
    --primary: 212 100% 47%      ← 蓝
    --ring:    212 100% 47%      ← 同一个蓝
    --focus:   212 100% 47%      ← 同一个蓝
    （另有 --secondary: 262 83% 65% 紫色，但全仓从未被引用）

6075877 fix（2026-09-21 · "Voxt" 风格重构，未提交）
    --primary: var(--n-8)        ← 改成近黑
    注释写着"主按钮近黑（亮）/ 浅灰（暗），不是蓝色"   ← 明确的反向修改
```

本报告初稿把工作区里这个**中间重构状态**当成了"既有设计"，并在设计语言里写下
「品牌是黑色，不是蓝色」，还从黑白 app icon 反推出了一套"墨黑品牌"的理由——
那是对一次回归的事后合理化。真正的已定套装（README 截图 `doc/Shot.png`、v0.13.1 发布版）
处处是蓝色 accent：QQ 群徽章、图标色块、主按钮。

| 改动 | 内容 |
| --- | --- |
| `--c-blue` | `211 100% 52%`（macOS 焦点蓝）→ **`212 100% 47%`**（最初提交原值） |
| `--primary` | 亮色 `var(--n-8)` 近黑、暗色 `var(--n-30)` → **两者统一 `var(--c-blue)`** |
| `--focus` / `--ring` | 与 `--primary` 同值 → 全站单一强调色，"主操作色"与"焦点色"永远一致 |
| `skeleton.tsx` | `bg-primary/10` → `bg-content3`。加载占位必须中性，不能带主题色（否则骨架屏变浅蓝） |
| `welcome-fragment` / `env-panel-header` | 移除 15 处 `dark:text-primary-foreground` —— 把"压在主题色上的文字色"当通用白色用，是重构遗留的写法；标题一律回到 `text-foreground` |
| `welcome-fragment` | 移除覆盖全局 `::selection` 的 `dark:selection:bg-content1/20`（暗色下选中几乎不可见） |

保留未动的（用户未提出、且属于重构的净改进）：中性表面四级阶梯、`shadow-pop` 单一阴影纪律、
macOS 派生灰阶。**没有被"回到最初提交"整体回滚**——只回滚主题色这一处。

**验证**：白字压在 `212 100% 47%` 上对比度 **4.59:1**，达 AA；
`bg-primary`/`text-primary`/`border-primary`/`bg-primary/10`/`bg-primary/20` 共 103 处逐一核对，
除上述两处外全部在蓝色下语义正确（主按钮、链接、焦点、进度条、slider、选中标签）。

### 7.6 没有改、但强烈建议尽快处理

§6 表中标 ⏳ 的项。其中**性价比最高的三件**：

1. **抽公共组件**（§3.1）：九个服务面板各自重写了空状态（5 种规格）、破坏性确认（3 套）、加载指示（`RefreshCw` 被当 spinner 用了 52 次而 `Loader2` 只用 2 次）。抽完之后一致性维护成本会大幅下降。
2. **端口等数字字段加约束**（§3.6）：9 个文件里 0 个用 `type="number"` / `inputMode` / `min` / `max`，端口可以是 `"abc"`。这是数据正确性问题，不是观感问题。
3. **统一保存语义**（§3.1 #1）：当前「批量显式保存 / 写穿无保存 / 按字段保存」三种模型并存，用户无法建立预期。

---

## 8. 交付物

| 文件 | 说明 |
| --- | --- |
| [`UI-LANGUAGE.md`](./UI-LANGUAGE.md) | **UI 设计语言全套规范**：设计原则、色彩、表面层级、排版、间距、形状、图标、动效、组件、状态语义、暗色模式、无障碍、文案与 i18n、token 架构、禁止清单、迁移优先级 |
| [`preview.html`](./preview.html) | **可打开的视觉速查页**（自包含，双击即用）。用真实 token 渲染亮/暗双栏：色阶、表面层级、完整字阶、间距、圆角、三种按钮变体与状态、表单、三态、状态语义、日志查看器、对话框。可作回归对照 |
| `preview.src.html` | 上面那页的源文件（`preview.html` 由它内联 Tailwind 产物生成） |
| `UI-AUDIT.md` | 本文件 |
| [`../../scripts/check-i18n.mjs`](../../scripts/check-i18n.mjs) | **i18n 守卫**，已挂到 `npm run build`：检查重复键、en/zh 对齐、`t()` 引用可解析 |
| [`../ui-audit-raw/01-foundation.md`](../ui-audit-raw/01-foundation.md) | 基础层（token / 原语 / 全局样式）· 32 项 · 含 md5 快照与构建校验方法 |
| [`../ui-audit-raw/02-shell.md`](../ui-audit-raw/02-shell.md) | 外框与导航 · 42 项 · 含排版阶梯与间距清单 |
| [`../ui-audit-raw/03-env-panel.md`](../ui-audit-raw/03-env-panel.md) | 环境面板与配置视图 · 24 项 · 含九屏模式对照矩阵 |
| [`../ui-audit-raw/04-services.md`](../ui-audit-raw/04-services.md) | 九个服务面板 · 含 difflib 量化重复度 |
| [`../ui-audit-raw/05-ai-mobile-crosscutting.md`](../ui-audit-raw/05-ai-mobile-crosscutting.md) | AI 面板 / 移动端 / 全仓横切清单 · 30 项 · 含可复现的 grep 命令 |

---

## 9. 验证记录

本轮所有改动经以下方式验证（每条都可复现）：

```
npm run check:i18n      # ✓ en 1451 = zh 1451 叶子键，0 重复键，1804 处引用全部可解析
npx tsc --noEmit        # exit 0
npm run build           # exit 0（i18n 守卫 → tsc → vite build --mode pc）
```

构建产物核对（`dist/assets/*.css`）：

| 断言 | 结果 |
| --- | --- |
| `--n-30: 0 0% 30%` 已声明 | ✅ |
| `.dark { --primary: var(--n-30) }` 可解析 | ✅ |
| `--c-label2-l: 0 0% 44%` | ✅ |
| `.md pre { overflow-x: auto; … }` 已产出 | ✅ |
| `.md .hljs-keyword { color: var(--code-keyword) }` 已产出 | ✅ |
| `prose` 命中数 = 0（失效类已清除） | ✅ |
| `color-scheme` / `::selection` / `prefers-reduced-motion` 各 1 处 | ✅ |

另外两项人工核对：

- **词条删除的行为等价性**：用 `JSON.parse` 对删除前后的 `en.json` / `zh.json` 做排序后全量 diff，
  **解析结果完全一致** —— 证明删除的只是 `JSON.parse` 早已忽略的死文本，不影响任何界面文案。
- **视觉速查页**：`preview.html` 用真实 token 渲染，逐节截图核对（色阶、表面层级、完整字阶、
  按钮三种变体与禁用/加载/焦点态、表单、三态、状态语义、日志查看器、对话框）。
  暗色主按钮在修复前是透明的，修复后为 n-30 灰底白字（8.59:1），已在速查页暗色栏确认可见。
