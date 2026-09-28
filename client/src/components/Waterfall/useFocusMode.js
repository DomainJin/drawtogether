import { useCallback, useEffect, useRef, useState } from 'react'
import { WATERFALL_UI as UI } from '../../waterfall/config.js'
import { useWaterfallStore } from '../../store/waterfallStore.js'
import {
  enterFullscreen, exitFullscreen, fullscreenElement, FULLSCREEN_EVENTS,
  isIOS, isStandalone, needsHomeScreenForFullscreen, shouldUseNativeFullscreen,
} from '../../waterfall/fullscreen.js'

/** Bật/tắt chế độ toàn màn hình vẽ.
 *
 *  Hai lớp: ẩn giao diện thừa (luôn làm được) + Fullscreen API của trình duyệt
 *  để mất luôn thanh địa chỉ — CHỈ trên máy tính. iPad/iPhone bỏ lớp thứ hai
 *  (Safari bật hộp hỏi liên tục, xem shouldUseNativeFullscreen); toàn màn hình
 *  thật ở đó là mở từ Màn hình chính. Trình duyệt tự thoát
 *  toàn màn hình (vuốt, phím Esc) thì chế độ cũng tắt theo — không để lại
 *  trạng thái "đang phóng to" mà màn hình đã thu về. */
export function useFocusMode() {
  const focusMode = useWaterfallStore((s) => s.focusMode)
  const setFocusMode = useWaterfallStore((s) => s.setFocusMode)
  /** Chỉ đồng bộ theo sự kiện trình duyệt khi CHÍNH ta đã vào fullscreen —
   *  máy không hỗ trợ thì focus mode vẫn sống mà không có sự kiện nào. */
  const nativeRef = useRef(false)
  /** Nhắc "Thêm vào Màn hình chính" — hiện tạm khi bấm ⛶ trên Safari iPad,
   *  nơi ⛶ chỉ ẩn được giao diện chứ không bỏ được thanh Safari. */
  const [homeScreenHint, setHomeScreenHint] = useState(false)
  const hintTimerRef = useRef(null)

  useEffect(() => () => clearTimeout(hintTimerRef.current), [])

  useEffect(() => {
    const onChange = () => {
      if (nativeRef.current && !fullscreenElement(document)) {
        nativeRef.current = false
        setFocusMode(false)
      }
    }
    for (const ev of FULLSCREEN_EVENTS) document.addEventListener(ev, onChange)
    return () => {
      for (const ev of FULLSCREEN_EVENTS) document.removeEventListener(ev, onChange)
    }
  }, [setFocusMode])

  const toggleFocusMode = useCallback(async () => {
    if (useWaterfallStore.getState().focusMode) {
      nativeRef.current = false
      setFocusMode(false)
      await exitFullscreen(document)
      return
    }
    setFocusMode(true)
    const env = { ios: isIOS(navigator), standalone: isStandalone(window) }
    if (needsHomeScreenForFullscreen(env)) {
      setHomeScreenHint(true)
      clearTimeout(hintTimerRef.current)
      hintTimerRef.current = setTimeout(() => setHomeScreenHint(false), UI.HOME_SCREEN_HINT_MS)
    }
    nativeRef.current = shouldUseNativeFullscreen(env) && await enterFullscreen(document.documentElement)
  }, [setFocusMode])

  const dismissHint = useCallback(() => {
    clearTimeout(hintTimerRef.current)
    setHomeScreenHint(false)
  }, [])

  return { focusMode, toggleFocusMode, homeScreenHint, dismissHint }
}
