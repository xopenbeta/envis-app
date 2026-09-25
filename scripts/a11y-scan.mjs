#!/usr/bin/env node
/**
 * 无障碍静态扫描（全仓 src/**）。
 *
 * 用法：
 *   node scripts/a11y-scan.mjs            # 报告
 *   node scripts/a11y-scan.mjs --check    # CI 模式：发现即退出码 1
 *   node scripts/a11y-scan.mjs --json     # 机器可读
 *   node scripts/a11y-scan.mjs --compare  # 与 git HEAD 版本对比
 *
 * 检查两件事：
 *   a) 每个 <DialogContent>/<AlertDialogContent> 的子树里是否有 <DialogTitle>/<AlertDialogTitle>。
 *      Radix 要求对话框有可访问名，缺失时读屏用户进入的是「空白页」。
 *   b) 纯图标控件（Button/button/a）是否有可访问名
 *      （aria-label / aria-labelledby / title / sr-only 文字）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = process.cwd()

/** 扫描 src 下全部 tsx（跳过第三方与构建产物）。 */
function expandScope() {
  const files = []
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const p = path.join(dir, name)
      const st = fs.statSync(p)
      if (st.isDirectory()) walk(p)
      else if (name.endsWith('.tsx')) files.push(path.relative(ROOT, p))
    }
  }
  walk(path.join(ROOT, 'src'))
  return files.sort()
}

/** Find the end index (exclusive) of a JSX opening tag starting at `i` (points at `<`). */
function openingTagEnd(src, i) {
  let depth = 0
  let j = i
  while (j < src.length) {
    const ch = src[j]
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      j++
      while (j < src.length && src[j] !== quote) {
        if (src[j] === '\\') j++
        j++
      }
    } else if (ch === '{') {
      depth++
    } else if (ch === '}') {
      depth--
    } else if (ch === '>' && depth === 0) {
      return j + 1
    }
    j++
  }
  return src.length
}

/**
 * Collect every element with any of `tagNames` (structural, nesting-aware for the
 * same tag name). Returns { tag, start, end, attrs, children, selfClosing, line }.
 */
function findElements(src, tagNames, from = 0, to = src.length) {
  const names = new Set(tagNames)
  const out = []
  let i = from
  while (i < to) {
    const lt = src.indexOf('<', i)
    if (lt === -1 || lt >= to) break
    const m = /^<([A-Za-z][A-Za-z0-9_.]*)/.exec(src.slice(lt, Math.min(lt + 80, to)))
    if (!m) {
      i = lt + 1
      continue
    }
    const tag = m[1]
    const after = src[lt + m[0].length]
    if (after !== undefined && !/[\s/>]/.test(after)) {
      i = lt + 1
      continue
    }
    const openEnd = openingTagEnd(src, lt)
    const selfClosing = /\/\s*>$/.test(src.slice(lt, openEnd))
    if (!names.has(tag)) {
      i = selfClosing ? openEnd : lt + 1
      continue
    }
    let end = openEnd
    if (!selfClosing) {
      // nesting-aware search for the matching close tag
      let depth = 1
      let k = openEnd
      while (k < to && depth > 0) {
        const nextLt = src.indexOf('<', k)
        if (nextLt === -1 || nextLt >= to) break
        if (src.startsWith(`</${tag}`, nextLt)) {
          depth--
          if (depth === 0) {
            const closeEnd = src.indexOf('>', nextLt)
            end = closeEnd === -1 ? to : closeEnd + 1
          }
          k = nextLt + 2 + tag.length
        } else if (src.startsWith(`<${tag}`, nextLt) && /[\s/>]/.test(src[nextLt + 1 + tag.length] ?? ' ')) {
          depth++
          k = nextLt + 1 + tag.length
        } else {
          k = nextLt + 1
        }
      }
    }
    const attrs = src.slice(lt + m[0].length, selfClosing ? src.lastIndexOf('/', openEnd - 1) : openEnd - 1)
    const children = selfClosing ? '' : src.slice(openEnd, src.lastIndexOf('</' + tag, end))
    out.push({
      tag,
      start: lt,
      end,
      attrs,
      children,
      selfClosing,
      line: src.slice(0, lt).split('\n').length,
    })
    i = end
  }
  return out
}

/**
 * 把注释内容替换为空格（保留换行，因此行号不变），避免把注释掉的 JSX
 * 当成真实节点——否则 `{/* <Button>…</Button> *\/}` 会被报成未命名按钮。
 * 字符串与模板字面量内部不参与识别（`https://…` 不能被当行注释）。
 */
function maskComments(src) {
  let out = ''
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === '"' || c === "'" || c === '`') {
      out += c
      i++
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\') {
          out += src[i] + (src[i + 1] ?? '')
          i += 2
          continue
        }
        out += src[i]
        i++
      }
      if (i < src.length) {
        out += src[i]
        i++
      }
      continue
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') {
        out += ' '
        i++
      }
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      out += '  '
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' '
        i++
      }
      if (i < src.length) {
        out += '  '
        i += 2
      }
      continue
    }
    out += c
    i++
  }
  return out
}

