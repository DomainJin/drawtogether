import { useCallback, useEffect, useRef, useState } from 'react'
import { getSocket } from '../../hooks/useSocket.js'
import { IMAGE_CONFIG as CFG } from '../../whiteboard/config.js'
import {
  buildImageStroke, fitImageToView, moveRect, resizeFromCorner,
  validateImageFile, viewportInCanvas,
} from '../../whiteboard/imagePlacement.js'
import { encodeImageFile, loadImageElement } from '../../whiteboard/imageEncode.js'
import { drawImageStroke, enqueueRender } from '../../whiteboard/renderQueue.js'

/** Luồng upload ảnh: chọn/dán/kéo thả → nén → căn chỗ → đặt lên bảng.
 *
 *  Ảnh KHÔNG được vẽ ngay khi chọn. Bảng 4000px mà ảnh rơi vào giữa khung nhìn
 *  với cỡ đoán mò thì hầu như lúc nào cũng phải dời lại, mà một khi đã vẽ lên
 *  canvas thì không dời được nữa — chỉ còn Undo. Nên có một bước "đang đặt":
 *  kéo để dời, kéo góc để đổi cỡ, bấm Đặt ảnh mới chốt.
 *
 *  `enabled` = false khi đang ở màn nước: dán/kéo thả ảnh lúc đó không được
 *  rơi vào bảng chung đang bị ẩn. */
export function useImageUpload({ canvasRef, containerRef, camRef, enabled = true }) {
  const [pending, setPending] = useState(null)   // { src, rect }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pendingRef = useRef(null)
  pendingRef.current = pending

  const beginFromFile = useCallback(async (file) => {
    const invalid = validateImageFile(file)
    if (invalid) { setError(invalid); return }

    setError('')
    setBusy(true)
    try {
      const encoded = await encodeImageFile(file)
      const el = containerRef.current
      const view = viewportInCanvas(camRef.current, el?.clientWidth ?? window.innerWidth, el?.clientHeight ?? window.innerHeight)
      setPending({ src: encoded.src, rect: fitImageToView(encoded.w, encoded.h, view) })
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }, [containerRef, camRef])

  const openPicker = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = CFG.ACCEPT_TYPES.join(',')
    input.onchange = () => { if (input.files?.[0]) beginFromFile(input.files[0]) }
    input.click()
  }, [beginFromFile])

  // Cả dời lẫn đổi cỡ đều tính từ khung LÚC BẮT ĐẦU KÉO + tổng độ lệch, không
  // cộng dồn từng bước: cộng dồn thì mỗi lần bị chặn ở mép bảng lại mất một
  // ít, kéo ra rồi kéo vào là ảnh lệch khỏi con trỏ.
  const moveBy = useCallback((dx, dy, startRect) => {
    setPending((p) => p && { ...p, rect: moveRect(startRect, dx, dy, camRef.current.zoom) })
  }, [camRef])

  const resizeBy = useCallback((dx, dy, startRect) => {
    setPending((p) => p && { ...p, rect: resizeFromCorner(startRect, dx, dy, camRef.current.zoom) })
  }, [camRef])

  const cancel = useCallback(() => { setPending(null); setError('') }, [])

  const confirm = useCallback(async () => {
    const p = pendingRef.current
    if (!p) return
    const socket = getSocket()
    // Không có socket thì ảnh chỉ nằm trên máy mình, tải lại trang là mất và
    // người khác không bao giờ thấy — giữ nguyên bước đặt để thử lại.
    if (!socket?.connected) {
      setError('Mất kết nối server — chưa đặt được ảnh, thử lại khi có mạng')
      return
    }
    const stroke = buildImageStroke(p.rect, p.src)
    socket.emit('draw:stroke', stroke)
    setPending(null)
    setError('')

    // Vẽ lên canvas của mình qua cùng hàng đợi với stroke từ xa, bằng chính
    // data URL đã gửi đi: thứ mình thấy là đúng thứ người khác nhận.
    enqueueRender(async () => {
      const img = await loadImageElement(stroke.src)
      const ctx = canvasRef.current?.getContext('2d', { willReadFrequently: true })
      if (ctx) drawImageStroke(ctx, stroke, img)
    })
  }, [canvasRef])

  // Dán ảnh (Ctrl+V) và kéo thả file vào bảng — cùng đi vào beginFromFile.
  useEffect(() => {
    if (!enabled) return
    const el = containerRef.current

    const onPaste = (e) => {
      if (e.target?.matches?.('input,textarea')) return
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'))
      const file = item?.getAsFile()
      if (!file) return
      e.preventDefault()
      beginFromFile(file)
    }
    const onDragOver = (e) => {
      if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault()
    }
    const onDrop = (e) => {
      const file = e.dataTransfer?.files?.[0]
      if (!file) return
      e.preventDefault()
      beginFromFile(file)
    }
    const onKey = (e) => {
      if (!pendingRef.current) return
      if (e.key === 'Escape') cancel()
      if (e.key === 'Enter') { e.preventDefault(); confirm() }
    }

    window.addEventListener('paste', onPaste)
    window.addEventListener('keydown', onKey)
    el?.addEventListener('dragover', onDragOver)
    el?.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('keydown', onKey)
      el?.removeEventListener('dragover', onDragOver)
      el?.removeEventListener('drop', onDrop)
    }
  }, [enabled, containerRef, beginFromFile, cancel, confirm])

  // Rời bảng chung (sang màn nước) thì bỏ ảnh đang đặt dở.
  useEffect(() => { if (!enabled) setPending(null) }, [enabled])

  // Lỗi tự tắt: không có gì khác xoá nó cho tới lần upload sau.
  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(''), CFG.ERROR_TOAST_MS)
    return () => clearTimeout(t)
  }, [error])

  return { pending, busy, error, openPicker, moveBy, resizeBy, confirm, cancel }
}
