import { Palette, Plus, Settings, Shirt, Sun } from 'lucide-react'
import { useCallback, useState, type ReactNode } from 'react'
import { InstallBanner } from './components/InstallBanner'
import { UpdateBanner } from './components/UpdateBanner'
import { prefs } from './lib/platform'
import { AddSheet } from './screens/AddSheet'
import { ClosetScreen } from './screens/ClosetScreen'
import { GarmentSheet } from './screens/GarmentSheet'
import { SettingsSheet } from './screens/SettingsSheet'
import { SpectrumScreen } from './screens/SpectrumScreen'
import { TodayScreen } from './screens/TodayScreen'

type Tab = 'today' | 'closet' | 'spectrum'
const TABS: readonly Tab[] = ['today', 'closet', 'spectrum']

export default function App() {
  const [tab, setTabState] = useState<Tab>(() => {
    const saved = prefs.get('tab')
    return TABS.includes(saved as Tab) ? (saved as Tab) : 'closet'
  })
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const setTab = (t: Tab) => {
    setTabState(t)
    prefs.set('tab', t)
    window.scrollTo({ top: 0 })
  }
  const openAdd = useCallback(() => setAdding(true), [])
  const closeAdd = useCallback(() => setAdding(false), [])
  const closeGarment = useCallback(() => setOpenId(null), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  return (
    <div className="app">
      <header className="topbar">
        <span className="wordmark">Drape</span>
        <button type="button" className="icon-btn" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
          <Settings size={22} aria-hidden="true" />
        </button>
      </header>

      <main className="content">
        <UpdateBanner />
        <InstallBanner />
        {tab === 'today' && <TodayScreen onAdd={openAdd} />}
        {tab === 'closet' && <ClosetScreen onOpen={setOpenId} onAdd={openAdd} />}
        {tab === 'spectrum' && <SpectrumScreen onOpen={setOpenId} />}
      </main>

      <nav className="tabbar" aria-label="Main">
        <TabButton label="Today" icon={<Sun size={22} aria-hidden="true" />} active={tab === 'today'} onClick={() => setTab('today')} />
        <TabButton label="Closet" icon={<Shirt size={22} aria-hidden="true" />} active={tab === 'closet'} onClick={() => setTab('closet')} />
        <button type="button" className="tab-plus" aria-label="Add a piece" onClick={openAdd}>
          <Plus size={28} aria-hidden="true" />
        </button>
        <TabButton label="Spectrum" icon={<Palette size={22} aria-hidden="true" />} active={tab === 'spectrum'} onClick={() => setTab('spectrum')} />
      </nav>

      {adding && <AddSheet onClose={closeAdd} />}
      {/* key: a different piece gets a fresh panel, never the previous piece's edit form */}
      {openId && <GarmentSheet key={openId} id={openId} onClose={closeGarment} onOpen={setOpenId} />}
      {settingsOpen && <SettingsSheet onClose={closeSettings} />}
    </div>
  )
}

function TabButton(props: { label: string; icon: ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={props.active ? 'tab on' : 'tab'} aria-current={props.active ? 'page' : undefined} onClick={props.onClick}>
      {props.icon}
      <span>{props.label}</span>
    </button>
  )
}
