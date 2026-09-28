import { useState } from 'react'
import { uploadMedia } from '../../../performance/perfApi.js'
import { usePerformanceStore } from '../../../store/performanceStore.js'
import { ColorInput, Field, Section, Select, Slider, pct } from './controls.jsx'
import { useConfigEditorContext } from './useConfigEditor.js'
import * as S from './styles.js'

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime'

/** Nền màu / ảnh / video cho màn show (`showBg`) hoặc trang ký (`signBg`). */
export default function BackgroundSection({ path, title, adminKey }) {
  const { get, set, setMany } = useConfigEditorContext()
  const eventId = usePerformanceStore((s) => s.eventId)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')
  const bg = get(path)

  const pick = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = ACCEPT
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setError('')
      setProgress(0)
      try {
        const res = await uploadMedia(eventId, adminKey, file, setProgress)
        setMany([[`${path}.url`, res.url], [`${path}.type`, res.kind]])
      } catch (err) {
        setError(err.message)
      } finally {
        setProgress(null)
      }
    }
    input.click()
  }

  return (
    <Section title={title}>
      <Select path={`${path}.type`} label="Loại nền" labels={{ color: 'Màu', image: 'Ảnh', video: 'Video' }} />
      <ColorInput path={`${path}.color`} label="Màu nền" />
      {bg.type !== 'color' && (
        <>
          <Field as="div" label="File">
            <button style={S.btnStyle('primary', progress !== null)} disabled={progress !== null} onClick={pick}>
              {progress !== null ? `Đang tải ${Math.round(progress * 100)}%` : '⬆ Tải ảnh/video'}
            </button>
          </Field>
          <Field label="Hoặc URL">
            <input type="text" value={bg.url} placeholder="https://…" onChange={(e) => set(`${path}.url`, e.target.value)} style={S.inputStyle} />
          </Field>
          <Select path={`${path}.fit`} label="Cách phủ" labels={{ cover: 'Phủ kín (cắt)', contain: 'Vừa khung', stretch: 'Kéo giãn' }} />
        </>
      )}
      <Slider path={`${path}.dim`} label="Làm tối" format={pct} />
      {error && <div style={{ color: S.C.danger, fontSize: 12 }}>{error}</div>}
    </Section>
  )
}
