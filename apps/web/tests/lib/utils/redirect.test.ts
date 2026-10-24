import {
  clearAuthReturn,
  getAuthPageHref,
  getAuthReturnPath,
  getRedirectPath,
  rememberAuthReturn,
} from '$lib/utils/redirect'
import { describe, expect, test } from 'bun:test'

const ORIGIN = 'https://ctf.example.com'

describe('getRedirectPath', () => {
  test.each([
    ['/challenges', '/challenges'],
    ['/scores?division=open#top', '/scores?division=open#top'],
    [
      '/external-auth/authorize?client_id=a&redirect_uri=b&state=c',
      '/external-auth/authorize?client_id=a&redirect_uri=b&state=c',
    ],
    ['/', '/'],
    ['/a/b/c', '/a/b/c'],
  ])('allows same-origin path %s', (next, expected) => {
    expect(getRedirectPath(next, ORIGIN)).toBe(expected)
  })

  test.each([
    [null],
    [''],
    ['challenges'],
    ['https://evil.com'],
    ['https://evil.com/'],
    ['http://ctf.example.com/downgrade'],
    ['javascript:alert(1)'],
    ['mailto:a@evil.com'],
    [' /leading-space'],
  ])('falls back to / for non-path input %p', next => {
    expect(getRedirectPath(next, ORIGIN)).toBe('/')
  })

  test.each([
    ['//evil.com'],
    ['//evil.com/path'],
    ['/\\evil.com'],
    ['\\/evil.com'],
    ['/..//evil.com'],
    ['/a/..//evil.com'],
    ['///evil.com'],
    ['/\t//evil.com'],
    ['/\n//evil.com'],
    ['//%2Fevil.com'],
  ])('rejects protocol-relative and normalization tricks %p', next => {
    expect(getRedirectPath(next, ORIGIN)).toBe('/')
  })

  test('keeps encoded slashes as an inert path', () => {
    expect(getRedirectPath('/%2F%2Fevil.com', ORIGIN)).toBe('/%2F%2Fevil.com')
  })

  test('normalizes dot segments within the origin', () => {
    expect(getRedirectPath('/a/../b', ORIGIN)).toBe('/b')
  })
})

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  }
}

