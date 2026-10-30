import { describe, expect, test } from 'bun:test'
import { load as archiveLoad } from '../../src/routes/archive/+page'
import { load as archiveIdLoad } from '../../src/routes/archive/[id]/+page'
import { load as challengesLoad } from '../../src/routes/challenges/+page'

function getRedirect(fn: () => unknown | Promise<unknown>) {
  try {
    const result = fn()
    if (result instanceof Promise) {
      throw new Error('Expected sync throw from redirect, got promise')
    }
    throw new Error('Expected redirect to be thrown, but returned normally')
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && 'location' in err) {
      return err as { status: number; location: string }
    }
    throw err
  }
}

async function getRedirectAsync(fn: () => unknown | Promise<unknown>) {
  try {
    await fn()
    throw new Error('Expected redirect to be thrown, but returned normally')
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && 'location' in err) {
      return err as { status: number; location: string }
    }
    throw err
  }
}

describe('archive legacy redirection', () => {
  test('/archive redirects to /club/events cleanly', () => {
    const url = new URL('http://local/archive')
    const redirect = getRedirect(() =>
      archiveLoad({ url } as unknown as Parameters<typeof archiveLoad>[0])
    )
    expect(redirect.status).toBe(302)
    expect(redirect.location).toBe('/club/events')
  })

  test('/archive preserves search query parameter', () => {
    const url = new URL('http://local/archive?q=crypto%20quest')
    const redirect = getRedirect(() =>
      archiveLoad({ url } as unknown as Parameters<typeof archiveLoad>[0])
    )
    expect(redirect.status).toBe(302)
    expect(redirect.location).toBe('/club/events?q=crypto%20quest')
  })

  test('/archive/[id] redirects to /challenges?event=...', () => {
    const url = new URL('http://local/archive/hackathon-2026?challenge=web-1')
    const redirect = getRedirect(() =>
      archiveIdLoad({
        url,
        params: { id: 'hackathon-2026' },
      } as unknown as Parameters<typeof archiveIdLoad>[0])
    )
    expect(redirect.status).toBe(302)
    const targetUrl = new URL(redirect.location, 'http://local')
    expect(targetUrl.pathname).toBe('/challenges')
    expect(targetUrl.searchParams.get('event')).toBe('hackathon-2026')
    expect(targetUrl.searchParams.get('challenge')).toBe('web-1')
  })

  test('/archive/[id] without id redirects to /club/events', () => {
    const url = new URL('http://local/archive/')
    const redirect = getRedirect(() =>
      archiveIdLoad({
        url,
        params: { id: '' },
      } as unknown as Parameters<typeof archiveIdLoad>[0])
    )
    expect(redirect.status).toBe(302)
    expect(redirect.location).toBe('/club/events')
  })

  test('/challenges?archive=... maps cleanly to event mode', async () => {
    const url = new URL('http://local/challenges?archive=summer-cup')
    const redirect = await getRedirectAsync(() =>
      challengesLoad({ url } as unknown as Parameters<typeof challengesLoad>[0])
    )
    expect(redirect.status).toBe(302)
    expect(redirect.location).toBe('/challenges?event=summer-cup')
  })

  test('/challenges?archive=... preserves extra parameters and hash', async () => {
    const url = new URL('http://local/challenges?archive=summer-cup&tab=solves#my-hash')
    const redirect = await getRedirectAsync(() =>
      challengesLoad({ url } as unknown as Parameters<typeof challengesLoad>[0])
    )
    expect(redirect.status).toBe(302)
    const targetUrl = new URL(redirect.location, 'http://local')
    expect(targetUrl.pathname).toBe('/challenges')
    expect(targetUrl.searchParams.get('event')).toBe('summer-cup')
    expect(targetUrl.searchParams.get('tab')).toBe('solves')
    expect(targetUrl.hash).toBe('#my-hash')
  })

  test('/challenges?archive= (empty) redirects to /club/events', async () => {
    const url = new URL('http://local/challenges?archive=')
    const redirect = await getRedirectAsync(() =>
      challengesLoad({ url } as unknown as Parameters<typeof challengesLoad>[0])
    )
    expect(redirect.status).toBe(302)
    expect(redirect.location).toBe('/club/events')
  })

  test('/challenges?event=... allows load without redirection', async () => {
    const url = new URL('http://local/challenges?event=spring-ctf')
    const result = await challengesLoad({
      url,
    } as unknown as Parameters<typeof challengesLoad>[0])
    expect(result).toBeUndefined()
  })

  test('/challenges without event or archive redirects to /club/events', async () => {
    const url = new URL('http://local/challenges')
    const redirect = await getRedirectAsync(() =>
      challengesLoad({ url } as unknown as Parameters<typeof challengesLoad>[0])
    )
    expect(redirect.status).toBe(302)
    expect(redirect.location).toBe('/club/events')
  })
})
