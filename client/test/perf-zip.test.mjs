// ZIP STORE: kiểm byte-exact theo APPNOTE §4.3 (little-endian, CRC-32, cờ UTF-8).
import { buildZip, crc32, dosDateTime, safeFileName } from '../src/performance/zipStore.js'

let fails = 0
const t = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra !== '' ? '  ' + JSON.stringify(extra) : ''}`)
  if (!cond) fails++
}
const enc = new TextEncoder()
const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join(' ')

t('CRC32("123456789") = CBF43926 (vector chuẩn)', crc32(enc.encode('123456789')) === 0xcbf43926)
t('CRC32("") = 0', crc32(new Uint8Array()) === 0)
t('CRC32("a") = E8B7BE43', crc32(enc.encode('a')) === 0xe8b7be43)

const dt = dosDateTime(new Date(2026, 8, 28, 14, 30, 59))
t('DOS time 14:30:59 → giây/2 = 29', dt.time === ((14 << 11) | (30 << 5) | 29))
t('DOS date 2026-09-28', dt.date === (((2026 - 1980) << 9) | (9 << 5) | 28))
t('DOS date trước 1980 → kẹp 1980', dosDateTime(new Date(1970, 0, 1)).date >> 9 === 0)

const date = new Date(2026, 8, 28, 14, 30, 58)
const data = enc.encode('hello')
const z = buildZip([{ name: 'a.txt', data }], date)
const v = new DataView(z.buffer)
t('độ dài = 30+5+5 + 46+5 + 22', z.length === 113, z.length)
t('local header signature 50 4B 03 04', hex(z.subarray(0, 4)) === '50 4b 03 04')
t('version 20, flags 0x0800 (UTF-8), method 0', v.getUint16(4, true) === 20 && v.getUint16(6, true) === 0x0800 && v.getUint16(8, true) === 0)
t('CRC trong local header', v.getUint32(14, true) === crc32(data))
t('size nén = size gốc = 5', v.getUint32(18, true) === 5 && v.getUint32(22, true) === 5)
t('tên + dữ liệu đúng chỗ', new TextDecoder().decode(z.subarray(30, 35)) === 'a.txt' && new TextDecoder().decode(z.subarray(35, 40)) === 'hello')
t('central header ở offset 40', v.getUint32(40, true) === 0x02014b50)
t('central: offset local = 0', v.getUint32(40 + 42, true) === 0)
const eocd = z.length - 22
t('EOCD signature', v.getUint32(eocd, true) === 0x06054b50)
t('EOCD: 1 entry', v.getUint16(eocd + 8, true) === 1 && v.getUint16(eocd + 10, true) === 1)
t('EOCD: size central = 51, offset = 40', v.getUint32(eocd + 12, true) === 51 && v.getUint32(eocd + 16, true) === 40)

const z2 = buildZip([{ name: 'Nguyễn.png', data: new Uint8Array([1, 2, 3]) }, { name: 'b.png', data: new Uint8Array(0) }], date)
const v2 = new DataView(z2.buffer)
const nameLen = v2.getUint16(26, true)
const want = enc.encode('Nguyễn.png').length
t('tên UTF-8: độ dài theo BYTE, không theo ký tự (Nguyễn.png = 12 byte)', nameLen === want && want === 12, nameLen)
const second = 30 + want + 3
t('file thứ 2 bắt đầu đúng offset', v2.getUint32(second, true) === 0x04034b50)
const eocd2 = z2.length - 22
const cdStart = v2.getUint32(eocd2 + 16, true)
t('central entry 2 trỏ về đúng offset local', v2.getUint32(cdStart + 46 + want + 42, true) === second)
t('file rỗng: CRC 0, size 0', v2.getUint32(second + 14, true) === 0 && v2.getUint32(second + 18, true) === 0)
t('zip rỗng = chỉ EOCD', buildZip([], date).length === 22)

t('safeFileName bỏ ký tự cấm, giữ dấu', safeFileName('Trần/Văn:A*?') === 'TrầnVănA')
t('safeFileName rỗng → fallback', safeFileName('  ') === 'chu-ky')

// Để kiểm bằng công cụ ngoài: node test/perf-zip.test.mjs --write <file>
const i = process.argv.indexOf('--write')
if (i > 0) {
  const { writeFileSync } = await import('node:fs')
  writeFileSync(process.argv[i + 1], z2)
  console.log('wrote', process.argv[i + 1])
}

if (fails) { console.error(`${fails} test FAIL`); process.exit(1) }
console.log('All perf-zip tests passed')
