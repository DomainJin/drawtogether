import { useEffect, useRef } from 'react'
import { connectPerf } from '../performance/perfSocket.js'
import { usePerformanceStore } from '../store/performanceStore.js'

const JOIN_ERRORS = {
  not_found: 'Không tìm thấy sự kiện',
  bad_key: 'Sai khoá quản trị',
  bad_request: 'Yêu cầu không hợp lệ',
}

/** Nối socket Performance cho một vai trò, đổ mọi push event vào store.
 *  @returns {React.MutableRefObject<import('socket.io-client').Socket|null>} */
export function usePerfEvent(eventId, role, adminKey = '') {
  const socketRef = useRef(null)

  useEffect(() => {
    if (!eventId || (role === 'admin' && !adminKey)) return undefined
    const st = usePerformanceStore.getState()
    st.reset(eventId)

    const conn = connectPerf({
      eventId,
      role,
      adminKey,
      onJoined: (res) => usePerformanceStore.getState().applyJoin(res),
      onError: (code) => usePerformanceStore.getState().setError(JOIN_ERRORS[code] || code),
      onConnection: (v) => usePerformanceStore.getState().setConnected(v),
      handlers: {
        'perf:config': ({ config }) => usePerformanceStore.getState().setConfig(config),
        'perf:sig:add': (sig) => usePerformanceStore.getState().addSignature(sig),
        'perf:sig:update': (u) => usePerformanceStore.getState().updateSignature(u),
        'perf:sig:delete': (d) => usePerformanceStore.getState().removeSignature(d),
        'perf:sig:clear': () => usePerformanceStore.getState().clearSignatures(),
      },
    })
    socketRef.current = conn.socket
    return () => {
      conn.close()
      socketRef.current = null
    }
  }, [eventId, role, adminKey])

  return socketRef
}
