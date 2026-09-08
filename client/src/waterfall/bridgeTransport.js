import { getSocket } from '../hooks/useSocket.js'

const ACK_TIMEOUT_MS = 8000

export function isBridgeSocketReady() {
  return !!getSocket()?.connected
}

export async function sendFramesViaBridge(frames) {
  const socket = getSocket()
  if (!socket?.connected) throw new Error('Chưa kết nối server')
  const ack = await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('waterfall:frames', frames)
  if (!ack?.ok) throw new Error(ack?.error || 'Server từ chối gửi hoạ tiết')
}

export async function sendCmdViaBridge(cmd) {
  const socket = getSocket()
  if (!socket?.connected) throw new Error('Chưa kết nối server')
  const ack = await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('waterfall:cmd', cmd)
  if (!ack?.ok) throw new Error(ack?.error || 'Server từ chối lệnh')
}

export function attachWaterfallBridgeListeners(socket, { onStatus, onBridgeOnline } = {}) {
  socket.on('waterfall:status', (status) => onStatus?.(status))
  socket.on('waterfall:bridge-online', ({ online }) => onBridgeOnline?.(online))
}
