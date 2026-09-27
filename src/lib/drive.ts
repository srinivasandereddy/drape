// Minimal Google Drive access for Drape. Only the hidden appDataFolder is used,
// via the narrow `drive.appdata` scope, so the app cannot see any other Drive file.

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

type TokenResponse = { access_token?: string; expires_in?: number; error?: string; error_description?: string }
type TokenClient = { requestAccessToken: (opts?: { prompt?: string }) => void }
type GoogleGlobal = {
  accounts: {
    oauth2: {
      initTokenClient: (cfg: {
        client_id: string
        scope: string
        callback: (r: TokenResponse) => void
        error_callback?: (e: { type: string; message?: string }) => void
      }) => TokenClient
    }
  }
}
declare global {
  interface Window {
    google?: GoogleGlobal
  }
}

export const hasClientId = Boolean(CLIENT_ID)

let scriptPromise: Promise<void> | null = null
function loadGoogleScript(): Promise<void> {
  if (window.google) return Promise.resolve()
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Could not load Google sign-in. Check your connection.'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

let token: { value: string; expiresAt: number } | null = null

export const isSignedIn = () => Boolean(token && token.expiresAt > Date.now())

/** Opens Google's sign-in popup and stores a short-lived access token in memory. */
export async function signIn(): Promise<void> {
  if (!CLIENT_ID) throw new Error('Missing VITE_GOOGLE_CLIENT_ID. See .env.example.')
  await loadGoogleScript()
  await new Promise<void>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (r) => {
        if (r.error || !r.access_token) return reject(new Error(r.error_description ?? r.error ?? 'Sign-in failed'))
        token = { value: r.access_token, expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000 - 30_000 }
        resolve()
      },
      error_callback: (e) => reject(new Error(e.message ?? e.type)),
    })
    client.requestAccessToken({ prompt: '' })
  })
}

export function signOut() {
  token = null
}

async function api(url: string, init: RequestInit = {}): Promise<Response> {
  if (!isSignedIn()) throw new Error('Not signed in, or the sign-in expired. Sign in again.')
  const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token!.value}` } })
  if (!res.ok) throw new Error(`Drive said ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res
}

export type DriveFile = { id: string; name: string; modifiedTime: string }

export async function listFiles(): Promise<DriveFile[]> {
  const q = new URLSearchParams({
    spaces: 'appDataFolder',
    fields: 'files(id,name,modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: '100',
  })
  const res = await api(`https://www.googleapis.com/drive/v3/files?${q}`)
  return (await res.json()).files
}

export async function writeJson(name: string, data: unknown): Promise<DriveFile> {
  const boundary = 'drape' + Math.random().toString(36).slice(2)
  const meta = { name, parents: ['appDataFolder'] }
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}\r\n--${boundary}--`
  const res = await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  return res.json()
}

export async function readJson<T>(id: string): Promise<T> {
  const res = await api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`)
  return res.json()
}
