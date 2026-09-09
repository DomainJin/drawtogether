import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/index.js'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

/** Phòng dùng cho màn nước, nhớ lại giữa các lần mở app.
 *
 *  Màn nước không cần cộng tác — hoạ tiết đi thẳng tới bridge, không qua phòng.
 *  Nhưng socket lại gắn với một phòng, nên vẫn cần một phòng để vào. Nhớ lại id
 *  thay vì tạo mới mỗi lần bấm, nếu không mỗi cú click đẻ một phòng rác trong DB.
 */
const LS_WATERFALL_ROOM = 'wb_waterfall_room'

export default function HomePage() {
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [loading, setLoading] = useState(null) // null | 'waterfall' | 'board' | 'join'
  const { setAuth, loadAuth } = useStore()
  const navigate = useNavigate()

  /** Lấy token đã lưu, chỉ tạo guest mới khi thật sự chưa có.
   *
   *  Bản cũ kiểm tra `loadAuth() && token` với `token` lấy từ lần render trước
   *  — lúc đó nó còn null, nên điều kiện luôn sai và mỗi lần vào trang lại đẻ
   *  thêm một user guest trong DB. Đọc thẳng localStorage thì không dính. */
  const getOrCreateToken = async (displayName) => {
    const saved = localStorage.getItem('wb_token')
    if (saved) {
      loadAuth()
      return saved
    }
    const res = await fetch(`${SERVER_URL}/api/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName }),
    })
    const data = await res.json()
    setAuth(data.user, data.token)
    return data.token
  }

  const createRoom = async (token, roomName) => {
    const res = await fetch(`${SERVER_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: roomName }),
    })
    const data = await res.json()
    return data.room.id
  }

  const roomExists = async (id) => {
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms/${id}`)
      return res.ok
    } catch {
      return false
    }
  }

  /** Vào thẳng giao diện vẽ màn nước — không hỏi tên, không hỏi mã phòng. */
  const enterWaterfall = async () => {
    setLoading('waterfall')
    try {
      const token = await getOrCreateToken(name.trim() || 'Màn nước')

      let roomId = localStorage.getItem(LS_WATERFALL_ROOM)
      // Phòng cũ có thể đã bị xoá trên server — kiểm tra rồi mới dùng lại.
      if (!roomId || !(await roomExists(roomId))) {
        roomId = await createRoom(token, 'Màn nước')
        localStorage.setItem(LS_WATERFALL_ROOM, roomId)
      }

      navigate(`/${roomId}?mode=waterfall`)
    } catch {
      alert('Lỗi kết nối server')
    } finally {
      setLoading(null)
    }
  }

  const handleCreate = async () => {
    if (!name.trim()) return alert('Nhập tên của bạn trước')
    setLoading('board')
    try {
      const token = await getOrCreateToken(name)
      const roomId = await createRoom(token, `Board của ${name}`)
      navigate(`/${roomId}`)
    } catch {
      alert('Lỗi kết nối server')
    } finally {
      setLoading(null)
    }
  }

  const handleJoin = async () => {
    if (!name.trim()) return alert('Nhập tên của bạn trước')
    if (!roomCode.trim()) return alert('Nhập mã phòng')
    setLoading('join')
    try {
      await getOrCreateToken(name)
      navigate(`/${roomCode.trim()}`)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f5f0 0%, #e8f4fd 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
      padding: '24px 0',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20,
        padding: '36px 40px', maxWidth: 420, width: '90%',
        boxShadow: '0 8px 40px rgba(0,0,0,0.10)',
        boxSizing: 'border-box',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🎨</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#1a1a1a' }}>Whiteboard</h1>
          <p style={{ margin: '8px 0 0', color: '#666', fontSize: 15 }}>Vẽ cùng nhau, real-time</p>
        </div>

        {/* Màn nước đi trước và đứng riêng: một cú bấm là vào vẽ. */}
        <button
          onClick={enterWaterfall}
          disabled={loading !== null}
          style={{
            width: '100%', padding: '16px', borderRadius: 12,
            background: '#378ADD', color: '#fff', border: 'none',
            fontSize: 16, fontWeight: 700, cursor: 'pointer',
            opacity: loading !== null ? 0.6 : 1,
          }}
        >
          {loading === 'waterfall' ? 'Đang mở...' : '🌊 Vào màn nước'}
        </button>
        <p style={{ margin: '8px 0 0', textAlign: 'center', color: '#999', fontSize: 13 }}>
          Vẽ hoạ tiết rồi gửi thẳng tới màn nước — không cần tên hay mã phòng
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '22px 0 18px' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.08)' }} />
          <span style={{ color: '#aaa', fontSize: 12, fontWeight: 600 }}>HOẶC VẼ CHUNG</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.08)' }} />
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên hiển thị của bạn..."
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          style={{
            width: '100%', padding: '11px 14px', borderRadius: 10,
            border: '1.5px solid #ddd', fontSize: 15, marginBottom: 10,
            boxSizing: 'border-box', outline: 'none',
          }}
        />

        <button
          onClick={handleCreate}
          disabled={loading !== null}
          style={{
            width: '100%', padding: '12px', borderRadius: 10,
            background: '#1a1a1a', color: '#fff', border: 'none',
            fontSize: 15, fontWeight: 600, cursor: 'pointer', marginBottom: 10,
            opacity: loading !== null ? 0.6 : 1,
          }}
        >
          {loading === 'board' ? '...' : '✨ Tạo bảng mới'}
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            placeholder="Mã phòng..."
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 10,
              border: '1.5px solid #ddd', fontSize: 14, outline: 'none',
              minWidth: 0, boxSizing: 'border-box',
            }}
          />
          <button
            onClick={handleJoin}
            disabled={loading !== null}
            style={{
              padding: '10px 18px', borderRadius: 10,
              background: '#378ADD', color: '#fff', border: 'none',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              opacity: loading !== null ? 0.6 : 1,
            }}
          >Vào</button>
        </div>
      </div>
    </div>
  )
}
