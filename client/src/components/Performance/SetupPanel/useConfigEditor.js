import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { PERF_CONFIG as P } from '../../../performance/config.js'
import { emitAck } from '../../../performance/perfSocket.js'
import { getIn, usePerformanceStore } from '../../../store/performanceStore.js'

export const ConfigEditorContext = createContext(null)

export function useConfigEditorContext() {
  return useContext(ConfigEditorContext)
}

/** Sửa config: cập nhật store NGAY (preview phản hồi tức thì), gửi server sau
 *  khoảng lặng CONFIG_SEND_DEBOUNCE_MS. Ack trả config đã sanitize — chỉ áp
 *  lại nếu từ lúc gửi không có sửa đổi mới hơn, nếu không slider đang kéo sẽ
 *  giật về giá trị cũ. */
export function useConfigEditor(socketRef) {
  const config = usePerformanceStore((s) => s.config)
  const schema = usePerformanceStore((s) => s.schema)
  const [saveState, setSaveState] = useState('saved') // saved|pending|saving|error
  const seqRef = useRef(0)
  const timerRef = useRef(0)

  const flush = useCallback(async () => {
    const socket = socketRef.current
    if (!socket?.connected) { setSaveState('error'); return }
    const sentSeq = seqRef.current
    setSaveState('saving')
    const res = await emitAck(socket, 'perf:config', { config: usePerformanceStore.getState().config }, P.ADMIN_ACK_TIMEOUT_MS)
    if (sentSeq !== seqRef.current) return // đã có sửa mới, lần gửi sau lo
    if (res?.ok) {
      usePerformanceStore.getState().setConfig(res.config)
      setSaveState('saved')
    } else {
      setSaveState('error')
    }
  }, [socketRef])

  const set = useCallback((path, value) => {
    seqRef.current++
    usePerformanceStore.getState().setConfigPath(path, value)
    setSaveState('pending')
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flush, P.CONFIG_SEND_DEBOUNCE_MS)
  }, [flush])

  /** Nhiều field một lần (vd preset khung xuất) — một lần gửi. */
  const setMany = useCallback((entries) => {
    seqRef.current++
    const st = usePerformanceStore.getState()
    for (const [path, value] of entries) st.setConfigPath(path, value)
    setSaveState('pending')
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flush, P.CONFIG_SEND_DEBOUNCE_MS)
  }, [flush])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const get = useCallback((path) => getIn(usePerformanceStore.getState().config, path), [])
  const leaf = useCallback((path) => getIn(schema, path), [schema])

  return { config, schema, set, setMany, get, leaf, saveState, retry: flush }
}
