import { useStore } from '../store/index.js'

export default function CursorOverlay({ canvasRef }) {
  const { cursors } = useStore()

  return (
    <div style={{
      position: 'absolute', inset: 0,
      pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {Object.entries(cursors).map(([socketId, cursor]) => (
        <RemoteCursor key={socketId} cursor={cursor} canvasRef={canvasRef} />
      ))}
    </div>
  )
}

function RemoteCursor({ cursor, canvasRef }) {
  const { x, y, displayName, color } = cursor

  // Chuyển tọa độ canvas sang tọa độ DOM
  const canvas = canvasRef.current
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  const scaleX = rect.width / canvas.width
  const scaleY = rect.height / canvas.height
  const domX = x * scaleX
  const domY = y * scaleY

  return (
    <div style={{
      position: 'absolute',
      left: domX,
      top: domY,
      transform: 'translate(-2px, -2px)',
      pointerEvents: 'none',
      zIndex: 50,
    }}>
      {/* SVG cursor */}
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M4 2L16 10L10 11L7 18L4 2Z" fill={color} stroke="white" strokeWidth="1.5"/>
      </svg>
      {/* Name label */}
      <div style={{
        position: 'absolute',
        top: 18,
        left: 10,
        background: color,
        color: '#fff',
        fontSize: 11,
        fontWeight: 500,
        padding: '2px 6px',
        borderRadius: 4,
        whiteSpace: 'nowrap',
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
      }}>
        {displayName}
      </div>
    </div>
  )
}
