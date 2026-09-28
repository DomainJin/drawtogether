// Store Performance (setIn/upsert) + link QR/khoá admin.
import { setIn, getIn, upsertSignature, usePerformanceStore } from '../src/store/performanceStore.js'
import { signUrl, isLoopbackUrl, originForHost } from '../src/performance/links.js'

let fails = 0
const t = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra !== '' ? '  ' + JSON.stringify(extra) : ''}`)
  if (!cond) fails++
}

const base = { ink: { color: '#fff', width: 1 }, name: { font: 'A' } }
const next = setIn(base, 'ink.color', '#000')
t('setIn đổi đúng lá', next.ink.color === '#000' && next.ink.width === 1)
t('setIn không mutate bản cũ', base.ink.color === '#fff')
t('setIn giữ tham chiếu nhánh không đổi', next.name === base.name)
t('setIn tạo nhánh thiếu', setIn({}, 'a.b.c', 1).a.b.c === 1)
t('getIn', getIn(base, 'ink.width') === 1 && getIn(base, 'x.y') === undefined)

const s = (id, createdAt) => ({ id, createdAt, status: 'visible' })
let list = [s('a', 1), s('c', 3)]
list = upsertSignature(list, s('b', 2))
t('upsert chèn đúng thứ tự thời gian', list.map((x) => x.id).join() === 'a,b,c')
list = upsertSignature(list, { ...s('b', 2), status: 'hidden' })
t('upsert trùng id → thay, không nhân đôi', list.length === 3 && list[1].status === 'hidden')
list = upsertSignature(list, s('d', 4))
t('upsert mới nhất → cuối', list[3].id === 'd')

const st = usePerformanceStore.getState()
st.reset('evt')
st.applyJoin({ event: { id: 'evt' }, config: { a: 1 }, signatures: [s('x', 1)], isAdmin: true, schema: { a: {} } })
st.addSignature(s('y', 2))
st.updateSignature({ id: 'x', status: 'hidden' })
t('store: add + update', usePerformanceStore.getState().signatures.map((x) => x.id + x.status).join() === 'xhidden,yvisible')
st.removeSignature({ id: 'x' })
t('store: remove', usePerformanceStore.getState().signatures.length === 1)
st.applyJoin({ event: { id: 'evt' }, config: { a: 2 }, isAdmin: false })
t('store: join lại không có signatures (signer) → giữ danh sách, giữ schema', usePerformanceStore.getState().signatures.length === 1 && !!usePerformanceStore.getState().schema)
st.clearSignatures()
t('store: clear', usePerformanceStore.getState().signatures.length === 0)

t('signUrl mặc định theo origin', signUrl('abc', '', 'http://192.168.1.5:5173') === 'http://192.168.1.5:5173/s/abc')
t('signUrl ưu tiên publicBaseUrl, bỏ / cuối', signUrl('abc', 'http://10.0.0.2:5173/', 'http://localhost:5173') === 'http://10.0.0.2:5173/s/abc')
t('loopback: localhost', isLoopbackUrl('http://localhost:5173/s/a'))
t('loopback: 127.0.0.1', isLoopbackUrl('http://127.0.0.1:5173/s/a'))
t('không loopback: IP LAN', !isLoopbackUrl('http://192.168.1.5:5173/s/a'))
t('URL hỏng → không loopback', !isLoopbackUrl('::::'))
t('originForHost giữ port + protocol', originForHost('192.168.1.9', { protocol: 'http:', port: '5173' }) === 'http://192.168.1.9:5173')
t('originForHost không port', originForHost('10.0.0.1', { protocol: 'https:', port: '' }) === 'https://10.0.0.1')

if (fails) { console.error(`${fails} test FAIL`); process.exit(1) }
console.log('All perf-store tests passed')
