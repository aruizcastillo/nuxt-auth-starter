import { inspect } from 'node:util'
import type { RequestEvent } from 'nuxt/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeAuthEmail, useServerAuth } from '../../server/utils/auth'

// Only supply runtime settings here. Mounted HTTP tests exercise real Nitro.
const config = vi.hoisted(() => ({
  betterAuthSecret: 'runtime-test-secret-with-at-least-32-characters',
  betterAuthUrl: 'https://auth.example.test',
  databaseUrl: 'postgresql://unused:unused@localhost/unused',
  resendApiKey: '',
  emailFrom: '',
}))
vi.mock('nuxt/server', () => ({ useRuntimeConfig: () => config }))

const input = {
  user: { id: 'test', name: 'Test', email: 'private@example.test', emailVerified: false, createdAt: new Date(), updatedAt: new Date() },
  url: 'https://auth.example.test/?token=private-token',
  token: 'private-token',
}

function requestEvent() {
  const req = new Request('https://auth.example.test/api/auth/send-verification-email')
  const tasks: Promise<unknown>[] = []
  return {
    req, url: new URL(req.url), res: { headers: new Headers() }, context: {}, tasks,
    waitUntil(task: Promise<unknown>) { this.tasks.push(task) },
  } satisfies RequestEvent & { tasks: Promise<unknown>[], waitUntil: (task: Promise<unknown>) => void }
}

beforeEach(() => {
  config.resendApiKey = 're_runtime-unused'
  config.emailFrom = 'sender@example.test'
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('runtime email initialization and request registration', () => {
  it('constructs without I/O and reuses the initialized transport across requests', async () => {
    const response = Promise.withResolvers<Response>()
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => response.promise.then(value => value.clone()))
    vi.stubGlobal('fetch', fetcher)
    initializeAuthEmail(false)
    expect(fetcher).not.toHaveBeenCalled()
    config.resendApiKey = ''
    config.emailFrom = ''
    const events = [requestEvent(), requestEvent()]
    for (const event of events) {
      const auth = useServerAuth(event)
      await auth.options.emailVerification?.sendVerificationEmail?.(input)
      expect(event.tasks).toHaveLength(1)
    }
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(console.info).toHaveBeenCalledTimes(2)
    response.resolve(Response.json({ id: crypto.randomUUID() }))
    await Promise.all(events.flatMap(event => event.tasks))
    expect(console.info).toHaveBeenCalledTimes(4)
    expect(console.error).not.toHaveBeenCalled()
  })

  it.each([
    [true, '', '', false],
    [false, '', '', true],
    [true, 'private-key', '', true],
    [true, '', 'sender@example.test', true],
    [true, 'private-key', 'invalid-private-value', true],
  ] as const)('validates development=%s settings at initialization', (development, key, from, invalid) => {
    config.resendApiKey = key
    config.emailFrom = from
    const initialize = () => initializeAuthEmail(development)
    if (invalid) {
      expect(initialize).toThrow(/^Missing or invalid configuration: NUXT_/)
      try {
        initialize()
      }
      catch (error) {
        expect(inspect(error)).not.toContain('private-key')
        expect(inspect(error)).not.toContain('invalid-private-value')
      }
    }
    else expect(initialize).not.toThrow()
  })

  it('keeps callbacks and observes unavailable development delivery without disabling credentials', async () => {
    config.resendApiKey = ''
    config.emailFrom = ''
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetcher)
    initializeAuthEmail(true)
    const event = requestEvent()
    const auth = useServerAuth(event)
    expect(auth.options.emailAndPassword).toMatchObject({ enabled: true, requireEmailVerification: true })
    await auth.options.emailVerification?.sendVerificationEmail?.(input)
    await expect(Promise.all(event.tasks)).resolves.toEqual([undefined])
    expect(fetcher).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledExactlyOnceWith('auth_email_failed', {
      purpose: 'verification', deliveryId: expect.any(String), code: 'not_configured',
    })
  })

  it.each(['absent', 'throws'])('propagates %s registration without starting I/O', async (mode) => {
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetcher)
    initializeAuthEmail(false)
    const event = requestEvent()
    const runtimeEvent = mode === 'absent'
      ? { req: event.req, url: event.url, res: event.res, context: event.context }
      : { ...event, waitUntil() { throw new Error(input.url) } }
    const auth = useServerAuth(runtimeEvent)
    await expect(auth.options.emailVerification?.sendVerificationEmail?.(input)).rejects.toThrow('Email background registration failed')
    await Promise.resolve()
    expect(fetcher).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledExactlyOnceWith('auth_email_failed', {
      purpose: 'verification', deliveryId: expect.any(String), code: 'background_registration',
    })
    expect(inspect(vi.mocked(console.error).mock.calls)).not.toContain(input.url)
  })

  it('observes a rejected send once without rejecting the registered task', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 429 })))
    initializeAuthEmail(false)
    const event = requestEvent()
    await useServerAuth(event).options.emailVerification?.sendVerificationEmail?.(input)
    await expect(Promise.all(event.tasks)).resolves.toEqual([undefined])
    expect(console.error).toHaveBeenCalledExactlyOnceWith('auth_email_failed', {
      purpose: 'verification', deliveryId: expect.any(String), code: 'rate_limit',
    })
  })
})
