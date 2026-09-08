export function bytesToHex(bytes) {
  let s = ''
  for (const b of bytes) s += b.toString(16).padStart(2, '0').toUpperCase()
  return s
}

export function cmdAllOff() {
  return { cmd: 'ALL_OFF' }
}

export function cmdAllOn() {
  return { cmd: 'ALL_ON' }
}

export function cmdStreamStop() {
  return { cmd: 'STREAM_STOP' }
}

export function cmdSet(bits) {
  return { cmd: 'SET', bits: bytesToHex(bits) }
}

export function cmdGetConfig() {
  return { cmd: 'GET_CONFIG' }
}

export function cmdSetTick(ms) {
  return { cmd: 'SET_TICK', ms: Math.max(1, Math.round(ms)) }
}
