import { ColorInput, Section, Select, Slider, Toggle, pct } from './controls.jsx'
import { useConfigEditorContext } from './useConfigEditor.js'

const INK_MODES = { solid: 'Một màu', gradient: 'Chuyển 2 màu', rainbow: 'Cầu vồng', signer: 'Người ký tự chọn' }
const NAME_STYLES = { plain: 'Thường', gradient: 'Chuyển màu', outline: 'Viền', shadow: 'Nổi 3D', neon: 'Neon phát sáng' }

export function InkSection() {
  const { config } = useConfigEditorContext()
  const mode = config.ink.mode
  return (
    <Section title="Nét chữ ký">
      <Select path="ink.mode" label="Kiểu màu" labels={INK_MODES} />
      {mode !== 'rainbow' && <ColorInput path="ink.color" label={mode === 'signer' ? 'Màu mặc định' : 'Màu 1'} />}
      {mode === 'gradient' && <ColorInput path="ink.color2" label="Màu 2" />}
      <Slider path="ink.width" label="Độ dày nét" format={(v) => v.toFixed(3)} />
      <Slider path="ink.glow" label="Phát sáng" format={pct} />
      {config.ink.glow > 0 && <ColorInput path="ink.glowColor" label="Màu sáng" />}
    </Section>
  )
}

export function NameSection() {
  const { config } = useConfigEditorContext()
  const n = config.name
  const twoColors = n.style !== 'plain'
  const color2Label = { gradient: 'Màu dưới', outline: 'Màu viền', shadow: 'Màu khối', neon: 'Màu hào quang' }[n.style]
  return (
    <Section title="Tên người ký (WordArt)">
      <Toggle path="name.show" label="Hiện tên" />
      {n.show && (
        <>
          <Select path="name.font" label="Font" />
          <Select path="name.style" label="Kiểu chữ" labels={NAME_STYLES} />
          <ColorInput path="name.color" label="Màu chữ" />
          {twoColors && <ColorInput path="name.color2" label={color2Label} />}
          <Slider path="name.size" label="Cỡ chữ" format={pct} />
        </>
      )}
    </Section>
  )
}
