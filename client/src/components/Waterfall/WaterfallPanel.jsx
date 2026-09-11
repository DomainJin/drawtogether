import { useWaterfallStore } from '../../store/waterfallStore.js'
import { WATERFALL_CONFIG as CFG } from '../../waterfall/config.js'
import { SOCKET_STATUS } from '../../waterfall/valveSocket.js'
import { useWaterfallPanel } from './useWaterfallPanel.js'
import { PLAY_MODE_ORDER, PLAY_MODE_META, playProgressLabel } from '../../waterfall/playback.js'
import {
  backBtnStyle, collapsedBarStyle, collapsedStatusRowStyle, dangerBtnStyle,
  dotStyle, grabberStyle, grabberWrapStyle, inputStyle, modeTabStyle,
  panelStyle, primaryBtnStyle, rangeStyle, secondaryBtnStyle, segmentRowStyle,
  sendRowStyle, sheetBodyStyle,
} from './panelStyles.js'

const STATUS_LABEL = {
  [SOCKET_STATUS.DISCONNECTED]: 'Chưa kết nối',
  [SOCKET_STATUS.CONNECTING]: 'Đang kết nối...',
  [SOCKET_STATUS.CONNECTED]: 'Đã kết nối',
  [SOCKET_STATUS.ERROR]: 'Lỗi kết nối',
}

const STATUS_COLOR = {
  [SOCKET_STATUS.DISCONNECTED]: '#999',
  [SOCKET_STATUS.CONNECTING]: '#EF9F27',
  [SOCKET_STATUS.CONNECTED]: '#1D9E75',
  [SOCKET_STATUS.ERROR]: '#E24B4A',
}

