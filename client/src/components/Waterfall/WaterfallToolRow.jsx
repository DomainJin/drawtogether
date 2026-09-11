import { useWaterfallStore } from '../../store/waterfallStore.js'
import { WATERFALL_CONFIG as CFG, WATERFALL_UI as UI } from '../../waterfall/config.js'

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
    brushTool, setBrushTool, brushPx, setBrushPx, clearGrid, grid,
    showGridPreview, toggleGridPreview, undoStroke, redoStroke, strokes, redoStack,
  } = useWaterfallStore()

  const hasPattern = grid.some((row) => row.some((v) => v))

  const handleClearAll = () => {
    if (hasPattern && window.confirm('Xoá toàn bộ hoạ tiết?')) clearGrid()
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

  return (
    <>
      <div style={groupStyle}>
        {TOOLS.map((t) => (
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
        ))}
      </div>

      {divider}

      {/* Chấm tròn to dần — thấy ngay bề dày nét, không phải đọc số. Tô loang
          không dùng bề dày nét, nên mờ đi để khỏi bấm nhầm vô ích. */}
      <div style={{ ...groupStyle, opacity: brushTool === 'fill' ? 0.4 : 1 }}>
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
              width: Math.min(px, btn - 12), height: Math.min(px, btn - 12),
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
          disabled={strokes.length === 0}
          style={square({
            background: 'transparent',
            color: strokes.length ? '#1a1a1a' : '#c4c4c4',
            cursor: strokes.length ? 'pointer' : 'not-allowed',
            fontSize: 18,
          })}
        >↶</button>
        <button
          title="Vẽ lại nét vừa bỏ (Ctrl+Shift+Z)"
          aria-label="Vẽ lại nét vừa bỏ"
          onClick={redoStroke}
          disabled={redoStack.length === 0}
          style={square({
            background: 'transparent',
            color: redoStack.length ? '#1a1a1a' : '#c4c4c4',
            cursor: redoStack.length ? 'pointer' : 'not-allowed',
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
 *  lúc chỉ chọn được một trong ba. */
const TOOLS = [
  { id: 'pen', label: '✏️', title: 'Bút vẽ' },
  { id: 'eraser', label: '⬜', title: 'Tẩy' },
  { id: 'fill', label: '🪣', title: 'Tô loang — chạm vào vùng trống để đổ đầy, chạm vào mảng đã vẽ để xoá cả mảng' },
]
