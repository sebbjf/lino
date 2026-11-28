// Small validators shared by the element kinds (and snapshot.ts) for untrusted JSON.
export const MAX_TEXT = 10_000
export const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
export const isStr = (v: unknown, max = MAX_TEXT): v is string => typeof v === 'string' && v.length <= max
export const isHexStr = (v: unknown): v is string => isStr(v, 9) && HEX.test(v)
export const strList = (v: unknown, ok: (s: string) => boolean = () => true) =>
  Array.isArray(v) ? v.filter((s): s is string => isStr(s, 200) && ok(s)).slice(0, 20) : []
export const hexList = (v: unknown) => strList(v, (s) => HEX.test(s))
export const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => list.includes(v as T)

/** '#ABC', 'abc', '#aabbcc' → '#aabbcc'; anything else → null. */
export function normalizeHex(value: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim())
  if (!m) return null
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]
  return `#${h.toLowerCase()}`
}
