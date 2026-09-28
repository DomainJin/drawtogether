import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/** PNG data URL của mã QR. Sinh ở client, không cần internet (sự kiện hay chạy
 *  LAN kín). Mức sửa lỗi M: chịu được vết bẩn/loá sáng trên màn LED. */
export function useQrDataUrl(text, px = 512) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!text) { setUrl(''); return undefined }
    let alive = true
    QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 2, width: px, color: { dark: '#000000', light: '#ffffff' } })
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(''))
    return () => { alive = false }
  }, [text, px])
  return url
}
