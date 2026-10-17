import { afterEach, describe, expect, it, vi } from 'vitest'
import { requireSession } from '../../server/utils/require-session'
import { useServerAuth } from '../../server/utils/auth'
import type { RequestEvent } from 'nuxt/server'
import { createAuth } from '../../server/auth/options'
import { createDatabase } from '../../server/database'
import { parseAuthConfig } from '../../server/auth/config'

// Exercise error propagation at our auth boundary; HTTP tests cover real sessions.
vi.mock('../../server/utils/auth', () => ({ useServerAuth: vi.fn() }))
vi.mock('nuxt/server', () => ({ createError: (details: object) => Object.assign(new Error('Unauthorized'), details) }))

afterEach(() => vi.resetAllMocks())

describe('session lookup errors', () => {
  it('propagates database failures instead of treating them as anonymous', async () => {
    const failure = new Error('Database unavailable')
    const auth = createAuth(parseAuthConfig({
      betterAuthSecret: 'session-test-secret-with-at-least-32-characters',
      betterAuthUrl: 'https://auth.example.test',
    }), createDatabase('postgresql://unused:unused@localhost/unused'))
    vi.spyOn(auth.api, 'getSession').mockRejectedValue(failure)
    vi.mocked(useServerAuth).mockReturnValue(auth)
    const req = new Request('https://auth.example.test/')
    const event = { req, url: new URL(req.url), res: { headers: new Headers() }, context: {} } satisfies RequestEvent
    await expect(requireSession(event)).rejects.toBe(failure)
  })
})
