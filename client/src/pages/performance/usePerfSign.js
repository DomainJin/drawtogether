import { useCallback, useState } from 'react'
import { nanoid } from 'nanoid'
import { PERF_CONFIG as P, LS_KEYS } from '../../performance/config.js'
import { encodeStrokes } from '../../performance/strokeCodec.js'
import { emitWithRetry } from '../../performance/perfSocket.js'
import { lsGet, lsSet } from '../../performance/links.js'

const SUBMIT_ERRORS = {
  timeout: 'Mạng chập chờn, chưa gửi được. Thử lại nhé!',
  too_fast: 'Chậm lại một chút rồi gửi lại nhé',
  name_required: 'Vui lòng nhập tên',
  empty: 'Bạn chưa ký',
  event_full: 'Sự kiện đã đủ chữ ký',
  not_joined: 'Đang kết nối lại, thử lại sau giây lát',
  too_many_points: 'Chữ ký quá dài, hãy ký gọn hơn',
  too_many_strokes: 'Chữ ký quá nhiều nét, hãy ký gọn hơn',
}

/** Gửi chữ ký: đơn giản hoá nét, gắn cid (retry không tạo bản trùng), timeout
 *  + thử lại có giới hạn. */
export function usePerfSign(eventId, socketRef) {
  const [phase, setPhase] = useState(() => (lsGet(LS_KEYS.signed(eventId)) ? 'done' : 'idle')) // idle|sending|done
  const [error, setError] = useState('')

  const submit = useCallback(async ({ strokes, name, color }) => {
    const socket = socketRef.current
    if (!socket?.connected) { setError(SUBMIT_ERRORS.not_joined); return false }
    setPhase('sending')
    setError('')
    const payload = {
      cid: nanoid(16),
      name,
      color,
      aspect: P.SIGN_PAD_ASPECT,
      strokes: encodeStrokes(strokes, P.SIMPLIFY_EPSILON, P.SIGN_PAD_ASPECT),
    }
    const res = await emitWithRetry(socket, 'perf:sign', payload, {
      timeoutMs: P.SUBMIT_TIMEOUT_MS,
      retries: P.SUBMIT_RETRIES,
    })
    if (res?.ok) {
      lsSet(LS_KEYS.signed(eventId), '1')
      setPhase('done')
      return true
    }
    setError(SUBMIT_ERRORS[res?.error] || 'Gửi không thành công, thử lại nhé')
    setPhase('idle')
    return false
  }, [eventId, socketRef])

  const again = useCallback(() => { setPhase('idle'); setError('') }, [])

  return { phase, error, submit, again }
}
