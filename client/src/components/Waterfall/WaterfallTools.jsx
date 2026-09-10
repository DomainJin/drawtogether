import { useEffect } from 'react'
import { useWaterfallStore } from '../../store/waterfallStore.js'
import { WATERFALL_CONFIG as CFG, WATERFALL_UI as UI } from '../../waterfall/config.js'

const TOOLS = [
  { id: 'pen', label: '✏️', title: 'Bút vẽ' },
  { id: 'eraser', label: '⬜', title: 'Tẩy' },
]

/**
 * Thanh công cụ cho lưới van — cùng kiểu pill nổi như Toolbar của whiteboard
 * để người dùng không phải học lại. Chỉ có bút/tẩy và bề dày nét: lưới van là
 * nhị phân (van mở hoặc đóng) nên không có màu, và mọi thứ khác đã nằm ở
 * WaterfallPanel.
 *
 * Thanh này PHẢI xuống dòng được. Trên điện thoại tổng bề ngang các nút vượt
 * 92vw, mà flex mặc định không wrap thì phần thừa tràn ra ngoài mép phải và
 * biến mất — Undo, Lưới, Xoá hết coi như không tồn tại. Nút nhỏ lại + bỏ vạch
 * ngăn + cho wrap giữ được đủ công cụ trong tầm ngón tay.
 *
 * @param {boolean} isMobile  đặt trên bottom sheet thay vì sát đáy màn hình
 * @param {boolean} panelOpen desktop: canvas bị panel chiếm bề ngang, dịch tâm
 */
export default function WaterfallTools({ isMobile, panelOpen }) {
  const {
    brushTool, setBrushTool, brushPx, setBrushPx, clearGrid, grid,
    showGridPreview, toggleGridPreview, undoStroke, redoStroke, strokes, redoStack,
  } = useWaterfallStore()

  // Ctrl+Z / Ctrl+Shift+Z: bàn phím là đường undo tự nhiên trên desktop, và
  // component này chỉ mount khi đang ở chế độ màn nước nên không đụng phím tắt
  // của whiteboard.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      if (k !== 'z' && k !== 'y') return
      if (e.target.matches?.('input,textarea')) return
      e.preventDefault()
      if (k === 'y' || e.shiftKey) redoStroke()
      else undoStroke()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undoStroke, redoStroke])

  const hasPattern = grid.some((row) => row.some((v) => v))

  const handleClearAll = () => {
    if (hasPattern && window.confirm('Xoá toàn bộ hoạ tiết?')) clearGrid()
  }

  const reservedRight = !isMobile && panelOpen ? UI.PANEL_WIDTH_PX + UI.PANEL_GAP_PX : 0
  const btn = isMobile ? UI.TOOLBAR_BTN_MOBILE_PX : UI.TOOLBAR_BTN_PX
  const gap = UI.TOOLBAR_GROUP_GAP_PX

  /** Nút vuông cạnh `btn`, không co lại khi thanh chật — co thì chạm hụt. */
  const square = (extra = {}) => ({
    width: btn, height: btn, borderRadius: 10, border: 'none',
    flexShrink: 0, padding: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: isMobile ? 15 : 17, cursor: 'pointer',
    ...extra,
  })

  const groupStyle = { display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }

  // Vạch ngăn chỉ có trên desktop: khi wrap nó có thể rơi xuống đầu dòng mới.
  const divider = isMobile ? null
    : <div style={{ width: 1, height: 26, background: 'rgba(0,0,0,0.1)', flexShrink: 0 }} />

  return (
    <div style={{
      position: 'fixed',
      left: `calc(50% - ${reservedRight / 2}px)`,
      transform: 'translateX(-50%)',
      bottom: isMobile ? UI.SHEET_COLLAPSED_PX + 12 : 24,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexWrap: 'wrap', rowGap: 6, gap,
      background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16,
      padding: isMobile ? '8px 10px' : '8px 12px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
      zIndex: 110, maxWidth: '92vw',
    }}>
      <div style={groupStyle}>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            title={t.title}
            onClick={() => setBrushTool(t.id)}
            style={square({
              background: brushTool === t.id ? '#1a1a1a' : 'transparent',
              color: brushTool === t.id ? '#fff' : '#1a1a1a',
            })}
          >{t.label}</button>
        ))}
      </div>

      {divider}

      {/* Chấm tròn to dần — thấy ngay bề dày nét, không phải đọc số. */}
      <div style={groupStyle}>
        {CFG.BRUSH_SIZES_PX.map((px) => (
          <button
            key={px}
            title={`Nét ${px}px`}
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
    </div>
  )
}
