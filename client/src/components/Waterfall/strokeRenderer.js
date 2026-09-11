/** Vẽ nét vector cho lưới van — mượt như bút whiteboard.
 *
 *  Đây CHỈ là lớp hiển thị. Thứ gửi tới màn nước vẫn là `grid`, được cập nhật
 *  song song lúc vẽ. Tách ra vì lưới 160x64 có ô cao gấp ~3,5 lần bề rộng: bề
 *  dày nét theo chiều dọc chỉ nhảy được theo bậc một hàng (~9px) trong khi
 *  chiều ngang nhảy theo bậc một cột (~2,6px), nên vẽ thẳng từ lưới thì nét
 *  ngang luôn dày hơn nét dọc, không thuật toán bút nào chữa được.
 *
 *  Làm trơn bằng đường bậc hai qua trung điểm — cùng cách renderStroke() của
 *  whiteboard dùng, để hai chế độ vẽ cho ra nét giống nhau.
 *
 *  Toạ độ điểm chuẩn hoá 0..1 nên đổi kích thước canvas không phải tính lại.
 */

import { WATERFALL_CONFIG as CFG } from '../../waterfall/config.js'
import { runsToShapes } from '../../waterfall/runGeometry.js'
import { floodFillPixels } from '../../waterfall/pixelFill.js'
import { runsCellCount } from '../../waterfall/fill.js'
import { addShapesToPath } from './runsPath.js'

const PEN_COLOR = '#1a1a1a'
const PEN_RGB = [26, 26, 26]

/** Trần số pixel cho một lần tô ở không gian màn hình.
 *
 *  Hoạ tiết ở nhịp rơi chậm nhất cao tới ~6800px CSS; nhân với bề ngang là đệm
 *  RGBA vài chục MB cho MỖI lần tô, mà dựng lại canvas (đổi cỡ, undo) thì mọi
 *  nét tô cùng chạy lại. Vượt trần thì quay về vẽ từ lưới: hơi hụt ở biên,
 *  nhưng không làm nghẽn máy. */
const MAX_FILL_PIXELS = 12e6

/** Vùng tô trên MÀN được phép rộng hơn vùng tô trên LƯỚI bao nhiêu lần.
 *
 *  Hai bên lệch nhau là chuyện bình thường và có chủ ý: lưới làm tròn dấu chân
 *  nét ra ngoài cả một ô, nên vùng tô trên lưới dừng sớm hơn, còn trên màn thì
 *  ăn sát nét. Phần chênh là một vành mỏng quanh chu vi, thường dưới một phần
 *  ba diện tích.
 *
 *  Nhưng có một trường hợp lệch tai hại: hình vẽ hở một khe NHỎ HƠN một ô.
 *  Trên lưới, dấu chân béo của nét bịt kín khe đó nên mực nằm yên trong hình;
 *  trên màn, đường vector mảnh hơn nên mực chảy ra và nhuộm đen cả bản vẽ —
 *  trong khi thứ gửi đi vẫn chỉ là phần trong hình. Phình quá ngưỡng này thì
 *  coi là đã thoát ra ngoài: bỏ, vẽ lại từ lưới. Thà hụt một vành mỏng còn hơn
 *  cho màn hình nói dối hẳn.
 *
 *  Ngưỡng chỉ bắt được khi hình NHỎ so với bản vẽ — mà đó đúng là lúc tràn gây
 *  hại nhất. Hình chiếm gần hết bản vẽ thì tràn cũng chẳng rộng hơn nó bao
 *  nhiêu, nên nhìn cũng không khác mấy.
 */
const MAX_FILL_GROWTH = 4

/** Vùng tô nhỏ thì vành quanh chu vi chiếm tỉ lệ lớn, nhân ba vẫn có thể hụt.
 *  Cộng thêm một khoản tuyệt đối — nhỏ tới mức không cứu nổi một vụ tràn thật. */
