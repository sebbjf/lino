// Cyclomatic complexity per top-level function, counted like crapper's TypeScript rules:
// if, loops, catch, ?:, each case label, && || ??, and ?. . Top-level functions and top-level arrow functions are entries.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const [parserPath, root, ...dirs] = process.argv.slice(2)
const { parse } = await import(new URL(`file:///${parserPath.replace(/\\/g, '/')}`))
const files = []
const walk = (d) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n)
    if (statSync(p).isDirectory()) { if (n !== 'node_modules' && n !== '__snapshots__') walk(p) }
    else if (/\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) && !n.endsWith('.d.ts')) files.push(p)
  }
}
dirs.forEach((d) => walk(join(root, d)))

const DECISIONS = new Set(['IfStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement', 'CatchClause', 'ConditionalExpression'])
const isFn = (n) => ['FunctionDeclaration', 'ArrowFunctionExpression', 'FunctionExpression'].includes(n?.type)
const decision = (n) => {
  if (DECISIONS.has(n.type)) return 1
  if (n.type === 'SwitchCase') return n.test ? 1 : 0
  if (n.type === 'LogicalExpression') return 1
  if (n.type === 'OptionalMemberExpression' || n.type === 'OptionalCallExpression') return n.optional ? 1 : 0
  return 0
}
const count = (node) => {
  let cc = 1
  const visit = (n) => {
    if (!n || typeof n.type !== 'string') return
    cc += decision(n)
    for (const k in n) {
      if (k === 'loc' || k === 'start' || k === 'end' || k === 'leadingComments' || k === 'trailingComments') continue
      const v = n[k]
      if (Array.isArray(v)) v.forEach(visit)
      else if (v && typeof v.type === 'string') visit(v)
    }
  }
  visit(node)
  return cc
}
const out = []
for (const f of files) {
  const ast = parse(readFileSync(f, 'utf8'), { sourceType: 'module', plugins: ['typescript', ...(f.endsWith('x') ? ['jsx'] : [])] })
  const where = (n) => `${relative(root, f).replace(/\\/g, '/')}:${n.loc.start.line}`
  for (let s of ast.program.body) {
    if (s.type === 'ExportNamedDeclaration' && s.declaration) s = s.declaration
    if (s.type === 'FunctionDeclaration') out.push({ cc: count(s), name: s.id.name, where: where(s) })
    if (s.type === 'VariableDeclaration')
      for (const d of s.declarations) {
        const init = d.init
        const fn = isFn(init) ? init : init?.type === 'CallExpression' ? init.arguments.find(isFn) : undefined
        if (fn) out.push({ cc: count(fn), name: d.id.name ?? '?', where: where(d) })
      }
  }
}
out.sort((a, b) => b.cc - a.cc)
const limit = Number(process.env.MIN ?? 10)
for (const o of out.filter((o) => o.cc >= limit)) console.log(String(o.cc).padStart(3), o.name.padEnd(28), o.where)
console.log(`${out.length} functions, ${out.filter((o) => o.cc >= limit).length} at CC >= ${limit}`)
