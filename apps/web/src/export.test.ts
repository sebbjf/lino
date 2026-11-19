import { expect, test } from 'vitest'
import { exportTheme, slug } from './export.ts'

test('slug', () => {
  expect(slug('Brand Blue!', 'x')).toBe('brand-blue')
  expect(slug('Café', 'x')).toBe('cafe')
  expect(slug('!!!', 'color-3')).toBe('color-3')
})

test('exportTheme writes CSS variables and a Tailwind @theme, deduping names', () => {
  const colors = [
    { hex: '#112233', name: 'Ink', pinned: true },
    { hex: '#445566', name: 'ink', pinned: false },
  ]
  const fonts = ['Fraunces', 'JetBrains Mono', 'Inter']
  expect(exportTheme('css', colors, fonts)).toBe(
    [
      ':root {',
      '  --color-ink: #112233;',
      '  --color-ink-2: #445566;',
      '  --font-fraunces: "Fraunces", sans-serif;',
      '  --font-jetbrains-mono: "JetBrains Mono", monospace;',
      '  --font-inter: "Inter", sans-serif;',
      '}',
      '',
    ].join('\n'),
  )
  expect(exportTheme('tailwind', [], ['Instrument Serif'])).toBe('@theme {\n  --font-instrument-serif: "Instrument Serif", serif;\n}\n')
})

test('exportTheme prefixes CSS variables only and can write oklch', () => {
  const colors = [{ hex: '#ff0000', name: 'Red', pinned: false }]
  const prefs = { prefix: 'My App', format: 'oklch' as const }
  expect(exportTheme('css', colors, ['Inter'], prefs)).toBe(
    ':root {\n  --my-app-color-red: oklch(0.628 0.258 29.2);\n  --my-app-font-inter: "Inter", sans-serif;\n}\n',
  )
  expect(exportTheme('tailwind', colors, [], prefs)).toBe('@theme {\n  --color-red: oklch(0.628 0.258 29.2);\n}\n')
})

test('exportTheme writes design tokens JSON, deduping names and dropping bad hex', () => {
  const colors = [
    { hex: '#112233', name: 'Ink', pinned: true },
    { hex: '#445566', name: 'ink', pinned: false },
    { hex: 'red;}', name: 'bad', pinned: false },
  ]
  expect(JSON.parse(exportTheme('tokens', colors, ['JetBrains Mono', 'a"b']))).toEqual({
    color: { ink: { $type: 'color', $value: '#112233' }, 'ink-2': { $type: 'color', $value: '#445566' } },
    font: { 'jetbrains-mono': { $type: 'fontFamily', $value: ['JetBrains Mono', 'monospace'] }, 'a-b': { $type: 'fontFamily', $value: ['a"b', 'sans-serif'] } },
  })
})

test('exportTheme never lets a hex or a font name break out of the block', () => {
  const css = exportTheme('css', [{ hex: 'red;}body{display:none}', name: 'x', pinned: true }], ['x\n}\nbody{display:none}', 'Söhne'])
  expect(css).toBe(':root {\n  --font-x-body-display-none: "xbodydisplaynone", sans-serif;\n  --font-sohne: "Söhne", sans-serif;\n}\n')
})

test('scales add -50..-900 tones in CSS, Tailwind and tokens; off changes nothing', () => {
  const colors = [{ hex: '#3366cc', name: 'Sky', pinned: false }]
  const base = { prefix: 'x', format: 'hex' as const }
  const on = { ...base, scales: true }
  expect(exportTheme('css', colors, [], { ...base, scales: false })).toBe(exportTheme('css', colors, [], base))
  expect(exportTheme('tokens', colors, [], { ...base, scales: false })).toBe(exportTheme('tokens', colors, []))
  const css = exportTheme('css', colors, [], on)
  expect(css).toContain('--x-color-sky-50: #')
  expect(css).toContain('--x-color-sky-900: #')
  expect(css.match(/--x-color-sky/g)).toHaveLength(11)
  expect(exportTheme('tailwind', colors, [], { ...on, format: 'oklch' })).toMatch(/--color-sky-500: oklch\(/)
  const t = JSON.parse(exportTheme('tokens', colors, [], on)).color.sky
  expect(t.$value).toBeUndefined()
  expect(t.base).toEqual({ $value: '#3366cc' })
  expect(Object.keys(t).filter((k) => !k.startsWith('$'))).toHaveLength(11)
  expect(t['900']).toEqual({ $value: expect.stringMatching(/^#[0-9a-f]{6}$/) })
})

test('tone names never clash with a colour of the same name, and alpha colours skip the scale', () => {
  const css = exportTheme('css', [{ hex: '#3366cc', name: 'blue', pinned: false }, { hex: '#112233', name: 'blue-50', pinned: false }, { hex: '#ff000080', name: 'see-through', pinned: false }], [], { prefix: '', format: 'hex', scales: true })
  const names = [...css.matchAll(/--([\w-]+):/g)].map((m) => m[1])
  expect(new Set(names).size).toBe(names.length)
  expect(css).toContain('--color-see-through: #ff000080;')
  expect(css).not.toContain('see-through-50')
})
