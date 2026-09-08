import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/index.js'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
const USER_COLORS = ['#E24B4A','#378ADD','#1D9E75','#EF9F27','#D4537E','#7F77DD','#D85A30']

export default function HomePage() {
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('board')
  const { setAuth, loadAuth, token } = useStore()
  const navigate = useNavigate()

  const getOrCreateToken = async (displayName) => {
    if (loadAuth() && token) return token
    const res = await fetch(`${SERVER_URL}/api/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName }),
    })
    const data = await res.json()
    setAuth(data.user, data.token)
    return data.token
  }

  const handleCreate = async () => {
    if (!name.trim()) return alert('Nhập tên của bạn trước')
    setLoading(true)
    try {
      const token = await getOrCreateToken(name)
      const res = await fetch(`${SERVER_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: mode === 'waterfall' ? `Màn nước của ${name}` : `Board của ${name}` }),
      })
      const data = await res.json()
      navigate(`/${data.room.id}${mode === 'waterfall' ? '?mode=waterfall' : ''}`)
    } catch (e) {
      alert('Lỗi kết nối server')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    if (!name.trim()) return alert('Nhập tên của bạn trước')
    if (!roomCode.trim()) return alert('Nhập mã phòng')
    setLoading(true)
    try {
      await getOrCreateToken(name)
      navigate(`/${roomCode.trim()}${mode === 'waterfall' ? '?mode=waterfall' : ''}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f5f0 0%, #e8f4fd 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20,
        padding: '40px 48px', maxWidth: 420, width: '90%',
        boxShadow: '0 8px 40px rgba(0,0,0,0.10)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎨</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#1a1a1a' }}>Whiteboard</h1>
          <p style={{ margin: '8px 0 0', color: '#666', fontSize: 15 }}>Vẽ cùng nhau, real-time</p>
        </div>

        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#444' }}>
          Tên của bạn
        </label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nhập tên hiển thị..."
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 10,
            border: '1.5px solid #ddd', fontSize: 15, marginBottom: 20,
            boxSizing: 'border-box', outline: 'none',
          }}
        />

        <div style={{ display: 'flex', gap: 6, marginBottom: 12, background: '#f5f5f5', borderRadius: 10, padding: 4 }}>
          <button
            onClick={() => setMode('board')}
            style={{
              flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: mode === 'board' ? '#1a1a1a' : 'transparent',
              color: mode === 'board' ? '#fff' : '#1a1a1a',
              fontSize: 13, fontWeight: 600,
            }}
          >🎨 Vẽ chung</button>
          <button
            onClick={() => setMode('waterfall')}
            style={{
              flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: mode === 'waterfall' ? '#378ADD' : 'transparent',
              color: mode === 'waterfall' ? '#fff' : '#378ADD',
              fontSize: 13, fontWeight: 600,
            }}
          >🌊 Màn nước</button>
        </div>

        <button
          onClick={handleCreate}
          disabled={loading}
          style={{
            width: '100%', padding: '12px', borderRadius: 10,
            background: mode === 'waterfall' ? '#378ADD' : '#1a1a1a', color: '#fff', border: 'none',
            fontSize: 15, fontWeight: 600, cursor: 'pointer', marginBottom: 12,
          }}
        >
          {loading ? '...' : (mode === 'waterfall' ? '🌊 Tạo phòng màn nước' : '✨ Tạo bảng mới')}
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={roomCode}
            onChange={e => setRoomCode(e.target.value)}
            placeholder="Mã phòng..."
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 10,
              border: '1.5px solid #ddd', fontSize: 14, outline: 'none',
            }}
          />
          <button
            onClick={handleJoin}
            disabled={loading}
            style={{
              padding: '10px 18px', borderRadius: 10,
              background: '#378ADD', color: '#fff', border: 'none',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >Vào</button>
        </div>
      </div>
    </div>
  )
}
