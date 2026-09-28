import { useEffect, useState } from 'react'
import { isLoopbackUrl, originForHost, signUrl } from '../../../performance/links.js'
import { lanAddresses } from '../../../performance/perfApi.js'
import { useQrDataUrl } from '../useQrDataUrl.js'
import { useConfigEditorContext } from './useConfigEditor.js'
import * as S from './styles.js'

/** QR + link ký cho khán giả, chọn IP LAN làm gốc link.
 *  Mở setup bằng localhost thì link mặc định là localhost — điện thoại khán giả
 *  không vào được. Server liệt kê IP LAN của nó để kỹ thuật chọn một cú. */
export default function LinkCard({ eventId }) {
  const { config, set } = useConfigEditorContext()
  const [ips, setIps] = useState([])
  const [copied, setCopied] = useState(false)
  useEffect(() => { lanAddresses().then(setIps) }, [])

  const link = signUrl(eventId, config.publicBaseUrl, window.location.origin)
  const qr = useQrDataUrl(link, 320)
  const loopback = isLoopbackUrl(link)
  const options = ips.map((ip) => originForHost(ip, window.location))

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* http không phải localhost → clipboard API bị chặn; người dùng tự chọn text */ }
  }

  return (
    <div style={{ ...S.sectionStyle, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      {qr && <img src={qr} alt="QR ký tên" style={{ width: 120, height: 120, borderRadius: 8, background: '#fff', flexShrink: 0 }} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, flex: 1 }}>
        <div style={S.sectionTitleStyle}>Link ký tên cho khán giả</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input readOnly value={link} onFocus={(e) => e.target.select()} style={{ ...S.inputStyle, fontFamily: 'monospace' }} />
          <button style={S.btnStyle()} onClick={copy}>{copied ? 'Đã copy' : 'Copy'}</button>
          <a href={link} target="_blank" rel="noreferrer" style={{ ...S.btnStyle(), display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Mở ↗</a>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ ...S.labelStyle, fontSize: 12, whiteSpace: 'nowrap' }}>Gốc link</span>
          <select value={config.publicBaseUrl} onChange={(e) => set('publicBaseUrl', e.target.value)} style={S.inputStyle}>
            <option value="">Theo trang này ({window.location.origin})</option>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
            {config.publicBaseUrl && !options.includes(config.publicBaseUrl) && <option value={config.publicBaseUrl}>{config.publicBaseUrl}</option>}
          </select>
        </div>
        {loopback && (
          <div style={{ color: S.C.danger, fontSize: 12, fontWeight: 600 }}>
            ⚠ Link đang là localhost — điện thoại khán giả không mở được. Chọn IP LAN ở "Gốc link".
          </div>
        )}
      </div>
    </div>
  )
}
