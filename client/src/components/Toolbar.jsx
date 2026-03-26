import { useStore } from '../store/index.js'
import { getSocket } from '../hooks/useSocket.js'

const TOOLS = [
  { id: 'pen', label: '✏️', title: 'Bút vẽ' },
  { id: 'eraser', label: '⬜', title: 'Tẩy (E)' },
]

const COLORS = [
  '#1a1a1a', '#E24B4A', '#378ADD', '#1D9E75',
  '#EF9F27', '#D4537E', '#7F77DD', '#D85A30',
  '#ffffff',
]

const WIDTHS = [2, 4, 8, 16]

export default function Toolbar({ onExport }) {
  const { tool, color, width, setTool, setColor, setWidth, connected, room, users } = useStore()

  const handleClear = () => {
    if (window.confirm('Xóa toàn bộ bảng vẽ?')) {
      getSocket()?.emit('board:clear')
    }
  }

  const handleUndo = () => getSocket()?.emit('draw:undo')

  return (
    <div style={{
      position: 'fixed',
      left: '50%',
      bottom: 24,
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(0,0,0,0.08)',
      borderRadius: 16,
      padding: '10px 16px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
      zIndex: 100,
      flexWrap: 'wrap',
      maxWidth: '95vw',
    }}>
      {/* Tool selector */}
      <div style={{ display: 'flex', gap: 4 }}>
        {TOOLS.map(t => (
          <button
            key={t.id}
            title={t.title}
            onClick={() => setTool(t.id)}
            style={{
              width: 36, height: 36, borderRadius: 8, border: 'none',
              background: tool === t.id ? '#1a1a1a' : 'transparent',
              color: tool === t.id ? '#fff' : '#1a1a1a',
              cursor: 'pointer', fontSize: 16,
              transition: 'all 0.15s',
            }}
          >{t.label}</button>
        ))}
      </div>

      <Divider />

      {/* Color palette */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {COLORS.map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            style={{
              width: c === color ? 28 : 22,
              height: c === color ? 28 : 22,
              borderRadius: '50%',
              background: c,
              border: c === color ? '3px solid #1a1a1a' : '1.5px solid rgba(0,0,0,0.15)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: c === '#ffffff' ? 'inset 0 0 0 1px #ddd' : 'none',
            }}
          />
        ))}
        {/* Custom color picker */}
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          title="Màu tuỳ chỉnh"
          style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0 }}
        />
      </div>

      <Divider />

      {/* Width */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {WIDTHS.map(w => (
          <button
            key={w}
            onClick={() => setWidth(w)}
            title={`Nét ${w}px`}
            style={{
              width: 32, height: 32, borderRadius: 6,
              border: width === w ? '2px solid #1a1a1a' : '1.5px solid rgba(0,0,0,0.1)',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div style={{ width: Math.min(w * 2, 20), height: w / 2 + 1, background: '#1a1a1a', borderRadius: 4 }} />
          </button>
        ))}
      </div>

      <Divider />

      {/* Actions */}
      <div style={{ display: 'flex', gap: 4 }}>
        <ToolBtn onClick={handleUndo} title="Undo (Ctrl+Z)">↩</ToolBtn>
        <ToolBtn onClick={handleClear} title="Xóa bảng" danger>🗑</ToolBtn>
        <ToolBtn onClick={onExport} title="Xuất PNG">💾</ToolBtn>
      </div>

      <Divider />

      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: connected ? '#1D9E75' : '#E24B4A',
        }} />
        <span style={{ fontSize: 12, color: '#666' }}>
          {users.length + 1} người
        </span>
      </div>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 28, background: 'rgba(0,0,0,0.1)' }} />
}

function ToolBtn({ children, onClick, title, danger }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 36, height: 36, borderRadius: 8,
        border: 'none',
        background: danger ? 'rgba(226,75,74,0.08)' : 'transparent',
        color: danger ? '#E24B4A' : '#1a1a1a',
        cursor: 'pointer', fontSize: 16,
      }}
    >{children}</button>
  )
}
