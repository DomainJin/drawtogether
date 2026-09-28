/** Ghi file ZIP không nén (method 0 = STORE). Pure, không phụ thuộc thư viện.
 *
 *  PNG vốn đã nén — deflate thêm chỉ tốn CPU mà không nhỏ đi, nên STORE là đủ.
 *  Format: PKWARE APPNOTE 6.3.x §4.3. Mọi số little-endian. Tên file UTF-8
 *  (cờ bit 11) để tên tiếng Việt có dấu mở đúng trên Windows/macOS.
 *  Giới hạn: < 65535 file, mỗi file và tổng < 4GB (không dùng ZIP64). */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Giờ/ngày kiểu MS-DOS (độ phân giải 2 giây, năm từ 1980). */
export function dosDateTime(date) {
  const y = Math.max(1980, date.getFullYear())
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((y - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

const UTF8_FLAG = 0x0800
const VERSION = 20 // 2.0 — đủ cho STORE

/**
 * @param {Array<{name: string, data: Uint8Array}>} files
 * @param {Date} [date]
 * @returns {Uint8Array}
 */
export function buildZip(files, date = new Date()) {
  if (files.length > 0xfffe) throw new Error('Quá nhiều file cho ZIP thường')
  const enc = new TextEncoder()
  const { time, date: dday } = dosDateTime(date)
  const entries = files.map((f) => ({ name: enc.encode(f.name), data: f.data, crc: crc32(f.data) }))

  let localSize = 0, centralSize = 0
  for (const e of entries) {
    localSize += 30 + e.name.length + e.data.length
    centralSize += 46 + e.name.length
  }
  if (localSize + centralSize + 22 > 0xffffffff) throw new Error('ZIP vượt 4GB')

  const out = new Uint8Array(localSize + centralSize + 22)
  const view = new DataView(out.buffer)
  let p = 0
  const u16 = (v) => { view.setUint16(p, v, true); p += 2 }
  const u32 = (v) => { view.setUint32(p, v >>> 0, true); p += 4 }
  const bytes = (b) => { out.set(b, p); p += b.length }

  const offsets = []
  for (const e of entries) {
    offsets.push(p)
    u32(0x04034b50); u16(VERSION); u16(UTF8_FLAG); u16(0)
    u16(time); u16(dday); u32(e.crc); u32(e.data.length); u32(e.data.length)
    u16(e.name.length); u16(0)
    bytes(e.name); bytes(e.data)
  }
  const centralStart = p
  entries.forEach((e, i) => {
    u32(0x02014b50); u16(VERSION); u16(VERSION); u16(UTF8_FLAG); u16(0)
    u16(time); u16(dday); u32(e.crc); u32(e.data.length); u32(e.data.length)
    u16(e.name.length); u16(0); u16(0); u16(0); u16(0); u32(0); u32(offsets[i])
    bytes(e.name)
  })
  u32(0x06054b50); u16(0); u16(0); u16(entries.length); u16(entries.length)
  u32(centralSize); u32(centralStart); u16(0)
  return out
}

/** Tên file an toàn cho mọi hệ điều hành; giữ chữ có dấu. */
export function safeFileName(s, fallback = 'chu-ky') {
  // eslint-disable-next-line no-control-regex
  const clean = String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60)
  return clean || fallback
}
