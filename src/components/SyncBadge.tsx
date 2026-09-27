import { Cloud, CloudAlert, CloudCheck, CloudOff, RefreshCw } from 'lucide-react'
import { reconnect } from '../lib/account'
import { syncNow, useSync } from '../lib/syncStore'
import { useToast } from './toastContext'

/** Small sync status next to the account photo. Tapping it fixes what it can. */
export function SyncBadge({ onOpenSettings }: { onOpenSettings: () => void }) {
  const toast = useToast()
  const s = useSync()
  const label =
    s.status === 'syncing'
      ? `Syncing${s.total ? ` ${s.done} of ${s.total}` : ''}`
      : s.status === 'paused'
        ? 'Sync paused: tap to reconnect'
        : s.status === 'offline'
          ? 'Offline: changes will sync later'
          : s.status === 'error'
            ? `Sync problem: ${s.message ?? ''}`
            : s.lastSyncAt
              ? 'Synced with Google Drive'
              : 'Not synced yet'
  const Icon = s.status === 'syncing' ? RefreshCw : s.status === 'paused' ? Cloud : s.status === 'offline' ? CloudOff : s.status === 'error' ? CloudAlert : CloudCheck

  async function tap() {
    if (s.status === 'paused') {
      try {
        await reconnect()
        await syncNow()
        toast('Reconnected. Your closet is syncing.')
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Could not reconnect.', 'error')
      }
    } else onOpenSettings()
  }

  return (
    <button type="button" className={`sync-badge ${s.status}`} aria-label={label} title={label} onClick={() => void tap()}>
      <Icon size={20} aria-hidden="true" className={s.status === 'syncing' ? 'spin' : ''} />
      {s.status === 'paused' && <span className="sync-dot" aria-hidden="true" />}
    </button>
  )
}
