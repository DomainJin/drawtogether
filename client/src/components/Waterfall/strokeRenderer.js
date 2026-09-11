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

const PEN_COLOR = '#1a1a1a'

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
 *  Không làm mượt gì thêm: vùng tô sinh ra từ lưới van chứ không từ đường đi
 *  của ngón tay, nên vẽ đúng biên ô là cách trung thực nhất — thấy sao thì màn
 *  nước chạy vậy. Các dải kề nhau vẽ trong MỘT path rồi fill một lần, nếu
 *  không sẽ lộ chỉ trắng ở mối nối do khử răng cưa.
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

  const cellW = width / cols
  const cellH = height / rows

  if (stroke.value === 0) ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = PEN_COLOR
  ctx.beginPath()
  for (const { row, c0, c1 } of runs) {
    ctx.rect(c0 * cellW, row * cellH, (c1 - c0 + 1) * cellW, cellH)
  }
  ctx.fill()
}