const FILL_GROWTH_SLACK_PX = 20000

/** Vẽ một nét lên ctx. Canvas nhận nét phải TRONG SUỐT: tẩy dùng
 *  destination-out, nếu nền đã tô màu thì nó khoét thủng luôn cả nền. */
export function drawStroke(ctx, stroke, width, height) {
  const pts = stroke.points
  if (stroke.tool !== 'fill' && !pts?.length) return

  ctx.save()

  if (stroke.tool === 'fill') {
    drawFill(ctx, stroke, width, height)
    ctx.restore()
    return
  }

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = stroke.px
  ctx.strokeStyle = PEN_COLOR
  ctx.fillStyle = PEN_COLOR
  if (stroke.tool === 'eraser') ctx.globalCompositeOperation = 'destination-out'

  const x = (p) => p.x * width
  const y = (p) => p.y * height

  if (pts.length === 1) {
    // Chạm một cái rồi nhấc tay: một chấm tròn, không phải không có gì.
    ctx.beginPath()
    ctx.arc(x(pts[0]), y(pts[0]), stroke.px / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }

  ctx.beginPath()
  ctx.moveTo(x(pts[0]), y(pts[0]))
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (x(pts[i]) + x(pts[i + 1])) / 2
    const my = (y(pts[i]) + y(pts[i + 1])) / 2
    ctx.quadraticCurveTo(x(pts[i]), y(pts[i]), mx, my)
  }
  ctx.lineTo(x(pts[pts.length - 1]), y(pts[pts.length - 1]))
  ctx.stroke()
  ctx.restore()
}

/**
 * Giữ hai canvas phụ để một nét đang vẽ không phải vẽ lại toàn bộ nét cũ:
 *  - `committed`: mọi nét đã hoàn tất, chỉ đụng tới khi có nét mới xong.
 *  - `work`: bản sao committed cộng nét đang vẽ, dựng lại mỗi khung hình.
 *
 * Cần `work` riêng vì nét tẩy đang vẽ phải khoét vào committed rồi mới đặt
 * lên nền trắng — khoét thẳng trên canvas chính sẽ thủng cả nền.
 */
export function createStrokeRenderer() {
  let committed = null
  let work = null
  let committedCount = 0

  function ensure(width, height) {
    if (committed && committed.width === width && committed.height === height) return false
    committed = document.createElement('canvas')
    work = document.createElement('canvas')
    committed.width = work.width = width
    committed.height = work.height = height
    committedCount = 0
    return true // kích thước đổi -> caller phải dựng lại từ đầu
  }

  return function render(ctx, { strokes, width, height, background, activeIndex }) {
    const resized = ensure(width, height)

    // Số nét đã xong = tất cả trừ nét đang vẽ.
    const finished = activeIndex === null ? strokes.length : activeIndex

    // Vẽ lại từ đầu khi canvas đổi cỡ, hoặc khi nét bị bớt đi (xoá hết/undo).
    if (resized || finished < committedCount) {
      const c = committed.getContext('2d')
      c.clearRect(0, 0, width, height)
      committedCount = 0
    }
    // Nét vừa hoàn tất thì nhập vào committed, không vẽ lại những nét trước.
    if (finished > committedCount) {
      const c = committed.getContext('2d')
      for (let i = committedCount; i < finished; i++) drawStroke(c, strokes[i], width, height)
      committedCount = finished
    }

    const w = work.getContext('2d')
    w.clearRect(0, 0, width, height)
    w.drawImage(committed, 0, 0)
    if (activeIndex !== null && strokes[activeIndex]) {
      drawStroke(w, strokes[activeIndex], width, height)
    }

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = background
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(work, 0, 0)
  }
}