/** Remove JSX tags from a children string, leaving text and {} expressions. */
function stripTags(s) {
  let out = ''
  let i = 0
  while (i < s.length) {
    if (s[i] === '<') {
      const end = openingTagEnd(s, i)
      i = end
      continue
    }
    if (s[i] === '{') {
      // keep the expression verbatim so identifiers/calls count as content
      let depth = 0
      let j = i
      while (j < s.length) {
        if (s[j] === '{') depth++
        else if (s[j] === '}') {
          depth--
          if (depth === 0) break
        } else if (s[j] === '"' || s[j] === "'" || s[j] === '`') {
          const q = s[j]
          j++
          while (j < s.length && s[j] !== q) j++
        }
        j++
      }
      out += s.slice(i, j + 1)
      i = j + 1
      continue
    }
    out += s[i]
    i++
  }
  return out
}

function analyze(file, src) {
  if (src === undefined) src = fs.readFileSync(path.join(ROOT, file), 'utf8')
  // 注释屏蔽后再分析：行号不变，但注释掉的 JSX 不再计入
  src = maskComments(src)
  // Radix's AlertDialog.Title is DialogPrimitive.Title too, so either satisfies the
  // "dialog must have an accessible name" requirement.
  const TITLE = /<(?:Alert)?DialogTitle[\s/>]/
  const dialogs = findElements(src, ['DialogContent', 'AlertDialogContent'])
  const titledDialogs = dialogs.filter((d) => TITLE.test(d.children))
  const untitled = dialogs.filter((d) => !TITLE.test(d.children))
  const rawContents = (src.match(/<(?:Alert)?DialogContent[\s/>]/g) || []).length
  const rawTitles = (src.match(/<(?:Alert)?DialogTitle[\s/>]/g) || []).length

  const controls = findElements(src, ['Button', 'button', 'a'])
  const unnamed = []
  const titleOnly = []
  const named = []
  const suspicious = []
  for (const c of controls) {
    if (c.selfClosing) continue
    const residue = stripTags(c.children)
    const hasMarkup = /<[A-Za-z]/.test(c.children)
    const hasText = /[A-Za-z0-9\u4e00-\u9fff]/.test(residue)
    const hasQuoted = /['"`]/.test(residue) // literal string / t('...') key text
    const hasCall = /\bt\s*\(/.test(residue)
    if (!hasMarkup) continue
    if (hasText) {
      // rendered text, but double-check it is not a bare conditional around icons
      if (!hasQuoted && !hasCall) {
        suspicious.push({ line: c.line, tag: c.tag, snippet: residue.replace(/\s+/g, ' ').trim().slice(0, 90) })
      }
      continue
    }
    const hasAria =
      /aria-label\s*=/.test(c.attrs) || /aria-labelledby\s*=/.test(c.attrs) || /sr-only/.test(c.children)
    const hasTitle = /(^|\s)title\s*=/.test(c.attrs)
    const snippet = c.children.replace(/\s+/g, ' ').trim().slice(0, 90)
    if (!hasAria && !hasTitle) {
      unnamed.push({ line: c.line, tag: c.tag, snippet })
    } else if (!hasAria && hasTitle) {
      titleOnly.push({ line: c.line, tag: c.tag, snippet })
    } else {
      named.push({ line: c.line, tag: c.tag })
    }
  }

  return {
    file,
    dialogs: dialogs.length,
    titled: titledDialogs.length,
    rawContents,
    rawTitles,
    untitled: untitled.map((d) => ({ line: d.line, tag: d.tag })),
    iconOnlyMissingName: unnamed,
    iconOnlyTitleOnly: titleOnly,
    iconOnlyNamed: named,
    suspicious,
  }
}

/** Read the committed (HEAD) version of an in-scope file, or null when untracked/absent. */
function headSource(file) {
  try {
    return execFileSync('git', ['show', `HEAD:${file}`], { cwd: ROOT, encoding: 'utf8' })
  } catch {
    return null
  }
}

function summarize(rows) {
  return rows.reduce(
    (acc, r) => {
      acc.dialogs += r.dialogs
      acc.titled += r.titled
      acc.rawContents += r.rawContents
      acc.rawTitles += r.rawTitles
      acc.untitled += r.untitled.length
      acc.iconOnlyMissingName += r.iconOnlyMissingName.length
      acc.iconOnlyTitleOnly += r.iconOnlyTitleOnly.length
      acc.iconOnlyNamed += r.iconOnlyNamed.length
      return acc
    },
    {
      dialogs: 0,
      titled: 0,
      rawContents: 0,
      rawTitles: 0,
      untitled: 0,
      iconOnlyMissingName: 0,
      iconOnlyTitleOnly: 0,
      iconOnlyNamed: 0,
    },
  )
}

function runCompare(files) {
  const before = []
  const after = []
  for (const file of files) {
    const head = headSource(file)
    if (head !== null) before.push(analyze(file, head))
    after.push(analyze(file))
  }
  const b = summarize(before)
  const a = summarize(after)
  console.log('metric'.padEnd(34), 'before'.padStart(8), 'after'.padStart(8))
  const row = (label, x, y) => console.log(label.padEnd(34), String(x).padStart(8), String(y).padStart(8))
  row('<DialogContent>/<AlertDialogContent>', b.rawContents, a.rawContents)
  row('  top-level dialogs (nested collapsed)', b.dialogs, a.dialogs)
  row('<DialogTitle>/<AlertDialogTitle>', b.rawTitles, a.rawTitles)
  row('dialogs with a title', b.titled, a.titled)
  row('dialogs with NO accessible title', b.untitled, a.untitled)
  row('icon-only controls, no name at all', b.iconOnlyMissingName, a.iconOnlyMissingName)
  row('icon-only controls, title but no aria-label', b.iconOnlyTitleOnly, a.iconOnlyTitleOnly)
  row('icon-only controls with an accessible name', b.iconOnlyNamed, a.iconOnlyNamed)
  if (a.untitled || a.iconOnlyMissingName || a.iconOnlyTitleOnly) {
    console.log('\nRemaining after the fix:')
    for (const r of after) {
      for (const d of r.untitled) console.log(`  UNTITLED  ${r.file}:${d.line}  <${d.tag}>`)
      for (const u of r.iconOnlyMissingName) console.log(`  NONAME    ${r.file}:${u.line}  <${u.tag}> children=${u.snippet}`)
      for (const u of r.iconOnlyTitleOnly) console.log(`  NOARIA    ${r.file}:${u.line}  <${u.tag}> children=${u.snippet}`)
    }
  }
  if (before.some((r) => r.iconOnlyNamed < 0)) process.exit(1)
  process.exit(0)
}

const files = expandScope()
if (process.argv.includes('--compare')) runCompare(files)
const results = files.map((f) => analyze(f))

const totals = results.reduce(
  (acc, r) => {
    acc.dialogs += r.dialogs
    acc.titled += r.titled
    acc.untitled += r.untitled.length
    acc.iconOnlyMissingName += r.iconOnlyMissingName.length
    acc.iconOnlyTitleOnly += r.iconOnlyTitleOnly.length
    acc.iconOnlyNamed += r.iconOnlyNamed.length
    acc.suspicious += r.suspicious.length
    return acc
  },
  { dialogs: 0, titled: 0, untitled: 0, iconOnlyMissingName: 0, iconOnlyTitleOnly: 0, iconOnlyNamed: 0, suspicious: 0 },
)

// CI 模式：只报「有名字」这一硬要求，不因 suspicious（疑似误报）而失败。
if (process.argv.includes('--check')) {
  const bad = totals.untitled + totals.iconOnlyMissingName
  if (bad) {
    console.error(`\n✗ 无障碍检查未通过：${totals.untitled} 个对话框缺标题，${totals.iconOnlyMissingName} 个纯图标控件无可访问名\n`)
    for (const r of results) {
      for (const d of r.untitled) console.error(`  UNTITLED  ${r.file}:${d.line}  <${d.tag}>`)
      for (const u of r.iconOnlyMissingName) console.error(`  NONAME    ${r.file}:${u.line}  <${u.tag}> children=${u.snippet}`)
    }
    console.error('')
    process.exit(1)
  }
  console.log(
    `✓ 无障碍检查通过：${totals.dialogs} 个对话框全部有标题，${totals.iconOnlyNamed} 个纯图标控件全部有可访问名` +
      `（另有 ${totals.iconOnlyTitleOnly} 个仅有 title 而无 aria-label${totals.iconOnlyTitleOnly ? '，建议补 aria-label' : ''}）。`,
  )
  process.exit(0)
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ totals, results }, null, 2))
} else {
  console.log('file\tdialogs\ttitled\tuntitled\ticonOnlyNoName\ticonOnlyTitleOnly')
  for (const r of results) {
    console.log(
      `${r.file}\t${r.dialogs}\t${r.titled}\t${r.untitled.length}\t${r.iconOnlyMissingName.length}\t${r.iconOnlyTitleOnly.length}`,
    )
  }
  console.log('---')
  console.log(
    `TOTAL dialogs=${totals.dialogs} titled=${totals.titled} untitled=${totals.untitled} iconOnlyNoName=${totals.iconOnlyMissingName} iconOnlyTitleOnly=${totals.iconOnlyTitleOnly} iconOnlyNamed=${totals.iconOnlyNamed} suspicious=${totals.suspicious}`,
  )
  if (totals.untitled || totals.iconOnlyMissingName || totals.iconOnlyTitleOnly || totals.suspicious) {
    console.log('\nDetail:')
    for (const r of results) {
      for (const d of r.untitled) {
        console.log(`  UNTITLED  ${r.file}:${d.line}  <${d.tag}>`)
      }
      for (const u of r.iconOnlyMissingName) {
        console.log(`  NONAME    ${r.file}:${u.line}  <${u.tag}> children=${u.snippet}`)
      }
      for (const u of r.iconOnlyTitleOnly) {
        console.log(`  NOARIA    ${r.file}:${u.line}  <${u.tag}> children=${u.snippet}`)
      }
      for (const u of r.suspicious) {
        console.log(`  CHECK     ${r.file}:${u.line}  <${u.tag}> residue=${u.snippet}`)
      }
    }
  }
}
