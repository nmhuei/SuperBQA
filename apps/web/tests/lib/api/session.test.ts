import { describe, expect, test } from 'bun:test'

type SessionChange = 'unchanged' | 'rotated' | 'same-token-login'

// Query tests mock $lib/api process-wide. Run the real API module separately
// so this regression exercises its response parsing and auth side effects.
async function delayedBadToken(change: SessionChange) {
  const process = Bun.spawn(
    [
      Bun.which('bun')!,
      '-e',
      `
      import { mock } from 'bun:test'
      import { SubmitClubPracticeRouteV2 } from '@rctf/types'
      mock.module('$app/environment', () => ({ browser: true }))
      mock.module('$lib/toast', () => ({ toast: { error() {} } }))
      const storage = new Map()
      globalThis.localStorage = {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: key => storage.delete(key),
      }
      globalThis.window = { location: { origin: 'http://localhost' } }
      const api = await import('./src/lib/api/index.ts')
      api.setToken('test-initial-token')
      let changes = 0
      api.setAuthChangeHandler(() => changes++)
      let resolve
      const response = new Promise(done => { resolve = done })
      let authorization
      api.setApiFetch(async (url, options) => {
        authorization = options.headers.Authorization
        return response
      })
      const request = api.apiRequest(SubmitClubPracticeRouteV2, {
        id: 'archive-a', challengeId: 'challenge-a', flag: 'test-only-flag',
      })
      const change = ${JSON.stringify(change)}
      if (change === 'rotated') api.setToken('test-new-session-token')
      if (change === 'same-token-login') {
        api.clearToken()
        api.setToken('test-initial-token')
      }
      const changesBeforeResponse = changes
      resolve(Response.json({ kind: 'badToken', message: 'The token provided is invalid.' }))
      const result = await request
      console.log(JSON.stringify({
        token: storage.get('token') ?? null,
        responseKind: result.kind,
        authChanges: changes - changesBeforeResponse,
        authorization,
      }))
    `,
    ],
    {
      cwd: new URL('../../../', import.meta.url).pathname,
      stdout: 'pipe',
      stderr: 'pipe',
    }
  )
  const [exitCode, output, errors] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ])
  if (exitCode !== 0) throw new Error(errors)
  return JSON.parse(output) as {
    token: string | null
    responseKind: string
    authChanges: number
    authorization: string
  }
}

describe('API response session ownership', () => {
  test('invalidates the current session when its own request rejects the token', async () => {
    expect(await delayedBadToken('unchanged')).toEqual({
      token: null,
      responseKind: 'badToken',
      authChanges: 1,
      authorization: 'Bearer test-initial-token',
    })
  })

  test('a delayed bad token response cannot log out a newer token', async () => {
    expect(await delayedBadToken('rotated')).toEqual({
      token: 'test-new-session-token',
      responseKind: 'badToken',
      authChanges: 0,
      authorization: 'Bearer test-initial-token',
    })
  })

  test('logout and login with the same token still retire the old response', async () => {
    expect(await delayedBadToken('same-token-login')).toEqual({
      token: 'test-initial-token',
      responseKind: 'badToken',
      authChanges: 0,
      authorization: 'Bearer test-initial-token',
    })
  })
})
