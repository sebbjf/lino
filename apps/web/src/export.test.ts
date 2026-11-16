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
