// Google sign-in and Drive access for Drape. Drive access is limited to the hidden
// appDataFolder (`drive.appdata`), so the app cannot see any other Drive file.
// `openid email profile` tell Drape who is signed in, to keep each person's closet apart.

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const SCOPES = `openid email profile ${DRIVE_SCOPE}`
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

type TokenResponse = { access_token?: string; expires_in?: number; error?: string; error_description?: string }
type TokenClient = { requestAccessToken: (opts?: { prompt?: string; login_hint?: string }) => void }
type GoogleGlobal = {
  accounts: {
    oauth2: {
      initTokenClient: (cfg: {
        client_id: string
        scope: string
        callback: (r: TokenResponse) => void
        error_callback?: (e: { type: string; message?: string }) => void
      }) => TokenClient
      hasGrantedAllScopes: (r: TokenResponse, ...scopes: string[]) => boolean
      revoke: (token: string, done?: () => void) => void
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

let token: { value: string; expiresAt: number; drive: boolean } | null = null

export const isSignedIn = () => Boolean(token && token.expiresAt > Date.now())
/** False if the person unticked Drive access on Google's consent screen. */
export const hasDriveAccess = () => Boolean(token?.drive)

function friendlyError(code: string): string {
  if (code === 'popup_closed' || code === 'popup_failed_to_open') return 'The Google window was closed before signing in. Try again.'
  if (code === 'access_denied') return 'Google sign-in was cancelled.'
  return `Google sign-in failed (${code}). Try again.`
}

/**
 * Opens Google's sign-in window and keeps a short-lived access token in memory.
 * `hint` pre-selects an account when signing in again.
 */
export async function signIn(hint?: string): Promise<void> {
  if (!CLIENT_ID) throw new Error('Google sign-in is not set up in this build.')
  if (!navigator.onLine) throw new Error('You are offline. Connect to the internet to sign in.')
  await loadGoogleScript()
  await new Promise<void>((resolve, reject) => {
    const oauth = window.google!.accounts.oauth2
    const client = oauth.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (r) => {
        if (r.error || !r.access_token) return reject(new Error(r.error_description ?? friendlyError(r.error ?? 'unknown')))
        token = {
          value: r.access_token,
          expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000 - 30_000,
          drive: oauth.hasGrantedAllScopes(r, DRIVE_SCOPE),
        }
        resolve()
      },
      error_callback: (e) => reject(new Error(friendlyError(e.type))),
    })
    client.requestAccessToken(hint ? { prompt: '', login_hint: hint } : { prompt: 'select_account' })
  })
}

export interface GoogleUser {
  sub: string
  email: string
  name: string
  picture: string | null
}

/** Who is signed in. Needs the token from `signIn`. */
export async function fetchUser(): Promise<GoogleUser> {
  const res = await api('https://openidconnect.googleapis.com/v1/userinfo')
  const u = (await res.json()) as Record<string, unknown>
  if (typeof u.sub !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(u.sub)) throw new Error('Google did not say who is signed in. Try again.')
  return {
    sub: u.sub,
    email: typeof u.email === 'string' ? u.email : '',
    name: typeof u.name === 'string' ? u.name : typeof u.given_name === 'string' ? u.given_name : '',
    picture: typeof u.picture === 'string' && u.picture.startsWith('https://') ? u.picture : null,
  }
}

export function signOut() {
  const t = token?.value
  token = null
  // Also tell Google, so the next sign-in shows the account picker again.
  if (t && window.google) window.google.accounts.oauth2.revoke(t)
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
