import { useWaterfallStore } from '../../store/waterfallStore.js'
import { WATERFALL_UI as UI } from '../../waterfall/config.js'
import { SOCKET_STATUS } from '../../waterfall/valveSocket.js'
import WaterfallToolRow from './WaterfallToolRow.jsx'
import { useUndoShortcuts } from './useUndoShortcuts.js'
import { dockActionBtnStyle, dockBarStyle, dockScrollStyle, dockToastStyle, HIDE_SCROLLBAR_CSS } from './panelStyles.js'

/**
 * Dock đáy cho ĐIỆN THOẠI — tất cả thao tác trên đúng MỘT hàng sát mép dưới.
 *
 * Vì sao gộp công cụ và hành động vào một hàng: màn hình điện thoại cao chứ
 * không rộng, mà hoạ tiết màn nước cũng cao (160 cột × 256 hàng). Mỗi hàng
 * giao diện xếp chồng ở đáy là một lát cắt ngang mất khỏi bảng vẽ. Bố cục cũ
 * có ba tầng — trạng thái, nút gửi cỡ lớn, thanh công cụ hai dòng — ngốn gần
 * một phần ba màn hình.
 *
 * Hai quyết định giữ nó ở một hàng mà không mất công cụ nào:
 *  - Phần công cụ CUỘN NGANG. Thêm công cụ mới không phải đánh đổi chỗ vẽ, và
 *    nút không phải co xuống dưới ngưỡng chạm như hồi thanh hai dòng.
 *  - Hai nút hành động (cài đặt, gửi) GHIM bên phải, nằm ngoài vùng cuộn. Đây
 *    là hai thứ không được phép "cuộn đi mất": gửi là mục đích cuối cùng, còn
 *    cài đặt là đường duy nhất vào phần kết nối.
 *
 * Toàn bộ phần cài đặt ẩn sau đúng một biểu tượng ⚙ — bảng điều khiển chỉ hiện
 * khi được gọi, dưới dạng bottom sheet đè lên trên, rồi biến mất.
 */
export default function WaterfallDock() {
  useUndoShortcuts()

  const {
    transportMode, bridgeOnline, status, sending, sendError,
    sendPattern, togglePanel, clearSendError,
  } = useWaterfallStore()

  const connected = transportMode === 'bridge'
    ? bridgeOnline
    : status === SOCKET_STATUS.CONNECTED
  const canSend = connected && !sending

  return (
    <div style={dockBarStyle}>
      <style>{HIDE_SCROLLBAR_CSS}</style>

      {/* Lỗi gửi nổi LÊN TRÊN dock chứ không chen thêm một hàng vào trong:
          hàng đó chỉ có mặt lúc hỏng, mà thêm hàng là canvas phải chừa chỗ
          vĩnh viễn cho một thứ hầu như không bao giờ hiện. */}
      {sendError && (
        <button onClick={clearSendError} style={dockToastStyle}>
          {sendError} <span style={{ opacity: 0.8 }}>— chạm để ẩn</span>
        </button>
      )}

      <div className="wf-dock-scroll" style={dockScrollStyle}>
        <WaterfallToolRow isMobile />
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        flexShrink: 0, paddingLeft: 6,
        borderLeft: '1px solid rgba(0,0,0,0.08)',
      }}>
        <button
          onClick={togglePanel}
          title="Cài đặt màn nước"
          aria-label="Cài đặt màn nước"
          style={dockActionBtnStyle({ variant: 'ghost' })}
        >⚙</button>

        {/* Nút gửi thu về đúng một biểu tượng. Trạng thái kết nối đọc bằng
            chấm màu ở góc thay vì một dòng chữ riêng — cùng một thông tin,
            không tốn hàng nào. */}
        <button
          onClick={sendPattern}
          disabled={!canSend}
          title={connected ? 'Gửi hoạ tiết tới màn nước' : 'Chưa kết nối thiết bị — mở ⚙ để kết nối'}
          aria-label="Gửi tới màn nước"
          style={dockActionBtnStyle({
            variant: 'primary',
            disabled: !canSend,
          })}
        >
          {sending ? '⏳' : '🌊'}
          <span style={{
            position: 'absolute', top: 4, right: 4,
            width: 8, height: 8, borderRadius: '50%',
            background: connected ? '#3ED598' : '#9aa0a6',
            border: '1.5px solid #1a1a1a',
          }} />
        </button>
      </div>
    </div>
  )
}
