/** Upload ảnh để vẽ đè: đặt đúng chỗ, nén vừa ngân sách, server nhận đúng thứ
 *  client gửi, và thứ tự lớp không bị đảo.
 *
 *  Những lỗi ở đây KHÔNG hiện ra khi thử bằng tay ở zoom 100%:
 *   - Quy đổi px màn hình ↔ px bảng sai hệ số chỉ lộ ra ở zoom khác 1.
 *   - Ngân sách client lớn hơn trần server thì ảnh nhỏ vẫn chạy, chỉ ảnh lớn
 *     bị server bỏ im lặng.
 *   - Ảnh giải mã chậm hơn nét vẽ tới sau thì nét bị ảnh đè — chỉ thấy khi
 *     mạng chậm hoặc ảnh to.
 */
import { IMAGE_CONFIG as CFG, WHITEBOARD_CONFIG as WB } from '../src/whiteboard/config.js'
import {
  validateImageFile, scaleToFit, viewportInCanvas, clampRectToBoard, fitImageToView,
  moveRect, resizeFromCorner, rectToPoints, pointsToRect, encodeWithinBudget, buildImageStroke,
} from '../src/whiteboard/imagePlacement.js'
import { enqueueRender } from '../src/whiteboard/renderQueue.js'
import {
  IMAGE_STROKE_MAX_SRC_CHARS, SOCKET_MAX_HTTP_BUFFER_BYTES, BOARD_SIZE_PX,
  validateImageStroke, isImageStroke,
} from '../../server/src/socket/imageStroke.js'

let fails = 0
const t = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
  if (!cond) fails++
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps
const BOARD = WB.CANVAS_SIZE

// ── 1. Client và server nói cùng một ngôn ngữ ────────────────────────────────
t('ngân sách nén client < trần server',
  CFG.MAX_ENCODED_CHARS < IMAGE_STROKE_MAX_SRC_CHARS,
  `${CFG.MAX_ENCODED_CHARS} < ${IMAGE_STROKE_MAX_SRC_CHARS}`)
t('gói socket server chứa được ảnh lớn nhất',
  SOCKET_MAX_HTTP_BUFFER_BYTES > IMAGE_STROKE_MAX_SRC_CHARS)
t('kích thước bảng client = server', BOARD === BOARD_SIZE_PX, `${BOARD} / ${BOARD_SIZE_PX}`)

// ── 2. Kiểm file đầu vào ─────────────────────────────────────────────────────
t('nhận PNG hợp lệ', validateImageFile({ type: 'image/png', size: 1000 }) === null)
t('từ chối SVG', validateImageFile({ type: 'image/svg+xml', size: 10 }) !== null)
t('từ chối file không có type', validateImageFile({ type: '', size: 10 }) !== null)
t('từ chối file vượt trần',
  validateImageFile({ type: 'image/jpeg', size: CFG.MAX_FILE_BYTES + 1 }) !== null)
t('đúng trần vẫn nhận', validateImageFile({ type: 'image/jpeg', size: CFG.MAX_FILE_BYTES }) === null)
t('không có file', validateImageFile(null) !== null)

// ── 3. Khung nhìn ↔ bảng vẽ ──────────────────────────────────────────────────
{
  // Đúng quy ước screenToCanvas của WhiteboardCanvas: (client - cam) / zoom.
  const cam = { x: -1000, y: -500, zoom: 0.29 }
  const v = viewportInCanvas(cam, 1761, 742)
  const screenToCanvas = (sx, sy) => ({ x: (sx - cam.x) / cam.zoom, y: (sy - cam.y) / cam.zoom })
  const tl = screenToCanvas(0, 0)
  const br = screenToCanvas(1761, 742)
  t('góc trên-trái khung nhìn khớp screenToCanvas', near(v.x, tl.x) && near(v.y, tl.y))
  t('góc dưới-phải khung nhìn khớp screenToCanvas',
    near(v.x + v.w, br.x) && near(v.y + v.h, br.y))
}

// ── 4. Chỗ đặt ban đầu ───────────────────────────────────────────────────────
{
  const view = { x: 1000, y: 1000, w: 2000, h: 1000 }
  const r = fitImageToView(3000, 1500, view)
  t('ảnh to thu vào INITIAL_VIEW_RATIO khung nhìn',
    near(r.w, 2000 * CFG.INITIAL_VIEW_RATIO) || near(r.h, 1000 * CFG.INITIAL_VIEW_RATIO),
    `${r.w.toFixed(0)}x${r.h.toFixed(0)}`)
  t('giữ tỉ lệ ảnh', near(r.w / r.h, 2))
  t('nằm giữa khung nhìn',
    near(r.x + r.w / 2, view.x + view.w / 2) && near(r.y + r.h / 2, view.y + view.h / 2))

  const small = fitImageToView(200, 100, view)
  t('ảnh nhỏ không bị phóng to quá cỡ thật', small.w === 200 && small.h === 100)

  // Khung nhìn lệch hẳn ra ngoài bảng (pan quá tay): ảnh vẫn phải nằm trên bảng.
  const off = fitImageToView(800, 600, { x: 3800, y: -400, w: 1000, h: 1000 })
  t('khung nhìn lệch ra ngoài → ảnh vẫn trong bảng',
    off.x >= 0 && off.y >= 0 && off.x + off.w <= BOARD + 1e-9 && off.y + off.h <= BOARD + 1e-9,
    `(${off.x.toFixed(0)},${off.y.toFixed(0)})`)

  const huge = clampRectToBoard({ x: -50, y: 10, w: 8000, h: 2000 })
  t('khung to hơn bảng bị thu lại, giữ tỉ lệ',
    near(huge.w, BOARD) && near(huge.w / huge.h, 4) && huge.x === 0)
}

