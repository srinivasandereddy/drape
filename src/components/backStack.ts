// Makes the phone's Back gesture close the top sheet instead of leaving the app.
//
// While any sheet is open, exactly one extra browser history entry exists.
// Back removes that entry (a "popstate"), and we close the top sheet. When the
// last sheet closes by a button instead, we remove the entry ourselves.
// All history changes are batched to the end of the current task, so a sheet
// that closes and immediately reopens (e.g. switching to edit mode) causes no
// history traffic at all, and we never push while our own Back is in flight.

import { useEffect, useRef } from 'react'

type Entry = { close: () => void }

const stack: Entry[] = []
let entryPushed = false
let awaitingOwnPop = false
let syncQueued = false
let listening = false

function sync() {
  if (awaitingOwnPop) return // finish our own Back first; onPopState calls sync again
  if (stack.length > 0 && !entryPushed) {
    history.pushState({ drapeSheet: true }, '')
    entryPushed = true
  } else if (stack.length === 0 && entryPushed) {
    awaitingOwnPop = true
    history.back()
  }
}

function scheduleSync() {
  if (syncQueued) return
  syncQueued = true
  queueMicrotask(() => {
    syncQueued = false
    sync()
  })
}

function onPopState() {
  if (awaitingOwnPop) {
    awaitingOwnPop = false
    entryPushed = false
    sync() // a sheet may have opened while we were waiting
    return
  }
  if (!entryPushed) return // not our entry: normal navigation
  entryPushed = false
  stack.pop()?.close()
  scheduleSync() // re-arm Back if more sheets are still open
}

export function useBackToClose(onClose: () => void): void {
  const latest = useRef(onClose)
  useEffect(() => {
    latest.current = onClose
  })

  useEffect(() => {
    if (!listening) {
      window.addEventListener('popstate', onPopState)
      listening = true
    }
    const entry: Entry = { close: () => latest.current() }
    stack.push(entry)
    scheduleSync()
    return () => {
      const i = stack.indexOf(entry)
      if (i !== -1) stack.splice(i, 1)
      scheduleSync()
    }
  }, [])
}