describe('authentication continuation', () => {
  test.each([
    '/%6cogin',
    '/%72egister?next=/challenges',
    '/%76erify?token=private',
    '/%72ecover/',
    '/%ZZ',
    '/%E0%A4',
  ])('rejects encoded auth routes and malformed routing paths at %s', next => {
    expect(getAuthReturnPath(next, ORIGIN, { storage: null })).toBe('/')
    expect(getAuthPageHref('/login', next, ORIGIN)).toBe('/login?next=%2F')
  })

  test('route comparison does not rewrite an allowed encoded challenge destination', () => {
    expect(
      getAuthReturnPath('/%63hallenges?challenge=%252F#flag', ORIGIN, {
        storage: null,
      })
    ).toBe('/%63hallenges?challenge=%252F#flag')
  })
  test.each([
    '/login',
    '/register',
    '/recover?next=/challenges',
    '/verify?token=private',
    '/login/',
  ])('does not continue back into authentication at %s', next => {
    expect(getAuthPageHref('/login', next, ORIGIN)).toBe('/login?next=%2F')
    expect(getAuthReturnPath(next, ORIGIN, { storage: null })).toBe('/')
  })
  test('login, registration and recovery links preserve a challenge query and hash without double encoding', () => {
    const target = '/challenges?challenge=web%2Fone&tab=details#flag'
    let next = target
    for (const route of [
      '/register',
      '/login',
      '/recover',
      '/login',
    ] as const) {
      const href = getAuthPageHref(route, next, ORIGIN)
      const url = new URL(href, ORIGIN)
      expect(url.origin).toBe(ORIGIN)
      expect(url.pathname).toBe(route)
      expect(url.searchParams.get('next')).toBe(
        '/challenges?challenge=web%2Fone&tab=details#flag'
      )
      next = url.searchParams.get('next')!
    }
    expect(getAuthReturnPath(next, ORIGIN, { storage: null })).toBe(
      '/challenges?challenge=web%2Fone&tab=details#flag'
    )
  })

  test.each([
    'https://evil.example/path',
    '//evil.example/path',
    '/\\evil.example',
    '/a/..//evil.example',
    'javascript:alert(1)',
  ])('unsafe destination %s is never propagated or restored', next => {
    const storage = memoryStorage()
    expect(getAuthPageHref('/register', next, ORIGIN)).toBe(
      '/register?next=%2F'
    )
    rememberAuthReturn(next, ORIGIN, { storage, now: 1000 })
    expect(getAuthReturnPath(null, ORIGIN, { storage, now: 1001 })).toBe('/')
    expect(getAuthReturnPath(next, ORIGIN, { storage, now: 1001 })).toBe('/')
  })

  test('email verification can restore the pending destination from the same browser session', () => {
    const storage = memoryStorage()
    rememberAuthReturn('/archive/event-1?challenge=web#flag', ORIGIN, {
      storage,
      now: 1000,
    })
    expect(getAuthReturnPath(null, ORIGIN, { storage, now: 1100 })).toBe(
      '/archive/event-1?challenge=web#flag'
    )
    clearAuthReturn({ storage })
    expect(getAuthReturnPath(null, ORIGIN, { storage, now: 1200 })).toBe('/')
  })

  test('an explicit destination wins over a pending email flow, including an invalid destination', () => {
    const storage = memoryStorage()
    rememberAuthReturn('/challenges?challenge=old', ORIGIN, {
      storage,
      now: 1000,
    })
    expect(
      getAuthReturnPath('/scores#team', ORIGIN, { storage, now: 1100 })
    ).toBe('/scores#team')
    expect(
      getAuthReturnPath('//evil.example', ORIGIN, { storage, now: 1100 })
    ).toBe('/')
  })

  test('following another auth link after an invalid explicit destination cannot revive an old email continuation', () => {
    const storage = memoryStorage()
    rememberAuthReturn('/challenges?challenge=old', ORIGIN, {
      storage,
      now: 1000,
    })
    const destination = getAuthReturnPath('//evil.example', ORIGIN, {
      storage,
      now: 1100,
    })
    const recover = new URL(
      getAuthPageHref('/recover', destination, ORIGIN),
      ORIGIN
    )
    expect(
      getAuthReturnPath(recover.searchParams.get('next'), ORIGIN, {
        storage,
        now: 1200,
      })
    ).toBe('/')
  })

  test('expired and future-dated pending destinations fall back home', () => {
    const storage = memoryStorage()
    rememberAuthReturn('/challenges', ORIGIN, { storage, now: 1000 })
    expect(
      getAuthReturnPath(null, ORIGIN, { storage, now: 1000 + 30 * 60 * 1000 })
    ).toBe('/')
    rememberAuthReturn('/challenges', ORIGIN, { storage, now: 1000 })
    expect(getAuthReturnPath(null, ORIGIN, { storage, now: 999 })).toBe('/')
  })

  test('a new email flow without a destination clears a previous continuation', () => {
    const storage = memoryStorage()
    rememberAuthReturn('/challenges?challenge=old', ORIGIN, {
      storage,
      now: 1000,
    })
    rememberAuthReturn(null, ORIGIN, { storage, now: 1100 })
    expect(getAuthReturnPath(null, ORIGIN, { storage, now: 1200 })).toBe('/')
  })

  test('authentication links and credential query strings are not persisted', () => {
    const storage = memoryStorage()
    for (const next of [
      '/login?token=private',
      '/verify?token=private',
      '/profile?authToken=private',
      '/profile?teamToken=private',
    ]) {
      rememberAuthReturn(next, ORIGIN, { storage, now: 1000 })
      expect(storage.values.size).toBe(0)
      expect(getAuthReturnPath(null, ORIGIN, { storage, now: 1100 })).toBe('/')
    }
  })

  test('malformed stored data cannot break verification', () => {
    const storage = memoryStorage()
    rememberAuthReturn('/challenges', ORIGIN, { storage, now: 1000 })
    for (const key of storage.values.keys()) storage.values.set(key, '{broken')
    expect(getAuthReturnPath(null, ORIGIN, { storage, now: 1100 })).toBe('/')
  })

  test('blocked browser storage still allows explicit safe returns and normal fallback', () => {
    const storage = {
      getItem: () => {
        throw new Error('Storage blocked')
      },
      setItem: () => {
        throw new Error('Storage blocked')
      },
      removeItem: () => {
        throw new Error('Storage blocked')
      },
    }
    expect(() =>
      rememberAuthReturn('/challenges', ORIGIN, { storage })
    ).not.toThrow()
    expect(() => clearAuthReturn({ storage })).not.toThrow()
    expect(
      getAuthReturnPath('/challenges?challenge=one#flag', ORIGIN, { storage })
    ).toBe('/challenges?challenge=one#flag')
    expect(getAuthReturnPath(null, ORIGIN, { storage })).toBe('/')
    expect(getAuthPageHref('/login', null, ORIGIN)).toBe('/login')
  })
})
