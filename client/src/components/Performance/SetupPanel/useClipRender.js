import { useCallback, useRef, useState } from 'react'
import { downloadBlob, fileStamp } from '../../../performance/render/exportImages.js'
import { usePerformanceStore } from '../../../store/performanceStore.js'

export const QUALITIES = {
  medium: 'Vừa (file nhẹ)',
  high: 'Cao',
  very_high: 'Rất cao (file nặng)',
}

/** Dựng clip: trạng thái + tiến độ + ảnh xem trước + huỷ. Xong thì tự tải file. */
export function useClipRender(previewRef) {
  const [state, setState] = useState({ status: 'idle', progress: 0, error: '', warning: '', result: null })
  const abortRef = useRef(null)

  const drawPreview = useCallback((canvas) => {
    const p = previewRef.current
    if (!p) return
    const ctx = p.getContext('2d')
    ctx.drawImage(canvas, 0, 0, p.width, p.height)
  }, [previewRef])

  const start = useCallback(async ({ sigs, signUrl, mode, spanSeconds, fps, quality, includeQr }) => {
    const { config, event } = usePerformanceStore.getState()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setState({ status: 'running', progress: 0, error: '', warning: '', result: null })
    try {
      // Nạp lười: bộ mã hoá video (mediabunny) nặng — trang ký trên điện thoại
      // khán giả không được phải tải nó.
      const { renderClip } = await import('../../../performance/render/renderClip.js')
      const res = await renderClip({
        sigs,
        config,
        signUrl,
        options: { mode, spanMs: spanSeconds * 1000, fps, quality, includeQr },
        onProgress: (progress) => setState((s) => ({ ...s, progress })),
        onPreview: drawPreview,
        onWarning: (warning) => setState((s) => ({ ...s, warning })),
        signal: ctrl.signal,
      })
      downloadBlob(res.blob, `clip-${event?.id ?? 'su-kien'}-${fileStamp(Date.now())}.${res.ext.replace(/^\./, '')}`)
      setState((s) => ({ ...s, status: 'done', progress: 1, result: res }))
    } catch (err) {
      const cancelled = err.name === 'AbortError'
      setState((s) => ({ ...s, status: cancelled ? 'idle' : 'error', error: cancelled ? '' : err.message || String(err) }))
    } finally {
      abortRef.current = null
    }
  }, [drawPreview])

  const cancel = useCallback(() => abortRef.current?.abort(), [])

  return { ...state, start, cancel }
}
