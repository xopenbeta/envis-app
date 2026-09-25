#!/usr/bin/env node
/**
 * i18n 健全性检查 —— 把「界面上出现原始 key」这类缺陷挡在提交之前。
 *
 * 检查三件事：
 *  1. 重复键：JSON.parse 会静默保留最后一个，前面的定义变成死词条，
 *     而「键数相等」的检查方式发现不了。这里用原始文本按缩进层级扫描。
 *  2. en / zh 叶子键对齐：任何一侧多出或缺少键都算失败。
 *  3. 未解析的 t() 字面量：`t('a.b')` 指向不存在的键时，i18next 会把
 *     原始 key 字符串直接渲染到界面上。
 *
 * 用法：node scripts/check-i18n.mjs   （退出码 0 = 通过，1 = 有问题）
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '')
const LOCALES = {
  en: join(ROOT, 'src/pc/i18n/locales/en.json'),
  zh: join(ROOT, 'src/pc/i18n/locales/zh.json'),
}
const SRC = join(ROOT, 'src')

const problems = []
const note = (msg) => problems.push(msg)

// ───────────────────────────── 1. 重复键（原始文本扫描） ─────────────────────────────
// 依据：这些文件由工具格式化，每个键独占一行且值为单行；JSON 字符串不能含裸换行。
// 注意：重复检测只能靠原始文本——JSON.parse 会静默保留最后一个，事后无从发现。
function findDuplicateKeys(file) {
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')
  const stack = [] // { indent, key }
  const seen = new Set()
  const dups = []

  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)"((?:[^"\\]|\\.)*)"\s*:/.exec(lines[i])
    if (!m) continue
    const indent = m[1].length
    const key = m[2]
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()
    const path = [...stack.map((s) => s.key), key].join('.')
    if (seen.has(path)) dups.push({ path, line: i + 1 })
    else seen.add(path)
    stack.push({ indent, key })
  }
  return dups
}

// 叶子键集合以后者为准：JSON.parse 是「实际生效」的定义，
// 原始文本扫描只用来发现前面那些被忽略掉的重复定义。
function flatten(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, path, out)
    else out.add(path)
  }
  return out
}

const leafSets = {}
for (const [lang, file] of Object.entries(LOCALES)) {
  leafSets[lang] = flatten(JSON.parse(readFileSync(file, 'utf8')))
  for (const d of findDuplicateKeys(file)) {
    note(`重复键  ${relative(ROOT, file)}:${d.line}  ${d.path}  （JSON.parse 只保留最后一个，前面的定义是死词条）`)
  }
}

// ───────────────────────────── 2. en / zh 对齐 ─────────────────────────────
const en = leafSets.en
const zh = leafSets.zh
for (const k of en) if (!zh.has(k)) note(`缺少词条  zh.json 缺少 ${k}`)
for (const k of zh) if (!en.has(k)) note(`缺少词条  en.json 缺少 ${k}`)

// ───────────────────────────── 3. 未解析的 t() 字面量 ─────────────────────────────
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(p)) out.push(p)
  }
  return out
}

// t('a.b') / t("a.b") / <Trans i18nKey="a.b">；跳过模板字符串与变量（无法静态判定）
const RE_T = /\bt\(\s*['"]([A-Za-z0-9_.-]+)['"]/g
const RE_TRANS = /i18nKey=\{?['"]([A-Za-z0-9_.-]+)['"]/g

let checked = 0
for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8')
  for (const re of [RE_T, RE_TRANS]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text)) !== null) {
      checked++
      const key = m[1]
      if (!en.has(key)) {
        const line = text.slice(0, m.index).split('\n').length
        note(`未解析键  ${relative(ROOT, file)}:${line}  t('${key}') 指向不存在的词条`)
      }
    }
  }
}

// ───────────────────────────── 结果 ─────────────────────────────
const total = en.size
if (problems.length) {
  console.error(`\n✗ i18n 检查未通过（en ${total} / zh ${zh.size} 个叶子键，扫描 ${checked} 处引用）\n`)
  for (const p of problems) console.error('  ' + p)
  console.error(`\n共 ${problems.length} 个问题。\n`)
  process.exit(1)
}

console.log(`✓ i18n 检查通过：en ${total} = zh ${zh.size} 个叶子键，无重复键，${checked} 处引用全部可解析。`)
