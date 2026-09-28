// Fullscreen API qua cả tên chuẩn lẫn webkit (Safari iPad). Kiểm bằng object giả.
import {
  canFullscreen, enterFullscreen, exitFullscreen, fullscreenElement,
  isIOS, isStandalone, needsHomeScreenForFullscreen, shouldUseNativeFullscreen,
} from '../src/waterfall/fullscreen.js'

let fails = 0
const t = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
  if (!cond) fails++
}

/** Trình duyệt giả: `prefix` '' = API chuẩn, 'webkit' = Safari iPad, null = iPhone. */
function fakeBrowser(prefix, { reject = false } = {}) {
  const doc = {}
  const el = {}
  const key = (name) => (prefix ? prefix + name[0].toUpperCase() + name.slice(1) : name)
  if (prefix !== null) {
    el[key('requestFullscreen')] = function () {
      if (this !== el) throw new Error('mất this')
      if (reject) return Promise.reject(new Error('denied'))
      doc[key('fullscreenElement')] = el
      return Promise.resolve()
    }
    doc[key('exitFullscreen')] = function () {
      if (this !== doc) throw new Error('mất this')
      doc[key('fullscreenElement')] = null
      return Promise.resolve()
    }
    doc[key('fullscreenElement')] = null
  }
  return { doc, el }
}

for (const [label, prefix] of [['chuẩn', ''], ['webkit (iPad)', 'webkit']]) {
  const { doc, el } = fakeBrowser(prefix)
  t(`${label}: hỗ trợ`, canFullscreen(el))
  t(`${label}: ban đầu không fullscreen`, fullscreenElement(doc) === null)
  t(`${label}: vào được`, await enterFullscreen(el))
  t(`${label}: đang fullscreen đúng phần tử`, fullscreenElement(doc) === el)
  t(`${label}: thoát được`, await exitFullscreen(doc))
  t(`${label}: đã thoát`, fullscreenElement(doc) === null)
}

{
  const { doc, el } = fakeBrowser(null)
  t('iPhone: không hỗ trợ', !canFullscreen(el))
  t('iPhone: enter trả false, không ném lỗi', (await enterFullscreen(el)) === false)
  t('iPhone: exit khi không fullscreen → true', (await exitFullscreen(doc)) === true)
}
{
  const { doc, el } = fakeBrowser('', { reject: true })
  t('bị từ chối → false, không ném lỗi', (await enterFullscreen(el)) === false)
  t('bị từ chối → vẫn không fullscreen', fullscreenElement(doc) === null)
}
t('null an toàn', !canFullscreen(null) && fullscreenElement(null) === null && (await enterFullscreen(null)) === false)

// ── Nhận diện iOS / standalone, chọn có gọi Fullscreen API không ──
const UA = {
  ipadOld: 'Mozilla/5.0 (iPad; CPU OS 12_4 like Mac OS X) AppleWebKit/605.1.15',
  ipadNew: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0',
}
t('iPad đời cũ (UA có iPad) → iOS', isIOS({ userAgent: UA.ipadOld, maxTouchPoints: 5 }))
t('iPadOS 13+ tự xưng Macintosh, có cảm ứng → iOS', isIOS({ userAgent: UA.ipadNew, maxTouchPoints: 5 }))
t('Mac thật (Macintosh, không cảm ứng) → không iOS', !isIOS({ userAgent: UA.ipadNew, maxTouchPoints: 0 }))
t('iPhone → iOS', isIOS({ userAgent: UA.iphone, maxTouchPoints: 5 }))
t('Windows → không iOS', !isIOS({ userAgent: UA.win, maxTouchPoints: 10 }))
t('navigator thiếu → không iOS, không ném lỗi', !isIOS(undefined))

const mm = (modes) => (q) => ({ matches: modes.some((m) => q.includes(m)) })
t('navigator.standalone (iOS Màn hình chính)', isStandalone({ navigator: { standalone: true }, matchMedia: mm([]) }))
t('display-mode: standalone (PWA)', isStandalone({ navigator: {}, matchMedia: mm(['standalone']) }))
t('tab trình duyệt thường → không standalone', !isStandalone({ navigator: {}, matchMedia: mm([]) }))
t('matchMedia ném lỗi → coi như không standalone', !isStandalone({ navigator: {}, matchMedia: () => { throw new Error('x') } }))

t('máy tính, tab thường → DÙNG Fullscreen API', shouldUseNativeFullscreen({ ios: false, standalone: false }))
t('iPad Safari → KHÔNG (tránh hộp hỏi duy trì toàn màn hình)', !shouldUseNativeFullscreen({ ios: true, standalone: false }))
t('iPad từ Màn hình chính → KHÔNG (đã toàn màn hình)', !shouldUseNativeFullscreen({ ios: true, standalone: true }))
t('PWA trên máy tính → KHÔNG', !shouldUseNativeFullscreen({ ios: false, standalone: true }))

t('iPad Safari → nhắc Thêm vào MH chính', needsHomeScreenForFullscreen({ ios: true, standalone: false }))
t('iPad đã mở từ MH chính → không nhắc', !needsHomeScreenForFullscreen({ ios: true, standalone: true }))
t('máy tính → không nhắc', !needsHomeScreenForFullscreen({ ios: false, standalone: false }))
// Mỗi môi trường rơi vào ĐÚNG MỘT trong ba: gọi API / nhắc MH chính / đã toàn màn hình.
for (const ios of [true, false]) for (const standalone of [true, false]) {
  const n = shouldUseNativeFullscreen({ ios, standalone }) + needsHomeScreenForFullscreen({ ios, standalone })
  t(`ios=${ios} standalone=${standalone}: không vừa gọi API vừa nhắc`, n <= 1)
}

if (fails) { console.error(`${fails} test FAIL`); process.exit(1) }
console.log('All fullscreen tests passed')