/** Vùng tô loang, vẽ từ chính các DẢI đã đóng dấu lên lưới.
 *
 *  Vẽ mỗi hàng thành một hình chữ nhật trần là ra RĂNG CƯA to đúng bằng chiều
 *  cao một hàng. Trên lưới 160 cột × vài trăm hàng, ô cao gấp mấy lần bề rộng,
 *  mà biên một vùng tô thì hiếm khi thẳng đứng — biên hơi xiên là mỗi hàng lệch
 *  ngang vài cột, thành bậc thang nhìn rõ mồn một bên cạnh nét bút mượt.
 *
 *  Nên dùng chung đúng bộ hình học với chế độ xem "Lưới": thanh bo góc cho mỗi
 *  dải, cộng hình thang nối tâm hàng này sang tâm hàng kia để vạt góc vuông
 *  thành cạnh dốc. Xem runGeometry.js. Dùng chung nghĩa là chỉnh độ mượt một
 *  lần thì cả hai chỗ cùng đổi, không còn cảnh mượt một đằng răng cưa một nẻo.
 *
 *  Tô về 0 nghĩa là xoá một mảng đã vẽ — dùng destination-out như tẩy, để nó
 *  khoét vào nét cũ thay vì phủ một mảng trắng lên trên.
 */
function drawFill(ctx, stroke, width, height) {
  const runs = stroke.runs
  if (!runs?.length) return
  const rows = stroke.gridRows
  const cols = stroke.gridCols
  if (!rows || !cols) return

  // Ưu tiên tô ở độ phân giải MÀN HÌNH — ăn sát đúng đường vector đang nhìn
  // thấy, không chừa viền trắng. Chỉ khi không làm được mới vẽ từ lưới.
  if (fillAtScreenResolution(ctx, stroke)) return

  const shapes = runsToShapes(runs, {
    cellW: width / cols,
    cellH: height / rows,
    rowOverlap: CFG.PREVIEW_ROW_OVERLAP,
    cornerRound: CFG.PREVIEW_CORNER_ROUND,
    connectGapCells: CFG.PREVIEW_CONNECT_GAP_CELLS,
  })

  if (stroke.value === 0) ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = PEN_COLOR
  // Tất cả trong MỘT path rồi fill một lần: fill từng hình thì mối nối giữa
  // thanh và hình thang lộ chỉ trắng do khử răng cưa.
  ctx.beginPath()
  addShapesToPath(ctx, shapes)
  ctx.fill()
}

/**
 * Tô loang thẳng trên pixel của canvas đệm.
 *
 * Canvas đệm không có transform và nằm ở đúng hệ toạ độ CSS, nên điểm chạm đã
 * chuẩn hoá 0..1 quy ra pixel chỉ là một phép nhân.
 *
 * Trả về false khi không áp dụng được — canvas quá lớn, hoặc pixel mầm không
 * khớp trạng thái mà lưới đã tính (chạm đúng vào rìa nét chẳng hạn). Khi đó
 * caller vẽ từ lưới, nên không bao giờ có chuyện bấm tô mà không thấy gì.
 *
 * @returns {boolean} đã tô xong hay chưa
 */
function fillAtScreenResolution(ctx, stroke) {
  const point = stroke.point
  if (!point) return false

  const canvas = ctx.canvas
  const w = canvas.width
  const h = canvas.height
  if (!w || !h || w * h > MAX_FILL_PIXELS) return false

  // Trần chống tràn, suy từ chính vùng tô trên lưới của nét này.
  const gridAreaPx = runsCellCount(stroke.runs)
    * (w / stroke.gridCols) * (h / stroke.gridRows)
  const maxPixels = gridAreaPx * MAX_FILL_GROWTH + FILL_GROWTH_SLACK_PX

  const img = ctx.getImageData(0, 0, w, h)
  const changed = floodFillPixels(img.data, w, h, point.x * w, point.y * h, {
    solid: stroke.value !== 0,
    color: PEN_RGB,
    maxPixels,
  })
  if (changed < 0) return false

  ctx.putImageData(img, 0, 0)
  return true
}
