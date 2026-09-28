/** File nền (ảnh/video) của Performance mode, lưu trên đĩa máy chủ.
 *
 *  Không lưu vào DB: video nền cả trăm MB, và màn show phải tua/lặp được —
 *  cần stream theo Range, việc của file hệ thống. Đường dẫn tính từ vị trí
 *  module chứ không từ cwd: bản portable chạy server với cwd khác. */
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, stat, unlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'
import { nanoid } from 'nanoid'

export const MEDIA_MAX_BYTES = 300 * 1024 * 1024

export const MEDIA_TYPES = {
  'image/png': { ext: '.png', kind: 'image' },
  'image/jpeg': { ext: '.jpg', kind: 'image' },
  'image/webp': { ext: '.webp', kind: 'image' },
  'image/gif': { ext: '.gif', kind: 'image' },
  'video/mp4': { ext: '.mp4', kind: 'video' },
  'video/webm': { ext: '.webm', kind: 'video' },
  'video/quicktime': { ext: '.mov', kind: 'video' },
}

const MIME_BY_EXT = Object.fromEntries(Object.entries(MEDIA_TYPES).map(([mime, { ext }]) => [ext, mime]))

const DEFAULT_DIR = resolve(fileURLToPath(new URL('../../uploads/perf/', import.meta.url)))
const ROOT = process.env.PERF_MEDIA_DIR ? resolve(process.env.PERF_MEDIA_DIR) : DEFAULT_DIR

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/
const SAFE_FILE = /^[A-Za-z0-9_-]{1,64}\.[a-z0-9]{2,5}$/

export class MediaError extends Error {
  constructor(code, status) {
    super(code)
    this.code = code
    this.status = status
  }
}

/** Ghi stream vào đĩa, cắt ngang khi vượt `maxBytes` (không tin Content-Length).
 *  @returns {{url, kind, bytes}} */
export async function saveMedia(eventId, mime, stream, maxBytes = MEDIA_MAX_BYTES) {
  const type = MEDIA_TYPES[mime]
  if (!type) throw new MediaError('unsupported_type', 415)
  if (!SAFE_ID.test(eventId)) throw new MediaError('bad_event', 400)

  const dir = join(ROOT, eventId)
  await mkdir(dir, { recursive: true })
  const file = `${nanoid(14).replace(/[^A-Za-z0-9_-]/g, '_')}${type.ext}`
  const full = join(dir, file)

  let bytes = 0
  const limiter = new Transform({
    transform(chunk, _enc, cb) {
      bytes += chunk.length
      if (bytes > maxBytes) cb(new MediaError('too_large', 413))
      else cb(null, chunk)
    },
  })

  try {
    await pipeline(stream, limiter, createWriteStream(full))
  } catch (err) {
    await unlink(full).catch(() => {})
    throw err instanceof MediaError ? err : new MediaError('write_failed', 500)
  }
  if (bytes === 0) {
    await unlink(full).catch(() => {})
    throw new MediaError('empty', 400)
  }
  return { url: `/api/perf/media/${eventId}/${file}`, kind: type.kind, bytes }
}

/** Phân tích header Range một khoảng. null = không có/không hợp lệ → trả cả file.
 *  @returns {{start, end} | null | 'unsatisfiable'} */
export function parseRange(header, size) {
  if (!header) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m || (m[1] === '' && m[2] === '')) return null
  let start, end
  if (m[1] === '') {
    // "bytes=-500" = 500 byte cuối
    const n = Number(m[2])
    start = Math.max(0, size - n)
    end = size - 1
  } else {
    start = Number(m[1])
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
  }
  if (start > end || start >= size) return 'unsatisfiable'
  return { start, end }
}

/** @returns {{stream, size, mime, range}} */
export async function openMedia(eventId, file, rangeHeader) {
  if (!SAFE_ID.test(eventId) || !SAFE_FILE.test(file)) throw new MediaError('not_found', 404)
  const ext = file.slice(file.lastIndexOf('.'))
  const mime = MIME_BY_EXT[ext]
  if (!mime) throw new MediaError('not_found', 404)

  const full = join(ROOT, eventId, file)
  let size
  try {
    size = (await stat(full)).size
  } catch {
    throw new MediaError('not_found', 404)
  }
  const range = parseRange(rangeHeader, size)
  if (range === 'unsatisfiable') return { stream: null, size, mime, range }
  const stream = range ? createReadStream(full, range) : createReadStream(full)
  return { stream, size, mime, range }
}
