// Lưu/stream file nền: Range, giới hạn dung lượng, chặn path traversal.
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'

const dir = await mkdtemp(join(tmpdir(), 'perf-media-'))
process.env.PERF_MEDIA_DIR = dir
const { parseRange, saveMedia, openMedia } = await import('../src/perf/mediaStore.js')
const { lanAddresses } = await import('../src/routes/perf.js')

let fails = 0
const t = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra !== '' ? '  ' + JSON.stringify(extra) : ''}`)
  if (!cond) fails++
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const streamToBuf = async (s) => { const c = []; for await (const x of s) c.push(x); return Buffer.concat(c) }

t('không header → null', parseRange(undefined, 100) === null)
t('bytes=0-9', eq(parseRange('bytes=0-9', 100), { start: 0, end: 9 }))
t('bytes=90- → tới cuối', eq(parseRange('bytes=90-', 100), { start: 90, end: 99 }))
t('bytes=-10 → 10 byte cuối', eq(parseRange('bytes=-10', 100), { start: 90, end: 99 }))
t('end vượt size → kẹp', eq(parseRange('bytes=50-500', 100), { start: 50, end: 99 }))
t('start ≥ size → unsatisfiable', parseRange('bytes=100-', 100) === 'unsatisfiable')
t('nhiều khoảng → bỏ qua (null)', parseRange('bytes=0-1,5-6', 100) === null)
t('rác → null', parseRange('items=0-1', 100) === null)

const data = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 256))
const saved = await saveMedia('evt1', 'video/mp4', Readable.from([data.subarray(0, 400), data.subarray(400)]))
t('lưu: url dạng /api/perf/media/<event>/<file>.mp4', /^\/api\/perf\/media\/evt1\/[A-Za-z0-9_-]+\.mp4$/.test(saved.url), saved.url)
t('lưu: kind video, đủ byte', saved.kind === 'video' && saved.bytes === 1000)
const file = saved.url.split('/').pop()
t('file trên đĩa byte-exact', (await readFile(join(dir, 'evt1', file))).equals(data))

let m = await openMedia('evt1', file, 'bytes=10-19')
t('open Range 10-19 → đúng 10 byte', m.mime === 'video/mp4' && m.size === 1000 && (await streamToBuf(m.stream)).equals(data.subarray(10, 20)))
m = await openMedia('evt1', file, undefined)
t('open cả file', (await streamToBuf(m.stream)).equals(data))
m = await openMedia('evt1', file, 'bytes=2000-')
t('open Range ngoài file → unsatisfiable, không stream', m.range === 'unsatisfiable' && m.stream === null)

const code = async (p) => { try { await p; return 'ok' } catch (e) { return e.code } }
t('mime lạ → unsupported_type', await code(saveMedia('evt1', 'text/html', Readable.from([data]))) === 'unsupported_type')
t('eventId có .. → bad_event', await code(saveMedia('../x', 'image/png', Readable.from([data]))) === 'bad_event')
t('vượt maxBytes → too_large', await code(saveMedia('evt1', 'image/png', Readable.from([data, data]), 1500)) === 'too_large')
t('file rỗng → empty', await code(saveMedia('evt1', 'image/png', Readable.from([]))) === 'empty')
t('file lỗi không để lại rác trên đĩa', (await readdir(join(dir, 'evt1'))).length === 1)
t('open path traversal → not_found', await code(openMedia('evt1', '../../secret.mp4')) === 'not_found')
t('open file không tồn tại → not_found', await code(openMedia('evt1', 'nope.mp4')) === 'not_found')
t('open đuôi lạ → not_found', await code(openMedia('evt1', 'x.exe')) === 'not_found')

const fake = {
  lo: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
  eth: [{ family: 'IPv6', address: 'fe80::1', internal: false }, { family: 'IPv4', address: '192.168.1.150', internal: false }],
  wifi: [{ family: 4, address: '10.0.0.5', internal: false }],
}
t('lanAddresses: chỉ IPv4 ngoài (kể cả family số của Node 18)', eq(lanAddresses(fake), ['192.168.1.150', '10.0.0.5']))

await rm(dir, { recursive: true, force: true })
if (fails) { console.error(`${fails} test FAIL`); process.exit(1) }
console.log('All perf-media tests passed')
