import WaterfallToolRow from './WaterfallToolRow.jsx'
import WaterfallActions from './WaterfallActions.jsx'
import { useUndoShortcuts } from './useUndoShortcuts.js'
import { dockBarStyle, dockScrollStyle, HIDE_SCROLLBAR_CSS } from './panelStyles.js'

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

  return (
    <div style={dockBarStyle}>
      <style>{HIDE_SCROLLBAR_CSS}</style>

      <div className="wf-dock-scroll" style={dockScrollStyle}>
        <WaterfallToolRow isMobile />
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        flexShrink: 0, paddingLeft: 6,
        borderLeft: '1px solid rgba(0,0,0,0.08)',
      }}>
        <WaterfallActions compact />
      </div>
    </div>
  )
}
