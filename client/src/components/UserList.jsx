import { useStore } from '../store/index.js'

export default function UserList() {
  const { users, user: me, room } = useStore()
  const allUsers = me ? [{ ...me, isMe: true }, ...users] : users

  return (
    <div style={{
      position: 'fixed',
      top: 16,
      right: 16,
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(0,0,0,0.08)',
      borderRadius: 12,
      padding: '12px',
      minWidth: 160,
      zIndex: 100,
      boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    }}>
      <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Online ({allUsers.length})
      </p>
      {allUsers.map((u, i) => (
        <div key={u.socketId || i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: u.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 600, color: '#fff',
            flexShrink: 0,
          }}>
            {(u.displayName || u.display_name || 'A')[0].toUpperCase()}
          </div>
          <span style={{ fontSize: 13, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {u.displayName || u.display_name}{u.isMe ? ' (bạn)' : ''}
          </span>
        </div>
      ))}
    </div>
  )
}
