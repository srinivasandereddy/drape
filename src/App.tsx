import { useState } from 'react'
import { hasClientId, isSignedIn, listFiles, readJson, signIn, signOut, writeJson, type DriveFile } from './drive'

type Log = { ok: boolean; text: string }

export default function App() {
  const [signed, setSigned] = useState(isSignedIn())
  const [files, setFiles] = useState<DriveFile[]>([])
  const [log, setLog] = useState<Log[]>([])
  const [busy, setBusy] = useState(false)

  const note = (ok: boolean, text: string) => setLog((l) => [{ ok, text }, ...l].slice(0, 8))
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

  async function run<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true)
    try {
      const out = await fn()
      note(true, `${label}: ok`)
      return out
    } catch (e) {
      note(false, `${label}: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const onSignIn = async () => {
    await run('Sign in', signIn)
    setSigned(isSignedIn())
  }
  const onWrite = async () => {
    const f = await run('Write test file', () =>
      writeJson(`test-${Date.now()}.json`, { hello: 'from Drape', at: new Date().toISOString(), device: navigator.userAgent }),
    )
    if (f) setFiles(await listFiles())
  }
  const onList = async () => {
    const f = await run('List files', listFiles)
    if (f) setFiles(f)
  }
  const onRead = async (f: DriveFile) => {
    const data = await run(`Read ${f.name}`, () => readJson<{ at: string }>(f.id))
    if (data) note(true, `Contents: ${JSON.stringify(data).slice(0, 120)}`)
  }

  return (
    <main className="wrap">
      <header>
        <p className="eyebrow">Milestone 1 · sign-in test</p>
        <h1>Drape</h1>
        <p className="muted">
          Checks that this phone can sign in with Google and read and write Drape's hidden Drive folder.
        </p>
      </header>

      <section className="card">
        <div className="row">
          <span>Opened as</span>
          <b className={standalone ? 'good' : ''}>{standalone ? 'Home-screen app' : 'Browser tab'}</b>
        </div>
        <div className="row">
          <span>Google client ID</span>
          <b className={hasClientId ? 'good' : 'bad'}>{hasClientId ? 'Set' : 'Missing'}</b>
        </div>
        <div className="row">
          <span>Signed in</span>
          <b className={signed ? 'good' : ''}>{signed ? 'Yes' : 'No'}</b>
        </div>
      </section>

      <div className="actions">
        {!signed ? (
          <button className="primary" disabled={busy || !hasClientId} onClick={onSignIn}>
            Sign in with Google
          </button>
        ) : (
          <>
            <button className="primary" disabled={busy} onClick={onWrite}>Write test file to Drive</button>
            <button disabled={busy} onClick={onList}>List files</button>
            <button
              onClick={() => {
                signOut()
                setSigned(false)
                setFiles([])
              }}
            >
              Sign out
            </button>
          </>
        )}
      </div>

      {files.length > 0 && (
        <section className="card">
          <h2>Files in Drape's Drive folder</h2>
          <ul className="files">
            {files.map((f) => (
              <li key={f.id}>
                <button className="link" onClick={() => onRead(f)}>{f.name}</button>
                <span className="muted mono">{new Date(f.modifiedTime).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {log.length > 0 && (
        <section className="card">
          <h2>Log</h2>
          <ul className="log">
            {log.map((l, i) => (
              <li key={i} className={l.ok ? 'good' : 'bad'}>{l.text}</li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
