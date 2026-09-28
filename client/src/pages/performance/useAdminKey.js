import { useEffect, useState } from 'react'
import { loadAdminKey, saveAdminKey } from '../../performance/links.js'

/** Khoá admin: lấy từ ?key= (mở setup trên máy khác) → lưu → xoá khỏi URL
 *  (không để lộ khi chụp màn hình/chia sẻ tab); không có thì lấy localStorage. */
export function useAdminKey(eventId) {
  const [key, setKeyState] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('key')
    if (fromUrl) {
      saveAdminKey(eventId, fromUrl)
      return fromUrl
    }
    return loadAdminKey(eventId)
  })

  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.has('key')) {
      url.searchParams.delete('key')
      window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    }
  }, [])

  const setKey = (k) => {
    saveAdminKey(eventId, k)
    setKeyState(k)
  }
  return [key, setKey]
}
