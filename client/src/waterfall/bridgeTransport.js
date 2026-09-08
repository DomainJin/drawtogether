import { getSocket } from '../hooks/useSocket.js'
import { WATERFALL_CONFIG as CFG } from './config.js'

const ACK_TIMEOUT_MS = 8000

export function isBridgeSocketReady() {
  return !!getSocket()?.connected
}

/** Gửi hoạ tiết tới bridge, cắt thành nhiều gói nhỏ.
 *
 *  Cả mảng frames KHÔNG gửi được trong một emit: mỗi Uint8Array là một binary
 *  attachment và socket.io-parser chặn ở 10 attachment/gói (CFG giải thích rõ).
 *  Vượt ngưỡng thì server đóng thẳng socket, không có lỗi nào trả về.
 *
 *  Await tuần tự chứ không Promise.all — thứ tự frame phải giữ nguyên vì frame
 *  config/reset/start nằm ở đầu và thiết bị xử lý theo đúng thứ tự nhận. */
export async function sendFramesViaBridge(frames) {
  const socket = getSocket()
  if (!socket?.connected) throw new Error('Chưa kết nối server')

  const size = CFG.MAX_FRAMES_PER_PACKET
  for (let i = 0; i < frames.length; i += size) {
    const chunk = frames.slice(i, i + size)
    const ack = await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('waterfall:frames', chunk)
    if (!ack?.ok) throw new Error(ack?.error || 'Server từ chối gửi hoạ tiết')
  }
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
