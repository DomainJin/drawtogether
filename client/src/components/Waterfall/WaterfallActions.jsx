import { useShallow } from 'zustand/react/shallow'
import { useWaterfallStore } from '../../store/waterfallStore.js'
import { SOCKET_STATUS } from '../../waterfall/valveSocket.js'
import { PLAY_MODE_META, PLAY_MODES, playProgressLabel } from '../../waterfall/playback.js'
import { dockActionBtnStyle, dockModeBtnStyle, dockToastStyle } from './panelStyles.js'
import { useFocusMode } from './useFocusMode.js'
import { HOME_SCREEN_STEPS } from '../../waterfall/fullscreen.js'

/**
 * Cụm nút hành động: [⛶ toàn màn hình] ⚙ cài đặt · chế độ chạy · 🌊 gửi.
 *
 * Dùng chung cho dock điện thoại và thanh công cụ nổi trên iPad/desktop, để
 * hai nơi không lệch nhau về cách gửi, cách dừng, cách báo lỗi.
 *
 * @param {boolean} showFocus hiện nút ⛶. Chỉ bật ở thanh nổi: điện thoại không
 *   có Fullscreen API cho trang, và dock đã sát mép — thêm nút là mất chỗ của
 *   nút gửi trên màn 320px (xem dock-fit.test.mjs).
 * @param {boolean} compact dock điện thoại: chữ "Gửi" nằm DƯỚI icon trong đúng
 *   ô vuông cũ thay vì kéo nút rộng ra — cụm ghim phải không được phình
 *   (dock-fit.test.mjs). Thanh nổi iPad thì đủ chỗ cho "🌊 Gửi" nằm ngang.
 */
