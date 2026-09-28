import { useCallback, useState } from 'react'
import { PERF_CONFIG as P } from '../../../performance/config.js'
import { emitAck } from '../../../performance/perfSocket.js'
import {
  downloadBlob, fileStamp, signaturePng, signatureFileName, signaturesZip,
} from '../../../performance/render/exportImages.js'
import { usePerformanceStore } from '../../../store/performanceStore.js'

const ERRORS = { timeout: 'Server không phản hồi', forbidden: 'Mất quyền quản trị', not_found: 'Chữ ký không còn' }

/** Thao tác quản lý chữ ký. Store chỉ đổi khi server phát lại sự kiện (nguồn
 *  sự thật là server) — mọi màn show/setup khác thấy cùng một trạng thái. */
export function useSignatureActions(socketRef, stageRef) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const call = useCallback(async (event, payload) => {
    setError('')
    const socket = socketRef.current
    if (!socket?.connected) { setError('Mất kết nối server'); return null }
    const res = await emitAck(socket, event, payload, P.ADMIN_ACK_TIMEOUT_MS)
    if (!res?.ok) setError(ERRORS[res?.error] || res?.error || 'Lỗi')
    return res
  }, [socketRef])

  const setStatus = useCallback((id, status) => call('perf:sig:status', { id, status }), [call])
  const remove = useCallback((id) => call('perf:sig:delete', { id }), [call])
  const clearAll = useCallback(() => call('perf:sig:clear', {}), [call])

  const downloadOne = useCallback(async (sig, index) => {
    const { config } = usePerformanceStore.getState()
    downloadBlob(await signaturePng(sig, config), signatureFileName(sig, index))
  }, [])

  const downloadZip = useCallback(async (sigs) => {
    if (!sigs.length) return
    const { config, event } = usePerformanceStore.getState()
    setError('')
    try {
      setBusy('zip 0%')
      const blob = await signaturesZip(sigs, config, (d, n) => setBusy(`zip ${Math.round((d / n) * 100)}%`))
      downloadBlob(blob, `chu-ky-${event?.id ?? 'su-kien'}-${fileStamp(Date.now())}.zip`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }, [])

  const downloadSnapshot = useCallback(async () => {
    const { event } = usePerformanceStore.getState()
    setError('')
    try {
      setBusy('snapshot')
      const blob = await stageRef.current.snapshot()
      downloadBlob(blob, `man-show-${event?.id ?? 'su-kien'}-${fileStamp(Date.now())}.png`)
    } catch (err) {
      // Nền video/ảnh từ URL ngoài không cho CORS → canvas bị khoá.
      setError(err.name === 'SecurityError' ? 'Nền từ URL ngoài chặn chụp ảnh — hãy upload nền lên server' : err.message)
    } finally {
      setBusy('')
    }
  }, [stageRef])

  return { busy, error, setStatus, remove, clearAll, downloadOne, downloadZip, downloadSnapshot }
}