export default function WaterfallPanel({ onExit }) {
  const {
    transportMode, setTransportMode, bridgeOnline,
    ip, wsPort, status, error, valveCount, valveBytes,
    setIp, setWsPort, connect, disconnect,
    rowCount, rowIntervalMs, setRowCount, setRowIntervalMs,
    clearGrid, allOff, sendPattern, sending, sendError, lastSentAt,
    cols,
    playMode, setPlayMode, playing, playDone, playTotal, stopPlayback,
  } = useWaterfallStore()

  const { isMobile, expanded, togglePanel } = useWaterfallPanel()

  const isBridge = transportMode === 'bridge'
  const connected = isBridge ? bridgeOnline : status === SOCKET_STATUS.CONNECTED
  const deviceReady = isBridge ? (bridgeOnline && status === SOCKET_STATUS.CONNECTED) : connected
  const canSend = connected && !sending && !playing

  const handleConnectToggle = () => {
    if (status === SOCKET_STATUS.CONNECTED || status === SOCKET_STATUS.CONNECTING) disconnect()
    else connect()
  }

  // Trên điện thoại "thu gọn" nghĩa là BIẾN MẤT hẳn, không để lại thanh nào.
  // Mọi thao tác thường dùng đã nằm ở dock đáy (WaterfallDock); panel này chỉ
  // là phần cài đặt, mở bằng ⚙ rồi đóng lại, nên không có lý do chiếm chỗ vẽ
  // lúc không dùng tới.
  if (isMobile && !expanded) return null

  // Đang chạy thì chính nút đó thành nút Dừng: chế độ lặp vô tận không có điểm
  // kết thúc, phải luôn nhìn thấy đường tắt ở đúng chỗ vừa bấm để bật.
  const sendBtn = playing ? (
    <button
      onClick={() => stopPlayback()}
      style={{ ...dangerBtnStyle(isMobile), flex: 1 }}
    >
      ⏹ Dừng — {playProgressLabel(playDone, playTotal)}
    </button>
  ) : (
    <button
      onClick={sendPattern}
      disabled={!canSend}
      style={{
        ...primaryBtnStyle(isMobile), flex: 1,
        opacity: canSend ? 1 : 0.5, cursor: canSend ? 'pointer' : 'not-allowed',
      }}
    >
      {sending ? 'Đang gửi...' : `🌊 Gửi tới màn nước · ${PLAY_MODE_META[playMode].short}`}
    </button>
  )

  const playModeTabs = (
    <div style={segmentRowStyle}>
      {PLAY_MODE_ORDER.map((mode) => (
        <button
          key={mode}
          onClick={() => setPlayMode(mode)}
          disabled={playing}
          title={PLAY_MODE_META[mode].hint}
          style={{
            ...modeTabStyle(playMode === mode, isMobile),
            // Đổi chế độ giữa chừng không đổi được lượt đang chạy (số vòng đã
            // chốt lúc bấm Gửi), nên khoá lại thay vì để nó trông như có tác
            // dụng ngay.
            opacity: playing && playMode !== mode ? 0.45 : 1,
            cursor: playing ? 'not-allowed' : 'pointer',
          }}
        >
          {PLAY_MODE_META[mode].label} {PLAY_MODE_META[mode].short}
        </button>
      ))}
    </div>
  )

  return (
    <div style={panelStyle(isMobile, expanded)}>
      {isMobile && (
        <div
          style={grabberWrapStyle}
          onClick={togglePanel}
          role="button"
          aria-label={expanded ? 'Thu gọn bảng điều khiển' : 'Mở bảng điều khiển'}
        >
          <div style={grabberStyle} />
        </div>
      )}

      {/* Thu gọn: chỉ giữ những gì cần để gửi và thấy lỗi, trả chỗ lại cho
          bảng vẽ. Mobile là thanh đáy, desktop là thẻ nhỏ góc dưới phải. */}
      {!expanded && (
        <div style={collapsedBarStyle(isMobile)}>
          <div style={collapsedStatusRowStyle(isMobile)}>
            <div style={dotStyle(connected ? '#1D9E75' : '#999')} />
            <span>{connected ? 'Sẵn sàng gửi' : 'Chưa kết nối'}</span>
            <span style={{ marginLeft: 'auto', color: '#999', fontSize: 13 }}>
              {cols} × {rowCount}
            </span>
            {/* Biểu tượng thay chữ: trên iPhone mỗi pixel bề ngang đều là chỗ
                vẽ bị mất. Nhãn đầy đủ vẫn còn ở title cho người dùng chuột. */}
            <button
              onClick={togglePanel}
              title="Cài đặt màn nước"
              aria-label="Cài đặt màn nước"
              style={{ ...backBtnStyle, width: 40, height: 34, padding: 0, fontSize: 17 }}
            >⚙</button>
          </div>
          <div style={sendRowStyle}>
            {sendBtn}
            <button
              onClick={clearGrid}
              title="Xoá hoạ tiết"
              style={{ ...secondaryBtnStyle(isMobile), flex: 'none', paddingInline: 18 }}
            >🗑</button>
          </div>
          {sendError && <Note color="#E24B4A">{sendError}</Note>}
        </div>
      )}

      {expanded && (
        <div style={sheetBodyStyle(isMobile)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <strong style={{ fontSize: isMobile ? 17 : 15 }}>🌊 Màn nước</strong>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={onExit} title="Quay lại vẽ chung" style={backBtnStyle}>← Vẽ chung</button>
              <button
                onClick={togglePanel}
                title="Đóng, lấy lại chỗ vẽ"
                aria-label="Đóng bảng cài đặt"
                style={backBtnStyle}
              >{isMobile ? '✕' : 'Thu gọn →'}</button>
            </div>
          </div>

          <Section title="Kết nối tới thiết bị">
            <div style={segmentRowStyle}>
              <button onClick={() => setTransportMode('bridge')} style={modeTabStyle(isBridge, isMobile)}>
                Qua server
              </button>
              <button onClick={() => setTransportMode('direct')} style={modeTabStyle(!isBridge, isMobile)}>
                Trực tiếp (LAN)
              </button>
            </div>

            {isBridge ? (
              <>
                {/* Đoạn giải thích dài chỉ giữ trên desktop — trên điện thoại nó
                    đẩy hết phần điều khiển xuống dưới màn hình. */}
                {!isMobile && (
                  <p style={{ color: '#999', margin: 0 }}>
                    Gửi qua server whiteboard tới bridge chạy trên máy cắm dây với
                    thiết bị. Dùng được từ bất kỳ đâu, kể cả khi whiteboard chạy HTTPS.
                  </p>
                )}
                <StatusLine color={bridgeOnline ? '#1D9E75' : '#999'}>
                  {bridgeOnline ? 'Bridge đã kết nối server' : 'Chưa có bridge nào online'}
                </StatusLine>
                {bridgeOnline && (
                  <StatusLine color={STATUS_COLOR[status] || '#999'}>
                    Bridge → thiết bị: {STATUS_LABEL[status] || 'Không rõ'}
                  </StatusLine>
                )}
                {!bridgeOnline && (
                  <Note color="#EF9F27">Chưa chạy bridge trên máy có dây tới màn nước.</Note>
                )}
              </>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={ip}
                    onChange={(e) => setIp(e.target.value)}
                    placeholder="IP bộ điều khiển (192.168.1.x)"
                    disabled={status === SOCKET_STATUS.CONNECTED}
                    style={{ ...inputStyle(isMobile), flex: 1, minWidth: 0 }}
                  />
                  <input
                    type="number"
                    value={wsPort}
                    onChange={(e) => setWsPort(Number(e.target.value) || CFG.DEFAULT_WS_PORT)}
                    disabled={status === SOCKET_STATUS.CONNECTED}
                    style={{ ...inputStyle(isMobile), width: isMobile ? 88 : 64 }}
                  />
                </div>
                <button
                  onClick={handleConnectToggle}
                  style={status === SOCKET_STATUS.CONNECTED ? dangerBtnStyle(isMobile) : primaryBtnStyle(isMobile)}
                >
                  {status === SOCKET_STATUS.CONNECTED
                    ? 'Ngắt kết nối'
                    : status === SOCKET_STATUS.CONNECTING ? 'Đang kết nối...' : 'Kết nối'}
                </button>
                <StatusLine color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</StatusLine>
                <Note color="#EF9F27">
                  Chỉ dùng được khi mở whiteboard qua http:// cùng LAN với thiết bị.
                </Note>
              </>
            )}

            {valveCount != null && (
              <Note color="#666">Van: {valveCount} ({valveBytes} byte/frame)</Note>
            )}
            {error && <Note color="#E24B4A">{error}</Note>}
          </Section>

          <Section title="Hoạ tiết">
            <Field label={`Số hàng: ${rowCount}`}>
              <input
                type="range"
                min={CFG.MIN_ROW_COUNT}
                max={CFG.MAX_ROW_COUNT}
                value={rowCount}
                onChange={(e) => setRowCount(Number(e.target.value))}
                style={rangeStyle(isMobile)}
              />
            </Field>
            <Field label={`Tốc độ rơi: ${rowIntervalMs} ms/hàng`}>
              <input
                type="range"
                min={CFG.MIN_ROW_INTERVAL_MS}
                max={CFG.MAX_ROW_INTERVAL_MS}
                value={rowIntervalMs}
                onChange={(e) => setRowIntervalMs(Number(e.target.value))}
                style={rangeStyle(isMobile)}
              />
            </Field>
            <Note color="#999">{cols} cột (van) × {rowCount} hàng</Note>
            <button onClick={clearGrid} style={secondaryBtnStyle(isMobile)}>🗑 Xoá hoạ tiết</button>
          </Section>

          <Section title="Gửi" last>
            {playModeTabs}
            <Note color="#999">{PLAY_MODE_META[playMode].hint}</Note>
            <div style={sendRowStyle}>{sendBtn}</div>
            <button
              onClick={allOff}
              disabled={!connected}
              style={{
                ...secondaryBtnStyle(isMobile),
                opacity: connected ? 1 : 0.5,
                cursor: connected ? 'pointer' : 'not-allowed',
              }}
            >Tắt hết van</button>
            {sendError && <Note color="#E24B4A">{sendError}</Note>}
            {lastSentAt && !sendError && (
              <Note color="#1D9E75">Đã gửi lúc {new Date(lastSentAt).toLocaleTimeString()}</Note>
            )}
            {isBridge && bridgeOnline && !deviceReady && (
              <Note color="#EF9F27">
                Bridge online nhưng chưa xác nhận nối được ESP32 — vẫn có thể thử gửi.
              </Note>
            )}
          </Section>
        </div>
      )}
    </div>
  )
}

function Section({ title, children, last }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 10,
      borderBottom: last ? 'none' : '1px solid rgba(0,0,0,0.06)',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: '#999',
        textTransform: 'uppercase', letterSpacing: 0.4,
      }}>{title}</div>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ color: '#444' }}>{label}</span>
      {children}
    </label>
  )
}

function StatusLine({ color, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={dotStyle(color)} />
      <span style={{ color: '#666' }}>{children}</span>
    </div>
  )
}

function Note({ color, children }) {
  return <div style={{ color, lineHeight: 1.4 }}>{children}</div>
}
