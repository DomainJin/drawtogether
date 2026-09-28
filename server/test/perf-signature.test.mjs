// Chữ ký từ khán giả: kẹp mép, làm tròn, từ chối rác. Format SPEC §3.1.
import { validateSignature, SIGNATURE_LIMITS as L } from '../src/perf/signature.js'

let fails = 0
const t = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra !== '' ? '  ' + JSON.stringify(extra) : ''}`)
  if (!cond) fails++
}
const ok = (over = {}) => ({ cid: 'abcdEFGH_1234', name: ' An ', color: '#FF0000', aspect: 2, strokes: [[0.1, 0.2, 0, 0.5, 0.5, 16]], ...over })

let r = validateSignature(ok())
t('hợp lệ', r.ok, r)
t('tên được trim', r.value.name === 'An')
t('màu → chữ thường', r.value.color === '#ff0000')

r = validateSignature(ok({ strokes: [[0.123456789, 0.987654321, 12.7]] }))
t('x,y làm tròn 4 số, t làm tròn nguyên', r.ok && r.value.strokes[0][0] === 0.1235 && r.value.strokes[0][1] === 0.9877 && r.value.strokes[0][2] === 13, r.value?.strokes)
t('nét 1 điểm (chấm) được nhận', r.ok)

r = validateSignature(ok({ strokes: [[-0.03, 1.04, 0]] }))
t('lệch mép trong dung sai → kẹp [0,1]', r.ok && r.value.strokes[0][0] === 0 && r.value.strokes[0][1] === 1)
r = validateSignature(ok({ strokes: [[-0.2, 0.5, 0]] }))
t('lệch mép quá dung sai → bad_point', !r.ok && r.error === 'bad_point')
r = validateSignature(ok({ strokes: [[0.1, NaN, 0]] }))
t('NaN → bad_point', !r.ok && r.error === 'bad_point')
r = validateSignature(ok({ strokes: [[0.1, '0.5', 0]] }))
t('chuỗi thay số → bad_point', !r.ok)
r = validateSignature(ok({ strokes: [[0.1, 0.5]] }))
t('độ dài không chia hết 3 → bad_stroke', !r.ok && r.error === 'bad_stroke')
r = validateSignature(ok({ strokes: [[0.1, 0.5, -1]] }))
t('t âm → bad_time', !r.ok && r.error === 'bad_time')
r = validateSignature(ok({ strokes: [[0.1, 0.5, L.MAX_DURATION_MS + 1]] }))
t('t quá dài → bad_time', !r.ok && r.error === 'bad_time')
r = validateSignature(ok({ strokes: [] }))
t('không nét nào → empty', !r.ok && r.error === 'empty')
r = validateSignature(ok({ strokes: Array(L.MAX_STROKES + 1).fill([0.1, 0.1, 0]) }))
t('quá nhiều nét', !r.ok && r.error === 'too_many_strokes')
const big = []
for (let i = 0; i <= L.MAX_POINTS; i++) big.push(0.5, 0.5, i)
r = validateSignature(ok({ strokes: [big] }))
t('quá nhiều điểm', !r.ok && r.error === 'too_many_points')
const exact = []
for (let i = 0; i < L.MAX_POINTS; i++) exact.push(0.5, 0.5, i)
r = validateSignature(ok({ strokes: [exact] }))
t('đúng MAX_POINTS vẫn nhận (biên)', r.ok)

t('cid ngắn → bad_cid', validateSignature(ok({ cid: 'abc' })).error === 'bad_cid')
t('cid ký tự lạ → bad_cid', validateSignature(ok({ cid: 'abc/../..xyz' })).error === 'bad_cid')
t('aspect 0 → bad_aspect', validateSignature(ok({ aspect: 0 })).error === 'bad_aspect')
t('aspect Infinity → bad_aspect', validateSignature(ok({ aspect: Infinity })).error === 'bad_aspect')
t('payload null', validateSignature(null).error === 'bad_payload')

r = validateSignature(ok({ name: 'A\u0007B' + 'x'.repeat(100) }))
t('tên: bỏ ký tự điều khiển, cắt MAX_NAME_CHARS', r.value.name.startsWith('AB') && r.value.name.length === L.MAX_NAME_CHARS)
r = validateSignature(ok({ name: 123, color: 'red' }))
t('tên không phải chuỗi → "", màu sai → null', r.ok && r.value.name === '' && r.value.color === null)
r = validateSignature(ok({ name: 'Nguyễn Thị Ánh' }))
t('giữ dấu tiếng Việt', r.value.name === 'Nguyễn Thị Ánh')

if (fails) { console.error(`${fails} test FAIL`); process.exit(1) }
console.log('All perf-signature tests passed')
