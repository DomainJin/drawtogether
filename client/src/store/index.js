import { create } from 'zustand'

export const useStore = create((set, get) => ({
  // Auth
  user: null,
  token: null,
  setAuth: (user, token) => {
    localStorage.setItem('wb_token', token)
    localStorage.setItem('wb_user', JSON.stringify(user))
    set({ user, token })
  },
  loadAuth: () => {
    const token = localStorage.getItem('wb_token')
    const user = localStorage.getItem('wb_user')
    if (token && user) set({ token, user: JSON.parse(user) })
    return !!token
  },

  // Room
  room: null,
  setRoom: (room) => set({ room }),

  // Connected users (presence)
  users: [],
  setUsers: (users) => set({ users }),
  addUser: (user) => set((s) => ({ users: [...s.users.filter(u => u.socketId !== user.socketId), user] })),
  removeUser: (socketId) => set((s) => ({ users: s.users.filter(u => u.socketId !== socketId) })),

  // Tool state
  tool: 'pen',        // pen | eraser | line | rect | circle | text
  color: '#1a1a1a',
  width: 3,
  opacity: 1,
  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  setWidth: (width) => set({ width }),
  setOpacity: (opacity) => set({ opacity }),

  // Remote cursors
  cursors: {},        // { socketId: { x, y, displayName, color } }
  setCursor: (socketId, data) => set((s) => ({ cursors: { ...s.cursors, [socketId]: data } })),
  removeCursor: (socketId) => set((s) => {
    const c = { ...s.cursors }
    delete c[socketId]
    return { cursors: c }
  }),

  // Connection status
  connected: false,
  setConnected: (v) => set({ connected: v }),
}))