// ── 5. Kéo dời ở zoom khác 1 ─────────────────────────────────────────────────
{
  const rect = { x: 1000, y: 1000, w: 400, h: 300 }
  const z = 0.29
  const m = moveRect(rect, 100, -50, z)
  t('kéo 100px màn hình ở zoom 29% = dời 344.8px bảng',
    near(m.x - rect.x, 100 / z) && near(m.y - rect.y, -50 / z),
    `dx=${(m.x - rect.x).toFixed(1)}`)
  t('dời không đổi cỡ', m.w === rect.w && m.h === rect.h)

  // Kéo quá mép rồi kéo về: tính từ khung lúc bắt đầu nên không trôi.
  moveRect(rect, -100000, 0, z)
  const back = moveRect(rect, 10, 0, z)
  t('kéo quá mép rồi kéo về không trôi khỏi con trỏ', near(back.x, rect.x + 10 / z))
  const edge = moveRect(rect, 1e6, 1e6, 1)
  t('bị chặn ở mép bảng', near(edge.x, BOARD - rect.w) && near(edge.y, BOARD - rect.h))
}

// ── 6. Kéo góc đổi cỡ ────────────────────────────────────────────────────────
{
  const rect = { x: 500, y: 500, w: 400, h: 200 }
  const z = 2
  const r = resizeFromCorner(rect, 100, 0, z)
  t('kéo ngang 100px ở zoom 200% = rộng thêm 50px bảng', near(r.w, 450), `w=${r.w}`)
  t('đổi cỡ giữ tỉ lệ', near(r.w / r.h, 2))
  t('góc trên-trái đứng yên', r.x === rect.x && r.y === rect.y)

  const byY = resizeFromCorner(rect, 0, 100, 1)
  t('kéo dọc cũng đổi cỡ theo tỉ lệ', near(byY.h, 300) && near(byY.w, 600))

  const tiny = resizeFromCorner(rect, -100000, -100000, 1)
  t('thu nhỏ bị chặn ở MIN_PLACED_PX cạnh ngắn', near(Math.min(tiny.w, tiny.h), CFG.MIN_PLACED_PX),
    `${tiny.w}x${tiny.h}`)

  const nearEdge = { x: BOARD - 300, y: 100, w: 200, h: 100 }
  const big = resizeFromCorner(nearEdge, 100000, 0, 1)
  t('phóng to không tràn khỏi bảng', big.x + big.w <= BOARD + 1e-9 && big.y + big.h <= BOARD + 1e-9,
    `${big.w}x${big.h}`)
}

// ── 7. Lưu dạng 2 góc ────────────────────────────────────────────────────────
{
  const rect = { x: 12.345, y: 67.89, w: 100.04, h: 50.06 }
  const back = pointsToRect(rectToPoints(rect))
  t('khung → 2 góc → khung sai lệch dưới 0.1px',
    ['x', 'y', 'w', 'h'].every((k) => Math.abs(back[k] - rect[k]) <= 0.1 + 1e-9))

  const stroke = buildImageStroke({ x: 10, y: 20, w: 300, h: 200 }, 'data:image/jpeg;base64,QUJD')
  t('stroke ảnh có tool=image và 2 điểm', stroke.tool === 'image' && stroke.points.length === 2)
  t('stroke ảnh đủ cột NOT NULL của DB',
    typeof stroke.color === 'string' && Number.isFinite(stroke.width) && Number.isFinite(stroke.opacity))
  t('server nhận stroke client dựng ra', validateImageStroke(stroke) === null, validateImageStroke(stroke) || '')
  t('server nhận diện đúng loại ảnh', isImageStroke(stroke) && !isImageStroke({ tool: 'pen' }))
}

