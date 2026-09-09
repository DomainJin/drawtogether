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
 * @param {boolean} isMobile  đặt trên bottom sheet thay vì sát đáy màn hình
 * @param {boolean} panelOpen desktop: canvas bị panel chiếm bề ngang, dịch tâm
 */
export default function WaterfallTools({ isMobile, panelOpen }) {
  const { brushTool, setBrushTool, brushPx, setBrushPx, clearGrid, grid } = useWaterfallStore()

  const hasPattern = grid.some((row) => row.some((v) => v))

  const handleClearAll = () => {
    // Hỏi lại vì không có undo — mất hoạ tiết là vẽ lại từ đầu.
    if (hasPattern && window.confirm('Xoá toàn bộ hoạ tiết?')) clearGrid()
  }

  const reservedRight = !isMobile && panelOpen ? UI.PANEL_WIDTH_PX + UI.PANEL_GAP_PX : 0

  return (
    <div style={{
      position: 'fixed',
      left: `calc(50% - ${reservedRight / 2}px)`,
      transform: 'translateX(-50%)',
      bottom: isMobile ? UI.SHEET_COLLAPSED_PX + 12 : 24,
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16,
      padding: '8px 12px', boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
      zIndex: 110, maxWidth: '92vw',
    }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            title={t.title}
            onClick={() => setBrushTool(t.id)}
            style={{
              width: 40, height: 40, borderRadius: 10, border: 'none',
              background: brushTool === t.id ? '#1a1a1a' : 'transparent',
              color: brushTool === t.id ? '#fff' : '#1a1a1a',
              cursor: 'pointer', fontSize: 17,
            }}
          >{t.label}</button>
        ))}
      </div>

      <div style={{ width: 1, height: 26, background: 'rgba(0,0,0,0.1)' }} />

      {/* Chấm tròn to dần — thấy ngay bề dày nét, không phải đọc số. */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {CFG.BRUSH_SIZES_PX.map((px) => (
          <button
            key={px}
            title={`Nét ${px}px`}
            onClick={() => setBrushPx(px)}
            style={{
              width: 40, height: 40, borderRadius: 10, border: 'none',
              background: brushPx === px ? 'rgba(55,138,221,0.14)' : 'transparent',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{
              display: 'block',
              width: Math.min(px, 24), height: Math.min(px, 24),
              borderRadius: '50%',
              background: brushPx === px ? '#378ADD' : '#8a949e',
            }} />
          </button>
        ))}
      </div>

      <div style={{ width: 1, height: 26, background: 'rgba(0,0,0,0.1)' }} />

      {/* Xoá sạch một nhát, thay vì phải gôm từng chỗ bằng tẩy. */}
      <button
        title="Xoá toàn bộ hoạ tiết"
        onClick={handleClearAll}
        disabled={!hasPattern}
        style={{
          height: 40, padding: '0 12px', borderRadius: 10, border: 'none',
          background: hasPattern ? 'rgba(226,75,74,0.1)' : 'transparent',
          color: hasPattern ? '#E24B4A' : '#c4c4c4',
          cursor: hasPattern ? 'pointer' : 'not-allowed',
          fontSize: 15, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >🗑 Xoá hết</button>
    </div>
  )
}
