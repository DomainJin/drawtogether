import { WATERFALL_UI as UI } from '../../waterfall/config.js'
import WaterfallToolRow from './WaterfallToolRow.jsx'
import { useUndoShortcuts } from './useUndoShortcuts.js'

/**
 * Thanh công cụ nổi cho DESKTOP — pill giữa mép dưới, cùng kiểu với Toolbar
 * của whiteboard để người dùng không phải học lại.
 *
 * Trên điện thoại dùng WaterfallDock thay cho cái này: pill nổi giữa màn chiếm
 * chỗ vẽ theo cả hai chiều, còn dock thì dính sát đáy trên đúng một hàng.
 *
 * @param {boolean} panelOpen canvas bị panel chiếm bề ngang, dịch tâm pill
 */
export default function WaterfallTools({ panelOpen }) {
  useUndoShortcuts()

  const reservedRight = panelOpen ? UI.PANEL_WIDTH_PX + UI.PANEL_GAP_PX : 0

  return (
    <div style={{
      position: 'fixed',
      left: `calc(50% - ${reservedRight / 2}px)`,
      transform: 'translateX(-50%)',
      bottom: 24,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexWrap: 'wrap', rowGap: 6, gap: UI.TOOLBAR_GROUP_GAP_PX,
      background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16,
      padding: '8px 12px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
      zIndex: 110, maxWidth: '92vw',
    }}>
      <WaterfallToolRow isMobile={false} />
    </div>
  )
}
