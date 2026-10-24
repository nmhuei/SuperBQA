export function getRedirectPath(next: string | null, origin: string): string {
  if (!next?.startsWith('/')) return '/'

  try {
    const url = new URL(next, origin)
    const path = `${url.pathname}${url.search}${url.hash}`
    return url.origin === origin && !path.startsWith('//') ? path : '/'
  } catch {
    return '/'
  }
}

type AuthStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type AuthReturnOptions = { storage?: AuthStorage | null; now?: number }

const AUTH_RETURN_KEY = 'rctf.authReturn'
const AUTH_RETURN_MAX_AGE = 30 * 60 * 1000

function getAuthStorage(options: AuthReturnOptions): AuthStorage | null {
  try {
    return options.storage !== undefined
      ? options.storage
      : typeof window === 'undefined'
        ? null
        : window.sessionStorage
  } catch {
    return null
  }
}

export function getAuthPageHref(
  route: '/login' | '/register' | '/recover',
  next: string | null,
  origin: string
): string {
  const path = normalizeAuthReturnPath(next, origin)
  // Preserve an explicit home/fallback choice through later auth links; omitting
  // next here would allow a previous email continuation to take over.
  return next === null && path === '/'
    ? route
    : `${route}?next=${encodeURIComponent(path)}`
}

function normalizeAuthReturnPath(next: string | null, origin: string): string {
  const path = getRedirectPath(next, origin)
  if (path === '/') return path
  const url = new URL(path, origin)
  let routingPath: string
  try {
    // Match SvelteKit's pathname decoding for route comparison, while keeping
    // the original permitted path/query/hash intact for navigation.
    routingPath = url.pathname.split('%25').map(decodeURI).join('%25')
  } catch {
    return '/'
  }
  // Finishing authentication should not send the user back into the same flow.
  if (
    ['/login', '/register', '/recover', '/verify'].includes(
      routingPath.replace(/\/+$/, '')
    )
  )
    return '/'
  return path
}

function canRememberAuthReturn(path: string, origin: string): boolean {
  if (path === '/') return false
  const url = new URL(path, origin)
  // Never persist a credential query alongside the continuation.
  // Authentication tokens remain in their existing native flow.
  const credentialKeys = new Set([
    'token',
    'authtoken',
    'teamtoken',
    'verifytoken',
    'ctftimetoken',
    'access_token',
    'id_token',
  ])
  return ![...url.searchParams.keys()].some(key =>
    credentialKeys.has(key.toLowerCase())
  )
}

export function getAuthReturnPath(
  next: string | null,
  origin: string,
  options: AuthReturnOptions = {}
): string {
  // An explicit invalid next must fall back home, not revive an older flow.
  if (next !== null) return normalizeAuthReturnPath(next, origin)
  const storage = getAuthStorage(options)
  try {
    const raw = storage?.getItem(AUTH_RETURN_KEY)
    if (!raw) return '/'
    const record: unknown = JSON.parse(raw)
    if (
      record &&
      typeof record === 'object' &&
      'path' in record &&
      typeof record.path === 'string' &&
      'createdAt' in record &&
      typeof record.createdAt === 'number'
    ) {
      const age = (options.now ?? Date.now()) - record.createdAt
      const path = normalizeAuthReturnPath(record.path, origin)
      if (
        age >= 0 &&
        age < AUTH_RETURN_MAX_AGE &&
        canRememberAuthReturn(path, origin)
      )
        return path
    }
    storage?.removeItem(AUTH_RETURN_KEY)
  } catch {
    // Storage can be disabled or contain an invalid record; auth still works.
  }
  return '/'
}

export function rememberAuthReturn(
  next: string | null,
  origin: string,
  options: AuthReturnOptions = {}
): void {
  const storage = getAuthStorage(options)
  try {
    storage?.removeItem(AUTH_RETURN_KEY)
    const path = normalizeAuthReturnPath(next, origin)
    if (!canRememberAuthReturn(path, origin)) return
    storage?.setItem(
      AUTH_RETURN_KEY,
      JSON.stringify({ path, createdAt: options.now ?? Date.now() })
    )
  } catch {
    // Query-string continuation remains available when storage is unavailable.
  }
}

export function clearAuthReturn(options: AuthReturnOptions = {}): void {
  try {
    getAuthStorage(options)?.removeItem(AUTH_RETURN_KEY)
  } catch {
    // Successful authentication does not depend on browser storage access.
  }
}