// ── 8. Server từ chối ảnh bẩn ────────────────────────────────────────────────
{
  const ok = { tool: 'image', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], src: 'data:image/png;base64,iVBORw0KGgo=' }
  t('data URL png hợp lệ được nhận', validateImageStroke(ok) === null)
  t('từ chối SVG', validateImageStroke({ ...ok, src: 'data:image/svg+xml;base64,PHN2Zz4=' }) !== null)
  t('từ chối URL http', validateImageStroke({ ...ok, src: 'https://evil.example/a.png' }) !== null)
  t('từ chối base64 có ký tự lạ', validateImageStroke({ ...ok, src: 'data:image/png;base64,abc"<script>' }) !== null)
  t('từ chối ảnh vượt trần',
    validateImageStroke({ ...ok, src: 'data:image/png;base64,' + 'A'.repeat(IMAGE_STROKE_MAX_SRC_CHARS) }) !== null)
  t('từ chối khung ngược', validateImageStroke({ ...ok, points: [{ x: 10, y: 10 }, { x: 0, y: 0 }] }) !== null)
  t('từ chối toạ độ NaN', validateImageStroke({ ...ok, points: [{ x: NaN, y: 0 }, { x: 10, y: 10 }] }) !== null)
  t('từ chối ảnh nằm ngoài bảng',
    validateImageStroke({ ...ok, points: [{ x: 5000, y: 5000 }, { x: 5100, y: 5100 }] }) !== null)
  t('từ chối thiếu points', validateImageStroke({ ...ok, points: undefined }) !== null)

  // Ảnh ở trần ngân sách client thật sự lọt qua server (base64 hợp lệ).
  const prefix = 'data:image/jpeg;base64,'
  const body = 'A'.repeat(Math.floor((CFG.MAX_ENCODED_CHARS - prefix.length) / 4) * 4)
  t('ảnh đúng trần ngân sách client vẫn qua server',
    validateImageStroke({ ...ok, src: prefix + body }) === null, `${(prefix + body).length} ký tự`)
}

// ── 9. Dò nấc nén ────────────────────────────────────────────────────────────
{
  // Encoder giả: độ dài tỉ lệ số pixel × chất lượng — đủ giống JPEG về xu hướng.
  const calls = []
  const fake = (bytesPerPx) => (w, h, q) => {
    calls.push({ w, h, q })
    return 'x'.repeat(Math.round(w * h * q * bytesPerPx))
  }
  const cfg = { ...CFG, MAX_ENCODED_CHARS: 1000, MAX_DIMENSION_PX: 100, MIN_DIMENSION_PX: 20 }

  const easy = encodeWithinBudget(fake(0.01), 4000, 2000, cfg)
  t('ảnh dễ nén: lấy chất lượng cao nhất', easy.quality === cfg.JPEG_QUALITIES[0], `q=${easy?.quality}`)
  t('luôn thu về MAX_DIMENSION_PX trước khi thử', easy.w === 100 && easy.h === 50, `${easy.w}x${easy.h}`)

  calls.length = 0
  const mid = encodeWithinBudget(fake(0.15), 100, 100, cfg)
  t('vượt ngân sách: hạ chất lượng TRƯỚC khi thu nhỏ',
    mid && mid.w === 100 && mid.quality < cfg.JPEG_QUALITIES[0], `q=${mid?.quality} ${mid?.w}px`)
  t('kết quả nằm trong ngân sách', mid.src.length <= cfg.MAX_ENCODED_CHARS, `${mid.src.length}`)

  calls.length = 0
  const hard = encodeWithinBudget(fake(1), 100, 100, cfg)
  t('hết nấc chất lượng thì thu nhỏ kích thước', hard && hard.w < 100, `${hard?.w}x${hard?.h} q=${hard?.quality}`)
  t('thu nhỏ theo đúng DIMENSION_STEP',
    calls.some((c) => c.w === Math.floor(100 * cfg.DIMENSION_STEP)))

  const impossible = encodeWithinBudget(fake(100), 100, 100, cfg)
  t('không nén vừa ở cỡ nhỏ nhất → null, không gửi ảnh mờ', impossible === null)
  t('không bao giờ thu dưới MIN_DIMENSION_PX',
    calls.every((c) => Math.max(c.w, c.h) >= cfg.MIN_DIMENSION_PX))

  t('scaleToFit trả số nguyên ≥ 1', (() => {
    const s = scaleToFit(10000, 3, 1600)
    return Number.isInteger(s.w) && Number.isInteger(s.h) && s.h >= 1 && s.w === 1600
  })())
}

// ── 10. Hàng đợi vẽ giữ thứ tự ───────────────────────────────────────────────
{
  const order = []
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  // "Ảnh" giải mã chậm tới trước, "nét vẽ" đồng bộ tới sau: nét phải vẽ SAU ảnh.
  enqueueRender(async () => { await sleep(30); order.push('ảnh') })
  enqueueRender(() => order.push('nét 1'))
  enqueueRender(async () => { throw new Error('ảnh hỏng (cố ý)') })
  await enqueueRender(() => order.push('nét 2'))
  t('ảnh chậm vẫn vẽ trước nét tới sau', order.join(' → ') === 'ảnh → nét 1 → nét 2', order.join(' → '))
  t('một ảnh hỏng không làm gãy hàng đợi', order.includes('nét 2'))
}

console.log(fails === 0 ? '\nAll image-upload tests passed' : `\n${fails} test(s) FAILED`)
process.exit(fails === 0 ? 0 : 1)
