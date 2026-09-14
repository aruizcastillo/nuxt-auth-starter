import { betterAuth } from 'better-auth'
import { describe, expect, it } from 'vitest'
import { createAuth } from '../../server/auth/options'
import { createGoogleProvider } from '../../server/auth/providers/google'
import { createDatabase } from '../../server/database/clients/neon'
import { parseAuthConfig } from '../../server/auth/config'

describe('Better Auth method boundaries', () => {
  it.each([
    { credentials: true, google: true },
    { credentials: true, google: false },
    { credentials: false, google: true },
  ])('initializes and reads an anonymous session with credentials=$credentials Google=$google', async ({ credentials, google }) => {
    const baseline = createAuth(parseAuthConfig({
      betterAuthSecret: 'boundary-test-secret-with-at-least-32-characters',
      betterAuthUrl: 'https://auth.example.test',
    }), createDatabase('postgresql://unused:unused@localhost/unused'))

    // Model a derived project's direct edits to Better Auth options, without
    // introducing application feature flags or a second configuration API.
    const auth = betterAuth({
      ...baseline.options,
      emailAndPassword: { enabled: credentials },
      ...(google ? { socialProviders: createGoogleProvider({ googleClientId: 'test-id', googleClientSecret: 'test-secret' }) } : {}),
    })
    const context = await auth.$context
    expect(context.socialProviders.map(provider => provider.id)).toEqual(google ? ['google'] : [])
    expect(await auth.api.getSession({ headers: new Headers() })).toBeNull()
    expect(auth.options.session?.cookieCache?.enabled).toBe(false)
  })
})
