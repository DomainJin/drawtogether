import { create } from 'zustand'
import { WATERFALL_CONFIG as CFG, WATERFALL_UI as UI } from '../waterfall/config.js'
import { createEmptyGrid, resizeGrid, setCell as setCellPure, stampCells } from '../waterfall/grid.js'
import { rebuildGrid } from '../waterfall/strokeReplay.js'
import { ValveSocket, SOCKET_STATUS } from '../waterfall/valveSocket.js'
import { buildAnimationFrames, gridToOpenValveRows } from '../waterfall/valveCodec.js'
import { cmdAllOff, cmdGetConfig } from '../waterfall/commands.js'
import { sendFramesViaBridge, sendCmdViaBridge, isBridgeSocketReady } from '../waterfall/bridgeTransport.js'

let directSocket = null

const LS_IP_KEY = 'wb_waterfall_ip'
const LS_PORT_KEY = 'wb_waterfall_port'
const LS_MODE_KEY = 'wb_waterfall_mode'

function loadSaved(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function saveLocal(key, value) {
  try { localStorage.setItem(key, value) } catch { /* private mode — bỏ qua */ }
}

const savedMode = loadSaved(LS_MODE_KEY, 'bridge')

/** Panel mở sẵn trên màn rộng, thu gọn sẵn trên điện thoại — chỗ vẽ trên máy
 *  nhỏ quý hơn. Đọc bề ngang một lần lúc khởi tạo là đủ; sau đó người dùng tự
 *  đóng/mở, không tự ý đổi theo họ khi xoay máy. */
const defaultPanelOpen =
  typeof window === 'undefined' || window.innerWidth >= UI.MOBILE_BREAKPOINT_PX

export const useWaterfallStore = create((set, get) => ({
  active: false,

  /** Bảng điều khiển đang mở hay thu gọn. Nằm ở store vì WhiteboardPage cần
   *  đọc để tính chỗ cho canvas, còn WaterfallPanel cần để tự vẽ. */
  panelOpen: defaultPanelOpen,
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),

  setActive: (active) => set({ active }),
  toggleActive: () => set((s) => ({ active: !s.active })),

  transportMode: savedMode === 'direct' ? 'direct' : 'bridge',
  setTransportMode: (transportMode) => {
    saveLocal(LS_MODE_KEY, transportMode)
    set({ transportMode, error: null, sendError: null })
  },

  bridgeOnline: false,
  setBridgeOnline: (bridgeOnline) => set({ bridgeOnline }),

  /** Socket tới server vừa rớt. Mọi thông tin về bridge/thiết bị đều đến qua
   *  socket đó nên giờ đã hết giá trị — không giữ đèn xanh cũ, nếu không panel
   *  báo "đã kết nối" trong khi bấm Gửi thì hỏng. Chỉ đụng tới state của chế độ
   *  bridge, chế độ LAN dùng socket riêng. */
  resetBridgeLink: () => set((s) => (
    s.transportMode === 'bridge'
      ? { bridgeOnline: false, status: SOCKET_STATUS.DISCONNECTED, valveCount: null, valveBytes: null, tickMs: null }
      : { bridgeOnline: false }
  )),
  applyBridgeStatus: (status) => {
    const patch = {}
    if (status.status) patch.status = status.status
    if ('error' in status) patch.error = status.error
    if ('valveCount' in status) patch.valveCount = status.valveCount
    if ('valveBytes' in status) patch.valveBytes = status.valveBytes
    if ('tickMs' in status) patch.tickMs = status.tickMs
    set(patch)
    if (typeof status.valveCount === 'number') get().resizeCols(status.valveCount)
  },

  ip: loadSaved(LS_IP_KEY, ''),
  wsPort: Number(loadSaved(LS_PORT_KEY, CFG.DEFAULT_WS_PORT)) || CFG.DEFAULT_WS_PORT,
  status: SOCKET_STATUS.DISCONNECTED,
  error: null,
  valveCount: null,
  valveBytes: null,
  tickMs: null,

  setIp: (ip) => { saveLocal(LS_IP_KEY, ip); set({ ip }) },
  setWsPort: (wsPort) => { saveLocal(LS_PORT_KEY, String(wsPort)); set({ wsPort }) },

  connect: async () => {
    const { ip, wsPort } = get()
    if (!ip.trim()) {
      set({ error: 'Nhập địa chỉ IP của bộ điều khiển van' })
      return
    }
    set({ error: null })
    directSocket?.close()

    directSocket = new ValveSocket({
      onStatus: (status) => set({ status }),
      onMessage: (data) => {
        if (typeof data !== 'string') return
        try {
          const msg = JSON.parse(data)
          if (msg.type === 'config') {
            const patch = {}
            if (typeof msg.valve_count === 'number') patch.valveCount = msg.valve_count
            if (typeof msg.valve_bytes === 'number') patch.valveBytes = msg.valve_bytes
            if (typeof msg.tick_ms === 'number') patch.tickMs = msg.tick_ms
            set(patch)
            if (typeof msg.valve_count === 'number') get().resizeCols(msg.valve_count)
          }
        } catch { /* không phải JSON — bỏ qua */ }
      },
    })

    try {
      await directSocket.connect(`ws://${ip}:${wsPort}`)
      directSocket.sendText(JSON.stringify(cmdGetConfig()))
    } catch (err) {
      set({ error: String(err.message || err) })
    }
  },

  disconnect: () => {
    directSocket?.close()
    directSocket = null
    set({ status: SOCKET_STATUS.DISCONNECTED, valveCount: null, valveBytes: null, tickMs: null })
  },

  cols: CFG.DEFAULT_VALVE_COUNT,
  rowCount: CFG.DEFAULT_ROW_COUNT,
  rowIntervalMs: CFG.DEFAULT_ROW_INTERVAL_MS,
  grid: createEmptyGrid(CFG.DEFAULT_ROW_COUNT, CFG.DEFAULT_VALVE_COUNT),

  resizeCols: (cols) => {
    const clamped = Math.max(1, Math.min(CFG.MAX_VALVES, Math.round(cols)))
    set((s) => ({ cols: clamped, grid: resizeGrid(s.grid, s.rowCount, clamped) }))
  },

  setRowCount: (rowCount) => {
    const clamped = Math.max(CFG.MIN_ROW_COUNT, Math.min(CFG.MAX_ROW_COUNT, Math.round(rowCount)))
    set((s) => ({ rowCount: clamped, grid: resizeGrid(s.grid, clamped, s.cols) }))
  },

  setRowIntervalMs: (ms) => {
    const clamped = Math.max(CFG.MIN_ROW_INTERVAL_MS, Math.min(CFG.MAX_ROW_INTERVAL_MS, Math.round(ms)))
    set({ rowIntervalMs: clamped })
  },

  setCell: (row, col, value) => set((s) => ({ grid: setCellPure(s.grid, row, col, value) })),

  /** Tô/xoá cả một nét trong một lần cập nhật — xem stampCells(). */
  paintCells: (cells, value) => set((s) => ({ grid: stampCells(s.grid, cells, value) })),

  clearGrid: () => set((s) => ({ grid: createEmptyGrid(s.rowCount, s.cols), strokes: [], redoStack: [] })),

  // ── Nét vector, CHỈ để hiển thị ────────────────────────────────────────────
  // `grid` vẫn là nguồn sự thật duy nhất cho thứ gửi đi. Mảng này giữ đường đi
  // thật của ngón tay ở độ phân giải màn hình để vẽ lại cho mượt — lưới 160x64
  // có ô cao gấp 3,5 lần bề rộng nên tự nó không bao giờ cho nét đều được.
  // Toạ độ chuẩn hoá 0..1 để đổi kích thước canvas không hỏng nét.
  strokes: [],
  /** Các nét đã Undo, chờ Redo. Vẽ nét mới thì bỏ hết — nhánh cũ không còn nối
   *  tiếp được nữa, giữ lại chỉ khiến Redo dán một nét lạ vào hoạ tiết. */
  redoStack: [],
  /** radRows/radCols lưu theo Ô, không theo pixel màn hình: nhờ vậy Undo dựng
   *  lại được đúng hoạ tiết cũ dù cửa sổ đã đổi cỡ hoặc máy vừa xoay ngang. */
  beginStroke: (point, tool, px, radRows, radCols) =>
    set((s) => ({
      strokes: [...s.strokes, { tool, px, radRows, radCols, points: [point] }],
      redoStack: [],
    })),
  extendStroke: (point) =>
    set((s) => {
      if (!s.strokes.length) return s
      const last = s.strokes[s.strokes.length - 1]
      const next = { ...last, points: [...last.points, point] }
      return { strokes: [...s.strokes.slice(0, -1), next] }
    }),

  /** Bỏ nét vừa vẽ. Phải dựng lại lưới từ các nét còn lại chứ không "trừ
   *  ngược" được — nét sau có thể đã đè lên nét trước, tẩy thì xoá mất dấu. */
  undoStroke: () => set((s) => {
    if (s.strokes.length === 0) return s
    const strokes = s.strokes.slice(0, -1)
    return {
      strokes,
      redoStack: [...s.redoStack, s.strokes[s.strokes.length - 1]],
      grid: rebuildGrid(strokes, s.rowCount, s.cols),
    }
  }),

  /** Vẽ lại nét vừa bỏ. Cũng dựng lại lưới từ đầu vì cùng lý do như Undo: nét
   *  tẩy không "cộng ngược" được vào lưới hiện tại. */
  redoStroke: () => set((s) => {
    if (s.redoStack.length === 0) return s
    const strokes = [...s.strokes, s.redoStack[s.redoStack.length - 1]]
    return {
      strokes,
      redoStack: s.redoStack.slice(0, -1),
      grid: rebuildGrid(strokes, s.rowCount, s.cols),
    }
  }),

  /** Vùng đang nhìn thấy trong khung vẽ, để thanh cuộn và minimap vẽ theo.
   *  Đặt ở store vì canvas sở hữu phần cuộn còn hai thành phần kia nằm ngoài. */
  viewport: { scrollTop: 0, viewHeight: 0, contentHeight: 0 },
  setViewport: (viewport) => set({ viewport }),

  /** Bật để xem đúng lưới van sẽ gửi đi, thay vì nét mượt. */
  showGridPreview: false,
  toggleGridPreview: () => set((s) => ({ showGridPreview: !s.showGridPreview })),

  // ── Bút vẽ ─────────────────────────────────────────────────────────────────
  // Trước đây nét luôn rộng 1 ô và giá trị tô được quyết định bằng cách ĐẢO ô
  // đầu tiên chạm vào — nên đồ lại lên vùng đã vẽ là xoá nó đi, không đậm thêm.
  // Giờ tách hẳn bút và tẩy như Toolbar của whiteboard.
  brushTool: 'pen',
  setBrushTool: (brushTool) => set({ brushTool }),
  brushPx: CFG.DEFAULT_BRUSH_PX,
  setBrushPx: (brushPx) => set({ brushPx }),

  sending: false,
  lastSentAt: null,
  sendError: null,

  allOff: async () => {
    const { transportMode, status, bridgeOnline } = get()
    set({ sendError: null })
    try {
      if (transportMode === 'bridge') {
        if (!isBridgeSocketReady()) throw new Error('Mất kết nối tới server, đang thử kết nối lại')
        if (!bridgeOnline) throw new Error('Chưa có bridge nào kết nối tới màn nước')
        await sendCmdViaBridge(cmdAllOff())
      } else {
        if (status !== SOCKET_STATUS.CONNECTED || !directSocket?.sendText(JSON.stringify(cmdAllOff()))) {
          throw new Error('Chưa kết nối thiết bị')
        }
      }
    } catch (err) {
      set({ sendError: String(err.message || err) })
    }
  },

  sendPattern: async () => {
    const { grid, rowIntervalMs, valveCount, cols, transportMode, status, bridgeOnline } = get()

    // Chế độ bridge cần CẢ hai: socket tới server còn sống và có bridge online.
    // Chỉ tin mỗi bridgeOnline là sai — cờ đó do server đẩy xuống từ trước, nó
    // vẫn true sau khi socket đã rớt.
    const ready = transportMode === 'bridge'
      ? isBridgeSocketReady() && bridgeOnline
      : status === SOCKET_STATUS.CONNECTED && !!directSocket

    if (!ready) {
      set({
        sendError: transportMode === 'bridge' && !isBridgeSocketReady()
          ? 'Mất kết nối tới server, đang thử kết nối lại'
          : 'Chưa kết nối thiết bị',
      })
      return
    }

    const effectiveValveCount = valveCount ?? cols
    set({ sending: true, sendError: null })
    try {
      const rows = gridToOpenValveRows(grid, CFG.EMIT_BOTTOM_ROW_FIRST)
      const frames = buildAnimationFrames(rows, rowIntervalMs, effectiveValveCount, CFG.TRIM_EMPTY_ROWS)

      if (transportMode === 'bridge') {
        await sendFramesViaBridge(frames)
      } else {
        for (const frame of frames) {
          if (!directSocket.sendBinary(frame)) throw new Error('Mất kết nối khi đang gửi')
        }
      }
      set({ lastSentAt: Date.now() })
    } catch (err) {
      set({ sendError: String(err.message || err) })
    } finally {
      set({ sending: false })
    }
  },
}))
