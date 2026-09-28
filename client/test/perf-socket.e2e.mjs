// E2E giao thức Performance (SPEC §4) với server THẬT đang chạy + Postgres.
// Không nằm trong `npm test` (cần server). Chạy: node test/perf-socket.e2e.mjs [http://localhost:3001]
import { io } from 'socket.io-client'

const SERVER = process.argv[2] || 'http://localhost:3001'
let fails = 0
const t = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra !== '' ? '  ' + JSON.stringify(extra) : ''}`)
  if (!cond) fails++
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const connect = () => new Promise((resolve, reject) => {
  const s = io(SERVER, { transports: ['websocket'], reconnection: false })
  s.on('connect', () => resolve(s))
  s.on('connect_error', reject)
})
const ack = (s, ev, p) => s.timeout(5000).emitWithAck(ev, p)
/** Ghi lại mọi push event một socket nhận được. */
const recorder = (s) => {
  const got = []
  for (const ev of ['perf:config', 'perf:sig:add', 'perf:sig:update', 'perf:sig:delete', 'perf:sig:clear']) {
    s.on(ev, (p) => got.push([ev, p]))
  }
  return got
}
const sig = (cid, over = {}) => ({ cid, name: 'Khán giả', color: null, aspect: 2, strokes: [[0.1, 0.5, 0, 0.5, 0.2, 120, 0.9, 0.5, 300]], ...over })

const created = await (await fetch(`${SERVER}/api/perf/events`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'E2E' }),
})).json()
const id = created.event.id
t('tạo sự kiện', !!id && !!created.adminKey)

const admin = await connect(), show = await connect(), signer = await connect(), signer2 = await connect()
const adminGot = recorder(admin), showGot = recorder(show), signerGot = recorder(signer)

let r = await ack(admin, 'perf:join', { eventId: id, role: 'admin', adminKey: 'sai' })
t('admin sai khoá → bad_key', !r.ok && r.error === 'bad_key')
r = await ack(admin, 'perf:join', { eventId: 'khongco', role: 'show' })
t('sự kiện không tồn tại → not_found', !r.ok && r.error === 'not_found')

r = await ack(admin, 'perf:join', { eventId: id, role: 'admin', adminKey: created.adminKey })
t('admin join: có schema + config + danh sách', r.ok && r.isAdmin && !!r.schema?.ink && !!r.config?.ink && Array.isArray(r.signatures))
r = await ack(show, 'perf:join', { eventId: id, role: 'show' })
t('show join: có chữ ký, không có schema', r.ok && !r.isAdmin && !r.schema && Array.isArray(r.signatures))
r = await ack(signer, 'perf:join', { eventId: id, role: 'signer' })
t('signer join: chỉ config', r.ok && !r.signatures && !!r.config?.sign)
await ack(signer2, 'perf:join', { eventId: id, role: 'signer' })

// Quyền: show/signer không sửa được config, không xoá được chữ ký
r = await ack(show, 'perf:config', { config: { ink: { color: '#000000' } } })
t('show sửa config → forbidden', !r.ok && r.error === 'forbidden')
r = await ack(signer, 'perf:sig:clear', {})
t('signer xoá hết → forbidden', !r.ok && r.error === 'forbidden')

// Ký
r = await ack(signer, 'perf:sign', sig('cid_e2e_00000001'))
t('ký hợp lệ → visible', r.ok && r.status === 'visible', r)
const sigId = r.id
await sleep(200)
const added = showGot.find(([ev]) => ev === 'perf:sig:add')
t('show nhận perf:sig:add đủ trường', added && added[1].id === sigId && added[1].strokes.length === 1 && typeof added[1].createdAt === 'number')
t('admin cũng nhận', adminGot.some(([ev, p]) => ev === 'perf:sig:add' && p.id === sigId))
t('signer KHÔNG nhận chữ ký người khác', !signerGot.some(([ev]) => ev === 'perf:sig:add'))

r = await ack(signer, 'perf:sign', sig('cid_e2e_00000002'))
t('gửi liền → too_fast (cooldown)', !r.ok && r.error === 'too_fast')

// Retry cùng cid (ack lần trước bị mất) → không tạo bản trùng
await sleep(1600)
const before = showGot.filter(([ev]) => ev === 'perf:sig:add').length
r = await ack(signer, 'perf:sign', sig('cid_e2e_00000001'))
await sleep(200)
t('retry cùng cid → trả id cũ, không phát lại', r.ok && r.id === sigId && showGot.filter(([ev]) => ev === 'perf:sig:add').length === before)

r = await ack(signer2, 'perf:sign', sig('cid_e2e_bad_0001', { strokes: [[5, 5, 0]] }))
t('toạ độ rác → bad_point', !r.ok && r.error === 'bad_point')

// Config: sanitize + phát cho mọi người TRỪ người sửa
r = await ack(admin, 'perf:config', { config: { ...created.config, ink: { color: '#FF0000', width: 99 }, moderation: { requireApproval: true }, sign: { nameField: 'required' } } })
t('admin sửa config → ack đã sanitize', r.ok && r.config.ink.color === '#ff0000' && r.config.ink.width === 0.08 && r.config.moderation.requireApproval === true)
await sleep(200)
t('show nhận perf:config', showGot.some(([ev, p]) => ev === 'perf:config' && p.config.ink.color === '#ff0000'))
t('signer nhận perf:config', signerGot.some(([ev, p]) => ev === 'perf:config' && p.config.ink.color === '#ff0000'))
t('admin (người sửa) KHÔNG nhận echo', !adminGot.some(([ev]) => ev === 'perf:config'))

r = await ack(signer2, 'perf:sign', sig('cid_e2e_00000003', { name: '' }))
t('nameField=required, tên rỗng → name_required', !r.ok && r.error === 'name_required')
r = await ack(signer2, 'perf:sign', sig('cid_e2e_00000003', { name: 'Có tên' }))
t('requireApproval → chữ ký mới ở pending', r.ok && r.status === 'pending', r)
const pendingId = r.id

r = await ack(admin, 'perf:sig:status', { id: pendingId, status: 'visible' })
await sleep(200)
t('duyệt → show nhận perf:sig:update', r.ok && showGot.some(([ev, p]) => ev === 'perf:sig:update' && p.id === pendingId && p.status === 'visible'))
r = await ack(admin, 'perf:sig:status', { id: pendingId, status: 'xoa-luon' })
t('status lạ → bad_request', !r.ok && r.error === 'bad_request')

r = await ack(admin, 'perf:sig:delete', { id: sigId })
await sleep(200)
t('xoá → show nhận perf:sig:delete', r.ok && showGot.some(([ev, p]) => ev === 'perf:sig:delete' && p.id === sigId))
r = await ack(admin, 'perf:sig:delete', { id: sigId })
t('xoá lần 2 → not_found', !r.ok && r.error === 'not_found')

// Reconnect màn show: join lại nhận đúng state hiện tại
show.disconnect()
const show2 = await connect()
r = await ack(show2, 'perf:join', { eventId: id, role: 'show' })
t('show join lại: đúng 1 chữ ký còn lại, config mới', r.ok && r.signatures.length === 1 && r.signatures[0].id === pendingId && r.config.ink.color === '#ff0000')

r = await ack(admin, 'perf:sig:clear', {})
await sleep(200)
t('xoá hết → count 1, show2 nhận perf:sig:clear', r.ok && r.count === 1)

for (const s of [admin, show2, signer, signer2]) s.disconnect()
if (fails) { console.error(`${fails} test FAIL`); process.exit(1) }
console.log('All perf-socket e2e tests passed')
