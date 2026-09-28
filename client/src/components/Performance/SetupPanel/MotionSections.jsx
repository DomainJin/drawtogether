import { Section, Select, Slider, TextInput, Toggle, ms, pct } from './controls.jsx'
import { useConfigEditorContext } from './useConfigEditor.js'

export function LayoutSection() {
  const { config } = useConfigEditorContext()
  const grid = config.layout.mode === 'grid'
  return (
    <Section title="Sắp xếp chữ ký">
      <Select path="layout.mode" label="Chế độ" labels={{ grid: 'Tĩnh — xếp lưới', float: 'Động — bay lơ lửng' }} />
      <Slider path="layout.maxVisible" label="Số chữ ký hiện" />
      {grid ? (
        <>
          <Slider path="layout.gap" label="Khoảng cách" format={pct} />
          <Slider path="layout.padding" label="Lề" format={pct} />
        </>
      ) : (
        <>
          <Slider path="layout.floatSize" label="Cỡ chữ ký" format={pct} />
          <Slider path="layout.floatSpeed" label="Tốc độ bay" format={(v) => v.toFixed(3)} />
        </>
      )}
    </Section>
  )
}

export function EffectSection() {
  const { config } = useConfigEditorContext()
  return (
    <Section title="Hiệu ứng chữ ký mới">
      <Select path="effect.entrance" label="Xuất hiện" labels={{ draw: 'Viết tay', fade: 'Mờ dần', zoom: 'Phóng to', fly: 'Bay lên' }} />
      <Slider path="effect.entranceMs" label="Thời lượng" format={ms} />
      <Toggle path="effect.spotlight" label="Spotlight" />
      {config.effect.spotlight && (
        <>
          <Slider path="effect.spotlightMs" label="Giữ spotlight" format={ms} />
          <Slider path="effect.spotlightScale" label="Cỡ spotlight" format={pct} />
        </>
      )}
    </Section>
  )
}

export function QrSection() {
  const { config } = useConfigEditorContext()
  return (
    <Section title="QR trên màn show">
      <Toggle path="qr.show" label="Hiện QR" />
      {config.qr.show && (
        <>
          <Select path="qr.corner" label="Góc" labels={{ tl: 'Trên trái', tr: 'Trên phải', bl: 'Dưới trái', br: 'Dưới phải' }} />
          <Slider path="qr.size" label="Cỡ QR" format={pct} />
          <TextInput path="qr.caption" label="Chú thích" />
        </>
      )}
    </Section>
  )
}
