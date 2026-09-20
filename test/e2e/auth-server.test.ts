import { randomBytes } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { eq } from 'drizzle-orm'
import { verifyPassword } from 'better-auth/crypto'
import { z } from 'zod'
import { authFixtures, testDatabase } from '../helpers/auth'
import { account, session, user } from '../../server/database/schema/auth'

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

async function post(path: string, body: unknown, cookie = '') {
  const request = () => fetch(`/api/auth/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin, cookie },
    body: JSON.stringify(body),
  })
  const response = await request()
  if (response.status !== 429) return response
  // The production server keeps Better Auth 1.7.3's 3 requests/10s rule.
  // Honor its actual backoff header once; never mask a repeated rejection.
  noSessionCookie(response)
  const seconds = Number(response.headers.get('x-retry-after'))
  expect(Number.isInteger(seconds) && seconds > 0 && seconds <= 10).toBe(true)
  await response.arrayBuffer()
  await delay(seconds * 1000)
  return request()
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

function noSessionCookie(response: Response) {
  expect(response.headers.getSetCookie().some(value => value.includes('session_token='))).toBe(false)
}

function clearedSessionCookie(response: Response) {
  expect(response.headers.getSetCookie().some(value => /^__Secure-better-auth\.session_token=;.*Max-Age=0/i.test(value))).toBe(true)
}

// Credential-only phase: verification will deliberately change these expectations later.
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
    expect(stored[0]?.accountId).toBe(first.user.id)
    const storedUsers = await target.db.select().from(user).where(eq(user.id, first.user.id))
    const storedSessions = await target.db.select().from(session).where(eq(session.userId, first.user.id))
    expect(storedUsers).toHaveLength(1)
    expect(storedUsers[0]?.name).toBe(credentials.name)
    expect(storedSessions).toHaveLength(1)
    expect(JSON.stringify([stored, storedUsers, storedSessions]).includes(credentials.password)).toBe(false)
    const signupBody = await signup.text()
    expect(signupBody.includes(credentials.password)).toBe(false)
    const hash = stored[0]?.password
    if (!hash) throw new Error('Stored credential hash missing')
    expect(signupBody.includes(hash)).toBe(false)
    expect(await verifyPassword({ hash, password: credentials.password })).toBe(true)

    const invalid = await post('sign-in/email', { email: credentials.email, password: 'incorrect-password' })
    expect(invalid.status).toBe(401)
    expect(invalid.headers.getSetCookie().some(value => value.includes('session_token='))).toBe(false)
    const unknown = await post('sign-in/email', { email: fixtures.credentials().email, password: 'incorrect-password' })
    expect(unknown.status).toBe(401)
    noSessionCookie(unknown)
    const error = await invalid.json()
    expect(error).toEqual({ code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' })
    expect(await unknown.json()).toEqual(error)
    expect((await target.db.select({ id: session.id }).from(session).where(eq(session.userId, first.user.id))).length).toBe(1)

    const signout = await post('sign-out', {}, signupCookie)
    expect(signout.status).toBe(200)
    expect(await signout.json()).toEqual({ success: true })
    expect(signout.headers.getSetCookie().some(value => /session_token=;.*Max-Age=0/i.test(value))).toBe(true)
    expect(await getSession(signupCookie)).toBeNull()
    expect((await target.db.select({ id: session.id }).from(session).where(eq(session.id, first.session.id))).length).toBe(0)

    const signin = await post('sign-in/email', { email: credentials.email, password: credentials.password })
    expect(signin.status).toBe(200)
    const signinCookie = sessionCookie(signin)
    const second = sessionResponse.parse(await getSession(signinCookie))
    expect(second.user.id).toBe(first.user.id)
    expect(second.session.id).not.toBe(first.session.id)
    const signinBody = await signin.text()
    expect(signinBody.includes(credentials.password)).toBe(false)
    expect(signinBody.includes(hash)).toBe(false)
    for (const cookie of [signinCookie, signinCookie, '']) {
      const response = await post('sign-out', {}, cookie)
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ success: true })
      clearedSessionCookie(response)
      expect(await getSession(cookie)).toBeNull()
    }
    expect(await getSession(signinCookie)).toBeNull()
    expect((await target.db.select({ id: session.id }).from(session).where(eq(session.userId, first.user.id))).length).toBe(0)
  })

  it('rejects malformed input without issuing a session', async () => {
    const response = await post('sign-up/email', { email: 'invalid', password: 1 })
    expect(response.status).toBe(400)
    expect(response.headers.getSetCookie().some(value => value.includes('session_token='))).toBe(false)
  })

  it.each(['name', 'email', 'password'] as const)('requires registration %s', async (field) => {
    const credentials = fixtures.credentials()
    const body = Object.fromEntries(Object.entries(credentials).filter(([key]) => key !== field))
    const response = await post('sign-up/email', body)
    expect(response.status).toBe(400)
    noSessionCookie(response)
    expect((await target.db.select({ id: user.id }).from(user).where(eq(user.email, credentials.email))).length).toBe(0)
  })

  it('rejects an invalid registration email', async () => {
    const response = await post('sign-up/email', { ...fixtures.credentials(), email: 'invalid-email' })
    expect(response.status).toBe(400)
    noSessionCookie(response)
  })

  it.each([7, 8, 128, 129])('enforces the %i-character password boundary', async (length) => {
    const credentials = { ...fixtures.credentials(), password: 'x'.repeat(length) }
    const response = await post('sign-up/email', credentials)
    if (length === 7 || length === 129) {
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: length === 7 ? 'PASSWORD_TOO_SHORT' : 'PASSWORD_TOO_LONG' })
      noSessionCookie(response)
      expect((await target.db.select({ id: user.id }).from(user).where(eq(user.email, credentials.email))).length).toBe(0)
    }
    else {
      expect(response.status).toBe(200)
      const active = sessionResponse.parse(await getSession(sessionCookie(response)))
      expect(active.user.email).toBe(credentials.email)
      const signin = await post('sign-in/email', credentials)
      expect(signin.status).toBe(200)
      expect(sessionResponse.parse(await getSession(sessionCookie(signin))).user.id).toBe(active.user.id)
    }
  })

  it('normalizes email, preserves password whitespace and rejects duplicate registration', async () => {
    const credentials = { ...fixtures.credentials(), password: '  Keep Spaces  ' }
    const signup = await post('sign-up/email', { ...credentials, email: credentials.email.toUpperCase() })
    expect(signup.status).toBe(200)
    const cookie = sessionCookie(signup)
    const active = sessionResponse.parse(await getSession(cookie))
    expect(active.user.email).toBe(credentials.email)
    const duplicate = await post('sign-up/email', { ...credentials, name: 'Replacement', password: 'replacement-password' })
    expect(duplicate.status).toBe(422)
    expect(await duplicate.json()).toMatchObject({ code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' })
    noSessionCookie(duplicate)
    const rows = await target.db.select().from(user).where(eq(user.email, credentials.email))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe(credentials.name)
    expect((await target.db.select({ id: account.id }).from(account).where(eq(account.userId, active.user.id))).length).toBe(1)
    expect((await target.db.select({ id: session.id }).from(session).where(eq(session.userId, active.user.id))).length).toBe(1)
    const trimmed = await post('sign-in/email', { ...credentials, password: credentials.password.trim() })
    expect(trimmed.status).toBe(401)
    noSessionCookie(trimmed)
    const signin = await post('sign-in/email', { ...credentials, email: credentials.email.toUpperCase() })
    expect(signin.status).toBe(200)
    expect(sessionResponse.parse(await getSession(sessionCookie(signin))).user.id).toBe(active.user.id)
  })

  it('rejects a valid cookie after its database session expires', async () => {
    const signup = await post('sign-up/email', fixtures.credentials())
    expect(signup.status).toBe(200)
    const cookie = sessionCookie(signup)
    const active = sessionResponse.parse(await getSession(cookie))
    await target.db.update(session).set({ expiresAt: new Date(Date.now() - 60000) }).where(eq(session.id, active.session.id))
    expect(await getSession(cookie)).toBeNull()
  })

  it('preserves Better Auth native Unicode password normalization', async () => {
    const credentials = { ...fixtures.credentials(), password: 'Ａuth-password-123' }
    const signup = await post('sign-up/email', credentials)
    expect(signup.status).toBe(200)
    const active = sessionResponse.parse(await getSession(sessionCookie(signup)))
    const signin = await post('sign-in/email', { ...credentials, password: 'Auth-password-123' })
    expect(signin.status).toBe(200)
    expect(sessionResponse.parse(await getSession(sessionCookie(signin))).user.id).toBe(active.user.id)
  })
})
