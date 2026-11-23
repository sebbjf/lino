import { describe, expect, it } from 'vitest'
import { toAse } from './ase'

function parse(b: Uint8Array) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const out = []
  let o = 12
  for (let i = 0; i < v.getUint32(8); i++) {
    expect(v.getUint16(o)).toBe(1)
    const len = v.getUint32(o + 2)
    const end = o + 6 + len
    o += 6
    const n = v.getUint16(o)
    o += 2
    let name = ''
    for (let k = 0; k < n - 1; k++) name += String.fromCharCode(v.getUint16(o + k * 2))
    o += n * 2
    const model = String.fromCharCode(...b.slice(o, o + 4))
    o += 4
    const rgb = [0, 1, 2].map((k) => v.getFloat32(o + k * 4))
    o += 12
    const type = v.getUint16(o)
    o += 2
    expect(o).toBe(end)
    out.push({ name, model, rgb, type })
  }
  return out
}

describe('toAse', () => {
  it('writes header and block count', () => {
    const b = toAse([{ hex: '#ff0000', name: 'Red' }, { hex: '#00f', name: 'Blue' }])
    expect([...b.slice(0, 4)]).toEqual([0x41, 0x53, 0x45, 0x46])
    expect([...b.slice(4, 8)]).toEqual([0, 1, 0, 0])
    expect(new DataView(b.buffer).getUint32(8)).toBe(2)
  })
  it('encodes name and floats', () => {
    const [c] = parse(toAse([{ hex: '#ff8000', name: 'Orange' }]))
    expect(c.name).toBe('Orange')
    expect(c.model).toBe('RGB ')
    expect(c.type).toBe(2)
    expect(c.rgb[0]).toBe(1)
    expect(c.rgb[1]).toBeCloseTo(128 / 255, 5)
    expect(c.rgb[2]).toBe(0)
  })
  it('skips invalid hex', () => {
    const b = toAse([{ hex: 'nope', name: 'x' }, { hex: '#123456', name: 'ok' }])
    expect(parse(b).map((c) => c.name)).toEqual(['ok'])
  })
  it('round-trips non-ASCII names', () => {
    expect(parse(toAse([{ hex: '#000', name: 'Café' }]))[0].name).toBe('Café')
  })
})
