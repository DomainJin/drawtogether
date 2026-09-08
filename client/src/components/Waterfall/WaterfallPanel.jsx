import { useWaterfallStore } from '../../store/waterfallStore.js'
import { WATERFALL_CONFIG as CFG } from '../../waterfall/config.js'
import { SOCKET_STATUS } from '../../waterfall/valveSocket.js'

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
  } = useWaterfallStore()

  const isBridge = transportMode === 'bridge'
  const connected = isBridge ? bridgeOnline : status === SOCKET_STATUS.CONNECTED
  const deviceReady = isBridge ? (bridgeOnline && status === SOCKET_STATUS.CONNECTED) : connected

  const handleConnectToggle = () => {
    if (status === SOCKET_STATUS.CONNECTED || status === SOCKET_STATUS.CONNECTING) disconnect()
    else connect()
  }

  return (
    <div style={{
      position: 'fixed', right: 16, top: 80, bottom: 100, width: 280,
      display: 'flex', flexDirection: 'column', gap: 12,
      background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16,
      padding: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
      zIndex: 100, overflowY: 'auto', fontSize: 13,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 15 }}>🌊 Màn nước</strong>
        <button onClick={onExit} title="Quay lại vẽ chung" style={backBtnStyle}>← Vẽ chung</button>
      </div>

      <Section title="Kết nối tới thiết bị">
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1.5px solid #ddd' }}>
          <ModeTab active={isBridge} onClick={() => setTransportMode('bridge')}>Qua server</ModeTab>
          <ModeTab active={!isBridge} onClick={() => setTransportMode('direct')}>Trực tiếp (LAN)</ModeTab>
        </div>

        {isBridge ? (
          <>
            <p style={{ color: '#999', margin: 0 }}>
              Gửi qua server whiteboard tới bridge chạy trên máy cắm dây với
              thiết bị. Dùng được từ bất kỳ đâu, kể cả khi whiteboard chạy HTTPS.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: bridgeOnline ? '#1D9E75' : '#999' }} />
              <span style={{ color: '#666' }}>{bridgeOnline ? 'Bridge đã kết nối server' : 'Chưa có bridge nào online'}</span>
            </div>
            {bridgeOnline && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[status] || '#999' }} />
                <span style={{ color: '#666' }}>Bridge → thiết bị: {STATUS_LABEL[status] || 'Không rõ'}</span>
              </div>
            )}
            {!bridgeOnline && (
              <div style={{ color: '#EF9F27' }}>Chưa chạy bridge trên máy có dây tới màn nước.</div>
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
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                type="number"
                value={wsPort}
                onChange={(e) => setWsPort(Number(e.target.value) || CFG.DEFAULT_WS_PORT)}
                disabled={status === SOCKET_STATUS.CONNECTED}
                style={{ ...inputStyle, width: 64 }}
              />
            </div>
            <button onClick={handleConnectToggle} style={status === SOCKET_STATUS.CONNECTED ? dangerBtnStyle : primaryBtnStyle}>
              {status === SOCKET_STATUS.CONNECTED ? 'Ngắt kết nối' : status === SOCKET_STATUS.CONNECTING ? 'Đang kết nối...' : 'Kết nối'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[status] }} />
              <span style={{ color: '#666' }}>{STATUS_LABEL[status]}</span>
            </div>
            <div style={{ color: '#EF9F27' }}>Chỉ dùng được khi mở whiteboard qua http:// cùng LAN với thiết bị.</div>
          </>
        )}

        {valveCount != null && (
          <div style={{ color: '#666' }}>Van: {valveCount} ({valveBytes} byte/frame)</div>
        )}
        {error && <div style={{ color: '#E24B4A' }}>{error}</div>}
      </Section>

      <Section title="Hoạ tiết">
        <Field label={`Số hàng: ${rowCount}`}>
          <input
            type="range"
            min={CFG.MIN_ROW_COUNT}
            max={CFG.MAX_ROW_COUNT}
            value={rowCount}
            onChange={(e) => setRowCount(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </Field>
        <Field label={`Tốc độ rơi: ${rowIntervalMs} ms/hàng`}>
          <input
            type="range"
            min={CFG.MIN_ROW_INTERVAL_MS}
            max={CFG.MAX_ROW_INTERVAL_MS}
            value={rowIntervalMs}
            onChange={(e) => setRowIntervalMs(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </Field>
        <div style={{ color: '#999' }}>{cols} cột (van) × {rowCount} hàng</div>
        <button onClick={clearGrid} style={secondaryBtnStyle}>🗑 Xoá hoạ tiết</button>
      </Section>

      <Section title="Gửi">
        <button
          onClick={sendPattern}
          disabled={!connected || sending}
          style={{ ...primaryBtnStyle, opacity: !connected || sending ? 0.5 : 1, cursor: !connected || sending ? 'not-allowed' : 'pointer' }}
        >
          {sending ? 'Đang gửi...' : '🌊 Gửi tới màn nước'}
        </button>
        <button
          onClick={allOff}
          disabled={!connected}
          style={{ ...secondaryBtnStyle, opacity: !connected ? 0.5 : 1, cursor: !connected ? 'not-allowed' : 'pointer' }}
        >Tắt hết van</button>
        {sendError && <div style={{ color: '#E24B4A' }}>{sendError}</div>}
        {lastSentAt && !sendError && (
          <div style={{ color: '#1D9E75' }}>Đã gửi lúc {new Date(lastSentAt).toLocaleTimeString()}</div>
        )}
        {isBridge && bridgeOnline && !deviceReady && (
          <div style={{ color: '#EF9F27' }}>Bridge online nhưng chưa xác nhận nối được ESP32 — vẫn có thể thử gửi.</div>
        )}
      </Section>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 10, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 0.4 }}>{title}</div>
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

function ModeTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '8px 6px', border: 'none', cursor: 'pointer',
        background: active ? '#1a1a1a' : 'transparent',
        color: active ? '#fff' : '#444',
        fontSize: 12, fontWeight: 600,
      }}
    >{children}</button>
  )
}

const inputStyle = {
  padding: '8px 10px', borderRadius: 8, border: '1.5px solid #ddd',
  fontSize: 13, outline: 'none', boxSizing: 'border-box',
}

const primaryBtnStyle = {
  padding: '10px', borderRadius: 8, border: 'none',
  background: '#1a1a1a', color: '#fff', fontSize: 13, fontWeight: 600,
  cursor: 'pointer',
}

const secondaryBtnStyle = {
  padding: '8px', borderRadius: 8, border: '1.5px solid #ddd',
  background: 'transparent', color: '#1a1a1a', fontSize: 13, fontWeight: 500,
  cursor: 'pointer',
}

const dangerBtnStyle = {
  ...primaryBtnStyle, background: 'rgba(226,75,74,0.1)', color: '#E24B4A',
}

const backBtnStyle = {
  fontSize: 12, padding: '4px 10px', borderRadius: 6,
  border: '1px solid rgba(0,0,0,0.12)', background: 'transparent',
  cursor: 'pointer', color: '#378ADD',
}
