import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { authFixtures, testDatabase } from '../helpers/auth'
import { account, session } from '../../server/database/schema/auth'

const target = testDatabase()
const fixtures = authFixtures(target.db)
const origin = 'https://auth.example.test'
const sessionResponse = z.object({
  user: z.object({ id: z.string(), email: z.string(), emailVerified: z.boolean() }),
  session: z.object({ id: z.string() }),
})

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  dev: false,
  browser: false,
  // Cold Nitro builds can exceed the default four-minute Windows setup budget.
  setupTimeout: 600000,
  env: {
    NUXT_DATABASE_URL: target.databaseUrl,
    NUXT_BETTER_AUTH_SECRET: randomBytes(32).toString('base64'),
    NUXT_BETTER_AUTH_URL: origin,
    NUXT_GOOGLE_CLIENT_ID: '',
    NUXT_GOOGLE_CLIENT_SECRET: '',
    NUXT_RESEND_API_KEY: '',
    NUXT_EMAIL_FROM: '',
  },
})

afterAll(() => fixtures.cleanup())

function post(path: string, body: unknown, cookie = '') {
  return fetch(`/api/auth/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin, cookie },
    body: JSON.stringify(body),
  })
}

function sessionCookie(response: Response) {
  const header = response.headers.getSetCookie().find(value => value.startsWith('__Secure-better-auth.session_token='))
  // Assert attributes without ever including cookie/token values in failed assertions.
  expect(Boolean(header)).toBe(true)
  expect(/; HttpOnly/i.test(header ?? '')).toBe(true)
  expect(/; Secure/i.test(header ?? '')).toBe(true)
  expect(/; SameSite=Lax/i.test(header ?? '')).toBe(true)
  expect(/; Path=\//i.test(header ?? '')).toBe(true)
  expect(response.headers.getSetCookie().some(value => value.includes('session_data='))).toBe(false)
  if (!header) throw new Error('Session cookie missing')
  return header.split(';')[0]!
}

async function getSession(cookie = '') {
  const response = await fetch('/api/auth/get-session', { headers: { cookie } })
  expect(response.status).toBe(200)
  return response.json() as Promise<unknown>
}

// Phase 3 only: Phase 4 must replace these expectations with real email verification.
describe('mounted Better Auth server', () => {
  it('responds to health and treats missing cookies as unauthenticated', async () => {
    const response = await fetch('/api/auth/ok')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(await getSession()).toBeNull()
  })

  it('persists credentials and sessions, signs in, and revokes cookies on sign-out', async () => {
    const credentials = fixtures.credentials()
    const signup = await post('sign-up/email', credentials)
    expect(signup.status).toBe(200)
    const signupCookie = sessionCookie(signup)
    const first = sessionResponse.parse(await getSession(signupCookie))
    expect(first.user.email).toBe(credentials.email)
    expect(first.user.emailVerified).toBe(false)
    const stored = await target.db.select().from(account).where(eq(account.userId, first.user.id))
    expect(stored.length).toBe(1)
    expect(stored[0]?.providerId).toBe('credential')
    expect(Boolean(stored[0]?.password) && stored[0]?.password !== credentials.password).toBe(true)

    const invalid = await post('sign-in/email', { email: credentials.email, password: 'incorrect-password' })
    expect(invalid.status).toBe(401)
    expect(invalid.headers.getSetCookie().some(value => value.includes('session_token='))).toBe(false)

    const signout = await post('sign-out', {}, signupCookie)
    expect(signout.status).toBe(200)
    expect(signout.headers.getSetCookie().some(value => /session_token=;.*Max-Age=0/i.test(value))).toBe(true)
    expect(await getSession(signupCookie)).toBeNull()
    expect((await target.db.select({ id: session.id }).from(session).where(eq(session.id, first.session.id))).length).toBe(0)

    const signin = await post('sign-in/email', { email: credentials.email, password: credentials.password })
    expect(signin.status).toBe(200)
    const signinCookie = sessionCookie(signin)
    expect(sessionResponse.parse(await getSession(signinCookie)).user.id).toBe(first.user.id)
    expect((await post('sign-out', {}, signinCookie)).status).toBe(200)
    expect(await getSession(signinCookie)).toBeNull()
  })

  it('rejects malformed input without issuing a session', async () => {
    const response = await post('sign-up/email', { email: 'invalid', password: 1 })
    expect(response.status).toBe(400)
    expect(response.headers.getSetCookie().some(value => value.includes('session_token='))).toBe(false)
  })

  it('rejects a valid cookie after its database session expires', async () => {
    const signup = await post('sign-up/email', fixtures.credentials())
    expect(signup.status).toBe(200)
    const cookie = sessionCookie(signup)
    const active = sessionResponse.parse(await getSession(cookie))
    await target.db.update(session).set({ expiresAt: new Date(Date.now() - 60000) }).where(eq(session.id, active.session.id))
    expect(await getSession(cookie)).toBeNull()
  })
})