export default function WaterfallActions({ showFocus = false, compact = false }) {
  const {
    transportMode, bridgeOnline, status, sending, sendError,
    sendPattern, panelOpen, togglePanel, setPanelOpen, clearSendError,
    playMode, cyclePlayMode, playing, playDone, playTotal, stopPlayback,
  } = useWaterfallStore(useShallow((s) => ({
    transportMode: s.transportMode, bridgeOnline: s.bridgeOnline, status: s.status,
    sending: s.sending, sendError: s.sendError, sendPattern: s.sendPattern,
    panelOpen: s.panelOpen, togglePanel: s.togglePanel, setPanelOpen: s.setPanelOpen,
    clearSendError: s.clearSendError,
    playMode: s.playMode, cyclePlayMode: s.cyclePlayMode, playing: s.playing,
    playDone: s.playDone, playTotal: s.playTotal, stopPlayback: s.stopPlayback,
  })))
  const { focusMode, toggleFocusMode, homeScreenHint, dismissHint } = useFocusMode()

  const connected = transportMode === 'bridge'
    ? bridgeOnline
    : status === SOCKET_STATUS.CONNECTED
  const canSend = connected && !sending && !playing
  const mode = PLAY_MODE_META[playMode]
  const settingsShown = panelOpen && !focusMode

  // ⚙ chỉ ẩn/hiện bảng cài đặt. Đang toàn màn hình thì bảng bị giấu, nên bấm
  // ⚙ là thoát toàn màn hình rồi MỞ bảng — không bao giờ bấm mà không thấy gì.
  const onSettings = () => {
    if (focusMode) {
      toggleFocusMode()
      setPanelOpen(true)
      return
    }
    togglePanel()
  }

  return (
    <>
      {/* Lỗi gửi nổi LÊN TRÊN thanh chứ không chen thêm một hàng vào trong:
          hàng đó chỉ có mặt lúc hỏng, mà thêm hàng là canvas phải chừa chỗ
          vĩnh viễn cho một thứ hầu như không bao giờ hiện. */}
      {sendError && (
        <button onClick={clearSendError} style={dockToastStyle}>
          {sendError} <span style={{ opacity: 0.8 }}>— chạm để ẩn</span>
        </button>
      )}

      {showFocus && homeScreenHint && !sendError && (
        <button onClick={dismissHint} style={{ ...dockToastStyle, background: 'rgba(31,111,184,0.95)' }}>
          Đã ẩn giao diện. Muốn mất cả thanh Safari: {HOME_SCREEN_STEPS}.
          <span style={{ opacity: 0.8 }}> — chạm để ẩn</span>
        </button>
      )}

      {showFocus && (
        <button
          onClick={toggleFocusMode}
          title={focusMode ? 'Thoát toàn màn hình' : 'Toàn màn hình vẽ'}
          aria-label={focusMode ? 'Thoát toàn màn hình' : 'Toàn màn hình vẽ'}
          aria-pressed={focusMode}
          style={{
            ...dockActionBtnStyle({ variant: 'ghost' }),
            ...(focusMode ? activeGhost : null),
          }}
        >{focusMode ? '🗗' : '⛶'}</button>
      )}

      <button
        onClick={onSettings}
        title={settingsShown ? 'Ẩn cài đặt màn nước' : 'Hiện cài đặt màn nước'}
        aria-label="Cài đặt màn nước"
        aria-pressed={settingsShown}
        style={{
          ...dockActionBtnStyle({ variant: 'ghost' }),
          ...(settingsShown ? activeGhost : null),
        }}
      >⚙</button>

      {/* Chế độ chạy: một nút bấm xoay vòng 10× → 1× → ∞. Ba tab cạnh nhau
          như bên panel sẽ ăn mất chỗ của nút gửi trên màn hình hẹp, mà đây
          là thứ đổi thưa — nhìn thấy chế độ hiện tại là đủ. */}
      <button
        onClick={cyclePlayMode}
        disabled={playing}
        title={`Chế độ chạy: ${mode.label} — ${mode.hint}. Chạm để đổi.`}
        aria-label={`Chế độ chạy: ${mode.label}`}
        style={{
          ...dockModeBtnStyle(playMode !== PLAY_MODES.DEFAULT),
          opacity: playing ? 0.45 : 1,
          cursor: playing ? 'not-allowed' : 'pointer',
        }}
      >{mode.short}</button>

      {/* Nút gửi thu về đúng một biểu tượng. Trạng thái kết nối đọc bằng
          chấm màu ở góc thay vì một dòng chữ riêng — cùng một thông tin,
          không tốn hàng nào. Đang chạy thì chính nó là nút Dừng: chế độ lặp
          vô tận phải tắt được ngay tại chỗ vừa bật. */}
      <button
        onClick={playing ? () => stopPlayback() : sendPattern}
        disabled={!playing && !canSend}
        title={playing
          ? `Dừng — ${playProgressLabel(playDone, playTotal)}`
          : connected ? `Gửi hoạ tiết (${mode.hint.toLowerCase()})` : 'Chưa kết nối thiết bị — mở ⚙ để kết nối'}
        aria-label={playing ? 'Dừng chạy hoạ tiết' : 'Gửi tới màn nước'}
        style={{
          ...dockActionBtnStyle({ variant: 'primary', disabled: !playing && !canSend }),
          ...(compact ? sendCompactLayout : sendWideLayout),
        }}
      >
        <span style={{ fontSize: compact ? 16 : 18, lineHeight: 1 }}>
          {playing ? '⏹' : sending ? '⏳' : '🌊'}
        </span>
        <span style={compact ? sendCompactText : sendWideText}>
          {playing ? 'Dừng' : sending ? 'Đang gửi' : 'Gửi'}
        </span>
        <span style={{
          position: 'absolute', top: 4, right: 4,
          width: 8, height: 8, borderRadius: '50%',
          background: connected ? '#3ED598' : '#9aa0a6',
          border: '1.5px solid #1a1a1a',
        }} />
      </button>
    </>
  )
}

/** Nút gửi: dock xếp icon trên chữ trong ô vuông; thanh nổi xếp ngang. */
const sendCompactLayout = { flexDirection: 'column', gap: 1 }
const sendCompactText = { fontSize: 10, fontWeight: 700, lineHeight: 1 }
const sendWideLayout = { width: 'auto', minWidth: 88, gap: 6, paddingInline: 14 }
const sendWideText = { fontSize: 15, fontWeight: 700 }

/** Nút ghost đang bật (bảng đang hiện / đang toàn màn hình). */
const activeGhost = {
  borderColor: '#378ADD', background: 'rgba(55,138,221,0.12)', color: '#1F6FB8',
}
