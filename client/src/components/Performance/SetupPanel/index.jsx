import { useState } from 'react'
import { usePerformanceStore } from '../../../store/performanceStore.js'
import OutputSection from './OutputSection.jsx'
import BackgroundSection from './BackgroundSection.jsx'
import { InkSection, NameSection } from './StyleSections.jsx'
import { EffectSection, LayoutSection, QrSection } from './MotionSections.jsx'
import SignPageSection from './SignPageSection.jsx'
import SignatureManager from './SignatureManager.jsx'
import * as S from './styles.js'

const TABS = [
  { key: 'screen', label: 'Màn hình' },
  { key: 'style', label: 'Chữ ký' },
  { key: 'motion', label: 'Hiệu ứng' },
  { key: 'sign', label: 'Trang ký' },
  { key: 'manage', label: 'Quản lý' },
]

/** Cột cài đặt bên trái trang setup. Phải nằm trong ConfigEditorContext. */
export default function SetupPanel({ adminKey, socketRef, stageRef, fontVersion }) {
  const [tab, setTab] = useState('screen')
  const pending = usePerformanceStore((s) => s.signatures.filter((x) => x.status === 'pending').length)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 2, padding: 6, background: '#0c0f15', borderBottom: `1px solid ${S.C.border}` }}>
        {TABS.map((t) => (
          <button key={t.key} style={S.tabStyle(tab === t.key)} onClick={() => setTab(t.key)}>
            {t.label}{t.key === 'manage' && pending > 0 ? ` (${pending})` : ''}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {tab === 'screen' && (
          <>
            <OutputSection />
            <BackgroundSection path="showBg" title="Nền màn show" adminKey={adminKey} />
            <QrSection />
          </>
        )}
        {tab === 'style' && (
          <>
            <InkSection />
            <NameSection />
          </>
        )}
        {tab === 'motion' && (
          <>
            <LayoutSection />
            <EffectSection />
          </>
        )}
        {tab === 'sign' && (
          <>
            <SignPageSection />
            <BackgroundSection path="signBg" title="Nền trang ký" adminKey={adminKey} />
          </>
        )}
        {tab === 'manage' && <SignatureManager socketRef={socketRef} stageRef={stageRef} fontVersion={fontVersion} />}
      </div>
    </div>
  )
}
