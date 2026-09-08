export const TS_CONFIG = 0xfffffffd
export const TS_RESET = 0xffffffff
export const TS_START = 0xfffffffe

export const FRAME_HEADER_BYTES = 4
export const CONFIG_FRAME_BYTES = 6

export function valveBytesFor(valveCount) {
  return Math.ceil(valveCount / 8)
}

export function packConfigFrame(valveCount) {
  const frame = new Uint8Array(CONFIG_FRAME_BYTES)
  const view = new DataView(frame.buffer)
  view.setUint32(0, TS_CONFIG >>> 0, true)
  view.setUint16(4, valveCount & 0xffff, true)
  return frame
}

export function packFrame(tsMs, bits) {
  const frame = new Uint8Array(FRAME_HEADER_BYTES + bits.length)
  new DataView(frame.buffer).setUint32(0, tsMs >>> 0, true)
  frame.set(bits, FRAME_HEADER_BYTES)
  return frame
}

export function valveBits(valves, B) {
  const buf = new Uint8Array(B)
  const maxValve = B * 8
  for (const v of valves) {
    if (v < 0 || v >= maxValve) continue
    buf[v >> 3] |= 1 << (7 - (v & 7))
  }
  return buf
}

export function buildAnimationFrames(rows, rowIntervalMs, valveCount) {
  const B = valveBytesFor(valveCount)
  const frames = [
    packConfigFrame(valveCount),
    packFrame(TS_RESET, new Uint8Array(B)),
    packFrame(TS_START, new Uint8Array(B)),
  ]
  rows.forEach((openValves, i) => {
    const bits = valveBits(openValves, B)
    if (bits.some((b) => b !== 0)) {
      frames.push(packFrame(i * rowIntervalMs, bits))
    }
  })
  frames.push(packFrame(rows.length * rowIntervalMs, new Uint8Array(B)))
  return frames
}

export function gridToOpenValveRows(grid) {
  return grid.map((row) => {
    const open = []
    for (let c = 0; c < row.length; c++) {
      if (row[c]) open.push(c)
    }
    return open
  })
}
