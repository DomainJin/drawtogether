import { useShallow } from 'zustand/react/shallow'
import { useWaterfallStore } from '../../store/waterfallStore.js'
import { WATERFALL_CONFIG as CFG, WATERFALL_UI as UI } from '../../waterfall/config.js'
import { brushDotPx } from '../../waterfall/brushPreview.js'

/** Công cụ vẽ lưới van: bút, tẩy, tô loang, bề dày nét, undo/redo, xem lưới,
 *  xoá hết. Lưới van là nhị phân (van mở hoặc đóng) nên không có màu; mọi thứ
 *  còn lại đã nằm ở WaterfallPanel.
 *
 *  Chỉ là các NÚT, không tự định vị mình. Khung bọc do nơi dùng quyết định:
 *  pill nổi giữa màn trên desktop (WaterfallTools), hàng cuộn ngang sát đáy
 *  trên điện thoại (WaterfallDock). Nhờ vậy hai nơi không bao giờ lệch nhau
 *  danh sách công cụ.
 *
 *  @param {boolean} isMobile nút to hơn, bỏ vạch ngăn và bỏ chữ trên nhãn
 */
export default function WaterfallToolRow({ isMobile }) {
  const {
    brushTool, setBrushTool, brushPx, setBrushPx, clearGrid, hasPattern,
    showGridPreview, toggleGridPreview, undoStroke, redoStroke, strokeCount, redoCount,
  } = useWaterfallStore(useShallow((s) => ({
    brushTool: s.brushTool, setBrushTool: s.setBrushTool,
    brushPx: s.brushPx, setBrushPx: s.setBrushPx, clearGrid: s.clearGrid,
    // Chỉ lấy giá trị suy ra (boolean/số): lấy thẳng grid/strokes thì mỗi
    // điểm nét vẽ mới là thanh công cụ render lại.
    hasPattern: s.grid.some((row) => row.some((v) => v)),
    showGridPreview: s.showGridPreview, toggleGridPreview: s.toggleGridPreview,
    undoStroke: s.undoStroke, redoStroke: s.redoStroke,
    strokeCount: s.strokes.length, redoCount: s.redoStack.length,
  })))


  // Xoá ngay, không hỏi: window.confirm trên iPad đẩy Safari ra khỏi chế độ
  // toàn màn hình vẽ mỗi lần bấm.
  const handleClearAll = () => {
    if (hasPattern) clearGrid()
  }

  const btn = isMobile ? UI.TOOLBAR_BTN_MOBILE_PX : UI.TOOLBAR_BTN_PX

  /** Nút vuông cạnh `btn`, không co lại khi thanh chật — co thì chạm hụt. */
  const square = (extra = {}) => ({
    width: btn, height: btn, borderRadius: 10, border: 'none',
    flexShrink: 0, padding: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: isMobile ? 17 : 17, cursor: 'pointer',
    ...extra,
  })

  const groupStyle = { display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }

  // Vạch ngăn chỉ có trên desktop: trong dock cuộn ngang nó chỉ tốn bề ngang
  // mà không chia nhóm rõ hơn khoảng hở.
  const divider = isMobile ? null
    : <div style={{ width: 1, height: 26, background: 'rgba(0,0,0,0.1)', flexShrink: 0 }} />

  const toolButton = (t) => (
    <button
      key={t.id}
      title={t.title}
      aria-label={t.title}
      aria-pressed={brushTool === t.id}
      onClick={() => setBrushTool(t.id)}
      style={square({
        background: brushTool === t.id ? '#1a1a1a' : 'transparent',
        color: brushTool === t.id ? '#fff' : '#1a1a1a',
      })}
    >{t.label}</button>
  )

  return (
    <>
      <div style={groupStyle}>
        {TOOLS.map(toolButton)}
      </div>

      {divider}

      <div style={groupStyle}>
        {toolButton(HAND_TOOL)}
      </div>

      {divider}

      {/* Chấm tròn to dần — thấy ngay bề dày nét, không phải đọc số. Tô loang
          không dùng bề dày nét, nên mờ đi để khỏi bấm nhầm vô ích. */}
      <div style={{ ...groupStyle, opacity: brushTool === 'fill' || brushTool === 'hand' ? 0.4 : 1 }}>
        {CFG.BRUSH_SIZES_PX.map((px) => (
          <button
            key={px}
            title={`Nét ${px}px`}
            aria-label={`Nét ${px}px`}
            onClick={() => setBrushPx(px)}
            style={square({
              background: brushPx === px ? 'rgba(55,138,221,0.14)' : 'transparent',
            })}
          >
            <span style={{
              display: 'block',
              width: brushDotPx(px, btn), height: brushDotPx(px, btn),
              borderRadius: '50%',
              background: brushPx === px ? '#378ADD' : '#8a949e',
            }} />
          </button>
        ))}
      </div>

      {divider}

      {/* Undo/Redo: trên điện thoại không có Ctrl+Z, mà vẽ tay thì trượt một
          nhát là hỏng cả mảng — thiếu cặp nút này phải xoá hết vẽ lại. */}
      <div style={groupStyle}>
        <button
          title="Bỏ nét vừa vẽ (Ctrl+Z)"
          aria-label="Bỏ nét vừa vẽ"
          onClick={undoStroke}
          disabled={strokeCount === 0}
          style={square({
            background: 'transparent',
            color: strokeCount ? '#1a1a1a' : '#c4c4c4',
            cursor: strokeCount ? 'pointer' : 'not-allowed',
            fontSize: 18,
          })}
        >↶</button>
        <button
          title="Vẽ lại nét vừa bỏ (Ctrl+Shift+Z)"
          aria-label="Vẽ lại nét vừa bỏ"
          onClick={redoStroke}
          disabled={redoCount === 0}
          style={square({
            background: 'transparent',
            color: redoCount ? '#1a1a1a' : '#c4c4c4',
            cursor: redoCount ? 'pointer' : 'not-allowed',
            fontSize: 18,
          })}
        >↷</button>
      </div>

      {divider}

      <div style={groupStyle}>
        {/* Nét hiển thị là vector mượt, còn thứ gửi đi là lưới 160x64. Nút này
            cho xem đúng lưới đó — giữ WYSIWYG dưới dạng kiểm tra chủ động. */}
        <button
          title={showGridPreview ? 'Quay lại nét mượt' : 'Xem đúng lưới van sẽ gửi'}
          aria-label="Xem đúng lưới van sẽ gửi"
          onClick={toggleGridPreview}
          style={square({
            width: isMobile ? btn : 'auto',
            padding: isMobile ? 0 : '0 12px',
            background: showGridPreview ? '#1a1a1a' : 'transparent',
            color: showGridPreview ? '#fff' : '#1a1a1a',
            fontSize: isMobile ? 16 : 14,
            fontWeight: 600, whiteSpace: 'nowrap', gap: 6,
          })}
        >{isMobile ? '▦' : '▦ Lưới'}</button>

        {/* Xoá sạch một nhát, thay vì phải gôm từng chỗ bằng tẩy. */}
        <button
          title="Xoá toàn bộ hoạ tiết"
          aria-label="Xoá toàn bộ hoạ tiết"
          onClick={handleClearAll}
          disabled={!hasPattern}
          style={square({
            width: isMobile ? btn : 'auto',
            padding: isMobile ? 0 : '0 12px',
            background: hasPattern ? 'rgba(226,75,74,0.1)' : 'transparent',
            color: hasPattern ? '#E24B4A' : '#c4c4c4',
            cursor: hasPattern ? 'pointer' : 'not-allowed',
            fontSize: isMobile ? 16 : 15,
            fontWeight: 600, whiteSpace: 'nowrap', gap: 6,
          })}
        >{isMobile ? '🗑' : '🗑 Xoá hết'}</button>
      </div>
    </>
  )
}

/** Tô loang đứng cùng nhóm bút/tẩy vì nó cũng là "cái đang cầm trên tay": một
 *  lúc chỉ chọn được một trong ba. Bàn tay cũng loại trừ với ba cái này nhưng
 *  đứng nhóm RIÊNG: bốn nút một nhóm thì màn 320px không còn thấy trọn nhóm
 *  vẽ mà chưa cần cuộn (xem dock-fit.test.mjs). */
const TOOLS = [
  { id: 'pen', label: '✏️', title: 'Bút vẽ' },
  { id: 'eraser', label: '⬜', title: 'Tẩy' },
  { id: 'fill', label: '🪣', title: 'Tô loang — chạm vào vùng trống để đổ đầy, chạm vào mảng đã vẽ để xoá cả mảng' },
]

const HAND_TOOL = { id: 'hand', label: '✋', title: 'Bàn tay — kéo một ngón để cuộn, vuốt nhanh để lướt' }
