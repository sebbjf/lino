import { normalizeHex } from './colors'

/** Adobe Swatch Exchange v1.0: one RGB colour entry per valid swatch. Invalid hex is skipped. */
export function toAse(colors: { hex: string; name: string }[]): Uint8Array {
  const entries = colors.flatMap((c) => {
    const hex = normalizeHex(c.hex)
    return hex ? [{ hex, name: c.name }] : []
  })
  // block body: u16 nameLen + name UTF-16BE + NUL, 'RGB ', 3 x f32, u16 type
  const sizes = entries.map((e) => 2 + (e.name.length + 1) * 2 + 4 + 12 + 2)
  const buf = new Uint8Array(12 + sizes.reduce((a, s) => a + 6 + s, 0))
  const v = new DataView(buf.buffer)
  buf.set([0x41, 0x53, 0x45, 0x46]) // 'ASEF'
  v.setUint16(4, 1)
  v.setUint16(6, 0)
  v.setUint32(8, entries.length)
  let o = 12
  entries.forEach((e, i) => {
    v.setUint16(o, 1)
    v.setUint32(o + 2, sizes[i])
    o += 6
    v.setUint16(o, e.name.length + 1)
    o += 2
    for (let k = 0; k < e.name.length; k++, o += 2) v.setUint16(o, e.name.charCodeAt(k))
    o += 2 // NUL terminator
    buf.set([0x52, 0x47, 0x42, 0x20], o) // 'RGB '
    o += 4
    for (let k = 0; k < 3; k++, o += 4) v.setFloat32(o, parseInt(e.hex.slice(1 + k * 2, 3 + k * 2), 16) / 255)
    v.setUint16(o, 2)
    o += 2
  })
  return buf
}
