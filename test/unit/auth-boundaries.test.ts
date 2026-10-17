import { betterAuth } from 'better-auth'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAuth } from '../../server/auth/options'
import { createGoogleProvider } from '../../server/auth/providers/google'
import { createDatabase } from '../../server/database'
import { parseAuthConfig } from '../../server/auth/config'

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
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
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

describe('native email configuration', () => {
  it('composes callbacks with a provider-independent sender and no hooks', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const auth = createAuth(parseAuthConfig({
      betterAuthSecret: 'boundary-test-secret-with-at-least-32-characters',
      betterAuthUrl: 'https://auth.example.test',
    }), createDatabase('postgresql://unused:unused@localhost/unused'), send)
    expect(auth.options).not.toHaveProperty('hooks')
    expect(auth.options).not.toHaveProperty('advanced.backgroundTasks')
    expect(auth.options.emailVerification).toMatchObject({
      sendOnSignUp: true, sendOnSignIn: false, autoSignInAfterVerification: false,
    })
    const user = { id: 'test-user', name: 'Test', email: 'test@example.test', emailVerified: false, createdAt: new Date(), updatedAt: new Date() }
    const url = 'https://auth.example.test/?token=private-token'
    await auth.options.emailVerification?.sendVerificationEmail?.({ user, url, token: 'private-token' })
    await auth.options.emailAndPassword?.sendResetPassword?.({ user, url, token: 'private-token' })
    expect(send.mock.calls).toEqual([
      [{ to: user.email, subject: 'Verify your email', text: `Verify your email: ${url}` }, 'verification'],
      [{ to: user.email, subject: 'Reset your password', text: `Reset your password: ${url}` }, 'password_reset'],
    ])
  })
})
