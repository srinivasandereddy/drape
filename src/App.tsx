import { Palette, Plus, Settings, Shirt, Sun } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { InstallBanner } from './components/InstallBanner'
import { useToast } from './components/toastContext'
import { UpdateBanner } from './components/UpdateBanner'
import { useAccount, type Account } from './lib/account'
import { reload } from './lib/closet'
import { discardLegacy, importLegacy, legacyPieceCount } from './lib/db'
import { prefs } from './lib/platform'
import { useProfile } from './lib/profile'
import { AddSheet } from './screens/AddSheet'
import { ClosetScreen } from './screens/ClosetScreen'
import { GarmentSheet } from './screens/GarmentSheet'
import { ProfileWizard } from './screens/ProfileWizard'
import { QuickAddSheet } from './screens/QuickAddSheet'
import { SettingsSheet } from './screens/SettingsSheet'
import { SignInScreen } from './screens/SignInScreen'
import { SpectrumScreen } from './screens/SpectrumScreen'
import { TodayScreen } from './screens/TodayScreen'

type Tab = 'today' | 'closet' | 'spectrum'
const TABS: readonly Tab[] = ['today', 'closet', 'spectrum']

export default function App() {
  const account = useAccount()
  if (!account) return <SignInScreen />
  // A new key per account: nothing from one person's session survives into another's.
  return <SignedIn key={account.sub} account={account} />
}

function SignedIn({ account }: { account: Account }) {
  const { loaded, profile } = useProfile()
  const [tab, setTabState] = useState<Tab>(() => {
    const saved = prefs.get('tab')
    return TABS.includes(saved as Tab) ? (saved as Tab) : 'today'
  })
  const [adding, setAdding] = useState(false)
  const [quickAdding, setQuickAdding] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [wizard, setWizard] = useState<{ step: number } | null>(null)
  const [autoWizardDone, setAutoWizardDone] = useState(false)

  // Apply the person's chosen colors.
  useEffect(() => {
    document.documentElement.dataset.look = profile.theme
  }, [profile.theme])

  // First time on this account: open the setup wizard once.
  const needsWizard = loaded && !profile.onboarded && !autoWizardDone
  if (needsWizard) {
    setAutoWizardDone(true)
    setWizard({ step: 0 })
  }

  const setTab = (t: Tab) => {
    setTabState(t)
    prefs.set('tab', t)
    window.scrollTo({ top: 0 })
  }
  const openAdd = useCallback(() => setAdding(true), [])
  const closeAdd = useCallback(() => setAdding(false), [])
  const openQuick = useCallback(() => {
    setAdding(false)
    setQuickAdding(true)
  }, [])
  const closeQuick = useCallback(() => setQuickAdding(false), [])
  const closeGarment = useCallback(() => setOpenId(null), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])
  const editProfile = useCallback((step = 0) => setWizard({ step }), [])
  const closeWizard = useCallback(() => setWizard(null), [])

  return (
    <div className="app">
      <header className="topbar">
        <span className="wordmark">Drape</span>
        <button type="button" className="avatar-btn" aria-label={`Settings for ${account.email}`} onClick={() => setSettingsOpen(true)}>
          {account.picture ? <img src={account.picture} alt="" referrerPolicy="no-referrer" /> : <Settings size={22} aria-hidden="true" />}
        </button>
      </header>

      <main className="content">
        <UpdateBanner />
        <InstallBanner />
        <LegacyImport email={account.email} />
        {tab === 'today' && <TodayScreen onAdd={openAdd} onQuickAdd={openQuick} onEditProfile={() => editProfile(0)} />}
        {tab === 'closet' && <ClosetScreen onOpen={setOpenId} onAdd={openAdd} onQuickAdd={openQuick} />}
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

      {adding && <AddSheet onClose={closeAdd} onTypeList={openQuick} />}
      {quickAdding && <QuickAddSheet onClose={closeQuick} />}
      {/* key: a different piece gets a fresh panel, never the previous piece's edit form */}
      {openId && <GarmentSheet key={openId} id={openId} onClose={closeGarment} onOpen={setOpenId} />}
      {settingsOpen && <SettingsSheet onClose={closeSettings} onEditProfile={editProfile} />}
      {wizard && <ProfileWizard startAt={wizard.step} defaultName={account.name.split(' ')[0] ?? ''} onClose={closeWizard} />}
    </div>
  )
}

/** Offers pieces saved before accounts existed to the first person who signs in on this phone. */
function LegacyImport({ email }: { email: string }) {
  const toast = useToast()
  const [count, setCount] = useState(0)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let cancelled = false
    void legacyPieceCount().then((n) => {
      if (!cancelled) setCount(n)
    })
    return () => {
      cancelled = true
    }
  }, [])
  if (count === 0) return null

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true)
    try {
      await fn()
      await reload()
      setCount(0)
      toast(done)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That did not work. Try again.', 'error')
      setBusy(false)
    }
  }

  return (
    <aside className="card stack-sm" aria-label="Pieces from before sign-in">
      <h2>
        {count} piece{count === 1 ? '' : 's'} from before sign-in
      </h2>
      <p className="muted small">They were saved on this phone before Drape had accounts. Add them to {email}'s closet?</p>
      <div className="row-actions">
        <button type="button" className="btn primary" disabled={busy} onClick={() => void run(importLegacy, 'Added to your closet')}>
          Add to my closet
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => void run(discardLegacy, 'Old pieces removed from this phone')}>
          Delete them
        </button>
      </div>
    </aside>
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
