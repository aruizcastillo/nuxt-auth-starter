import { betterAuth } from 'better-auth'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAuth } from '../../server/auth/options'
import { createGoogleProvider } from '../../server/auth/providers/google'
import { createDatabase } from '../../server/database'
import { parseAuthConfig } from '../../server/auth/config'
import { createEmailSender } from '../../server/email'

afterEach(() => vi.restoreAllMocks())

describe('Better Auth method boundaries', () => {
  it.each([
    { credentials: true, google: true },
    { credentials: true, google: false },
    { credentials: false, google: true },
    { credentials: undefined, google: true },
  ])('initializes and reads an anonymous session with credentials=$credentials Google=$google', async ({ credentials, google }) => {
    const baseline = createAuth(parseAuthConfig({
      betterAuthSecret: 'boundary-test-secret-with-at-least-32-characters',
      betterAuthUrl: 'https://auth.example.test',
    }), createDatabase('postgresql://unused:unused@localhost/unused'))

    const { emailAndPassword: configuredCredentials, ...coreOptions } = baseline.options
    expect(configuredCredentials).toEqual({
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    })

    // Model a derived project's direct edits to Better Auth options, without
    // introducing application feature flags or a second configuration API.
    const auth = betterAuth({
      ...coreOptions,
      ...(credentials === undefined ? {} : { emailAndPassword: { enabled: credentials } }),
      ...(google ? { socialProviders: createGoogleProvider({ googleClientId: 'test-id', googleClientSecret: 'test-secret' }) } : {}),
    })
    const context = await auth.$context
    expect(context.socialProviders.map(provider => provider.id)).toEqual(google ? ['google'] : [])
    expect(await auth.api.getSession({ headers: new Headers() })).toBeNull()
    expect(auth.options.session?.cookieCache?.enabled).toBe(false)
  })
})

describe('email availability before account lookup', () => {
  it.each([
    {},
    { resendApiKey: 'private-test-key' },
    { emailFrom: 'sender@example.test' },
  ])('keeps callbacks configured and returns controlled HTTP errors for incomplete settings %j', async (config) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const database = createDatabase('postgresql://unused:unused@localhost/unused')
    const query = vi.spyOn(database.$client, 'query')
    const factory = vi.fn(() => createEmailSender(config, () => {}))
    const auth = createAuth(parseAuthConfig({
      betterAuthSecret: 'boundary-test-secret-with-at-least-32-characters',
      betterAuthUrl: 'https://auth.example.test',
    }), database, factory)
    expect(auth.options.emailAndPassword?.sendResetPassword).toBeTypeOf('function')
    expect(auth.options.emailVerification?.sendVerificationEmail).toBeTypeOf('function')
    expect(auth.options.emailVerification?.sendOnSignUp).toBe(true)
    expect(factory).not.toHaveBeenCalled()

    for (const path of ['sign-up/email', 'send-verification-email', 'request-password-reset']) {
      const response = await auth.handler(new Request(`https://auth.example.test/api/auth/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'origin': 'https://auth.example.test' },
        body: JSON.stringify({ name: 'Test', email: 'test@example.test', password: 'password-123' }),
      }))
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({ code: 'EMAIL_DELIVERY_UNAVAILABLE', message: 'Email delivery is unavailable' })
      expect(response.headers.getSetCookie()).toEqual([])
    }
    expect(query).not.toHaveBeenCalled()
    expect(factory).toHaveBeenCalledTimes(3)
    expect(vi.mocked(console.error).mock.calls).toEqual(Array.from({ length: 3 }, () => ['auth_email_unavailable']))
  })

  it('also preflights direct auth.api calls and discards the original preparation error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const auth = createAuth(parseAuthConfig({
      betterAuthSecret: 'boundary-test-secret-with-at-least-32-characters',
      betterAuthUrl: 'https://auth.example.test',
    }), createDatabase('postgresql://unused:unused@localhost/unused'), () => {
      throw new Error('private-key recipient@example.test https://auth.example.test/?token=private-token')
    })
    await expect(auth.api.requestPasswordReset({ body: { email: 'test@example.test' } })).rejects.toMatchObject({
      statusCode: 503,
      body: { code: 'EMAIL_DELIVERY_UNAVAILABLE', message: 'Email delivery is unavailable' },
    })
    expect(console.error).toHaveBeenCalledExactlyOnceWith('auth_email_unavailable')
  })
})
