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
