import { randomBytes } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { eq } from 'drizzle-orm'
import { betterAuth } from 'better-auth'
import { verifyPassword } from 'better-auth/crypto'
import { createEmailVerificationToken } from 'better-auth/api'
import { z } from 'zod'
import { authFixtures, testDatabase } from '../helpers/auth'
import { account, session, user } from '../../server/database/schema/auth'
import { createAuth } from '../../server/auth/options'
import { parseAuthConfig } from '../../server/auth/config'

const target = testDatabase()
const fixtures = authFixtures(target.db)
const origin = 'https://auth.example.test'
const secret = randomBytes(32).toString('base64')
const sessionResponse = z.object({
  user: z.object({ id: z.string(), name: z.string(), email: z.string(), emailVerified: z.boolean() }),
  session: z.object({ id: z.string() }),
})

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  dev: false,
  browser: false,
  setupTimeout: 600000,
  nuxtConfig: {
    nitro: {
      plugins: [fileURLToPath(new URL('../fixtures/email-plugin.ts', import.meta.url))],
      handlers: [
        { route: '/__test/email', method: 'post', handler: fileURLToPath(new URL('../fixtures/email-control.ts', import.meta.url)).replaceAll('\\', '/') },
        { route: '/__test/session', method: 'get', handler: fileURLToPath(new URL('../fixtures/session.ts', import.meta.url)).replaceAll('\\', '/') },
      ],
    },
  },
  env: {
    NUXT_DATABASE_URL: target.databaseUrl,
    NUXT_BETTER_AUTH_SECRET: secret,
    NUXT_BETTER_AUTH_URL: origin,
    NUXT_GOOGLE_CLIENT_ID: '',
    NUXT_GOOGLE_CLIENT_SECRET: '',
    NUXT_RESEND_API_KEY: 're_e2e-unused',
    NUXT_EMAIL_FROM: 'Sender <sender@example.test>',
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
  // Honor native backoff once; a repeated rejection still fails the assertion.
  noSessionCookie(response)
  const seconds = Number(response.headers.get('x-retry-after'))
  expect(Number.isInteger(seconds) && seconds > 0 && seconds <= 60).toBe(true)
  await response.arrayBuffer()
  await delay(seconds * 1000)
  return request()
}

function sessionCookie(response: Response) {
  const header = response.headers.getSetCookie().find(value => value.startsWith('__Secure-better-auth.session_token='))
  expect(Boolean(header)).toBe(true)
  expect(/; HttpOnly/i.test(header ?? '')).toBe(true)
  expect(/; Secure/i.test(header ?? '')).toBe(true)
  expect(/; SameSite=Lax/i.test(header ?? '')).toBe(true)
  expect(/; Path=\//i.test(header ?? '')).toBe(true)
  expect(response.headers.getSetCookie().some(value => value.includes('session_data='))).toBe(false)
  if (!header) throw new Error('Session cookie missing')
  return header.split(';')[0]!
}

function noSessionCookie(response: Response) {
  expect(response.headers.getSetCookie().some(value => value.includes('session_token='))).toBe(false)
}

async function getSession(cookie = '') {
  const response = await fetch('/api/auth/get-session', { headers: { cookie } })
  expect(response.status).toBe(200)
  return response.json() as Promise<unknown>
}

const emailResponse = z.array(z.object({ text: z.string(), subject: z.string(), status: z.enum(['pending', 'accepted', 'failed']) }))
async function emailControl(to: string, action = 'read', mode?: string) {
  const response = await fetch('/__test/email', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to, action, mode }),
  })
  expect(response.status).toBe(200)
  return emailResponse.parse(await response.json())
}

function emailURL(text: string) {
  const value = new URL(text.slice(text.indexOf('https://')))
  expect(value.origin === origin).toBe(true)
  return value
}

async function followLink(text: string) {
  const url = emailURL(text)
  return fetch(`${url.pathname}${url.search}`, { redirect: 'manual' })
}

async function verifiedSignUp(credentials: { name: string, email: string, password: string }) {
  const signup = await post('sign-up/email', credentials)
  expect(signup.status).toBe(200)
  noSessionCookie(signup)
  expect(await signup.json()).toMatchObject({ token: null, user: { emailVerified: false } })
  await expect.poll(async () => (await emailControl(credentials.email.toLowerCase()))[0]?.status).toBe('accepted')
  const verified = await followLink((await emailControl(credentials.email.toLowerCase()))[0]!.text)
  expect(verified.status).toBe(302)
  noSessionCookie(verified)
  const signin = await post('sign-in/email', credentials)
  expect(signin.status).toBe(200)
  return signin
}

describe('mounted Better Auth server', () => {
  it('serves health, rejects guests and ignores forged identity headers', async () => {
    expect(await (await fetch('/api/auth/ok')).json()).toEqual({ ok: true })
    expect(await getSession()).toBeNull()
    const denied = await fetch('/__test/session', { headers: { 'x-user-id': 'forged', 'x-email-verified': 'true' } })
    expect(denied.status).toBe(401)
    expect(await denied.json()).toMatchObject({ data: { code: 'UNAUTHENTICATED' } })
  })

  it('persists credentials, verifies by link, signs in and revokes sessions on sign-out', async () => {
    const credentials = fixtures.credentials()
    const signin = await verifiedSignUp(credentials)
    const cookie = sessionCookie(signin)
    const active = sessionResponse.parse(await getSession(cookie))
    expect(active.user.emailVerified).toBe(true)
    const stored = await target.db.select().from(account).where(eq(account.userId, active.user.id))
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ providerId: 'credential', accountId: active.user.id })
    const hash = stored[0]?.password
    if (!hash) throw new Error('Credential hash missing')
    expect(await verifyPassword({ hash, password: credentials.password })).toBe(true)
    expect(JSON.stringify(stored).includes(credentials.password)).toBe(false)
    const projected = await fetch('/__test/session', { headers: { cookie } })
    expect(await projected.json()).toEqual(active.user)

    const invalid = await post('sign-in/email', { ...credentials, password: 'incorrect-password' })
    const unknown = await post('sign-in/email', { email: fixtures.credentials().email, password: 'incorrect-password' })
    expect(invalid.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(await invalid.json()).toEqual(await unknown.json())
    noSessionCookie(invalid)
    noSessionCookie(unknown)

    for (const stale of [cookie, cookie, '']) {
      const signout = await post('sign-out', {}, stale)
      expect(signout.status).toBe(200)
      expect(await signout.json()).toEqual({ success: true })
      expect(signout.headers.getSetCookie().some(value => /session_token=;.*Max-Age=0/i.test(value))).toBe(true)
      expect(await getSession(stale)).toBeNull()
    }
    expect(await target.db.select().from(session).where(eq(session.userId, active.user.id))).toHaveLength(0)
  })

  it.each(['name', 'email', 'password'] as const)('requires registration %s without creating an account', async (field) => {
    const credentials = fixtures.credentials()
    const body = Object.fromEntries(Object.entries(credentials).filter(([key]) => key !== field))
    const response = await post('sign-up/email', body)
    expect(response.status).toBe(400)
    noSessionCookie(response)
    expect(await target.db.select().from(user).where(eq(user.email, credentials.email))).toHaveLength(0)
  })

  it('rejects malformed registration email', async () => {
    const response = await post('sign-up/email', { ...fixtures.credentials(), email: 'invalid-email' })
    expect(response.status).toBe(400)
    noSessionCookie(response)
  })

  it.each([7, 8, 128, 129])('enforces the %i-character password boundary', async (length) => {
    const credentials = { ...fixtures.credentials(), password: 'x'.repeat(length) }
    if (length === 7 || length === 129) {
      const response = await post('sign-up/email', credentials)
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: length === 7 ? 'PASSWORD_TOO_SHORT' : 'PASSWORD_TOO_LONG' })
      noSessionCookie(response)
      expect(await target.db.select().from(user).where(eq(user.email, credentials.email))).toHaveLength(0)
    }
    else {
      expect(sessionResponse.parse(await getSession(sessionCookie(await verifiedSignUp(credentials)))).user.email).toBe(credentials.email)
    }
  })

  it('normalizes email, preserves password whitespace and returns a generic duplicate response', async () => {
    const credentials = { ...fixtures.credentials(), password: '  Keep Spaces  ' }
    const signin = await verifiedSignUp({ ...credentials, email: credentials.email.toUpperCase() })
    const active = sessionResponse.parse(await getSession(sessionCookie(signin)))
    expect(active.user.email).toBe(credentials.email)
    const duplicate = await post('sign-up/email', { ...credentials, name: 'Replacement', password: 'replacement-password' })
    expect(duplicate.status).toBe(200)
    expect(await duplicate.json()).toMatchObject({ token: null, user: { email: credentials.email } })
    noSessionCookie(duplicate)
    const rows = await target.db.select().from(user).where(eq(user.email, credentials.email))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe(credentials.name)
    expect((await post('sign-in/email', { ...credentials, password: credentials.password.trim() })).status).toBe(401)
    expect((await post('sign-in/email', credentials)).status).toBe(200)
  })

  it('expires database sessions and preserves native Unicode password normalization', async () => {
    const credentials = { ...fixtures.credentials(), password: 'Ａuth-password-123' }
    await verifiedSignUp(credentials)
    const signin = await post('sign-in/email', { ...credentials, password: 'Auth-password-123' })
    const cookie = sessionCookie(signin)
    const active = sessionResponse.parse(await getSession(cookie))
    await target.db.update(session).set({ expiresAt: new Date(Date.now() - 60000) }).where(eq(session.id, active.session.id))
    expect(await getSession(cookie)).toBeNull()
    expect((await fetch('/__test/session', { headers: { cookie } })).status).toBe(401)
  })
})

describe('mounted verification and recovery', () => {
  it('finishes HTTP before provider acceptance and requires explicit sign-in after verification', async () => {
    const credentials = fixtures.credentials()
    await emailControl(credentials.email, 'configure', 'pending')
    try {
      const signup = await post('sign-up/email', credentials)
      expect(signup.status).toBe(200)
      expect(await signup.json()).toMatchObject({ token: null, user: { emailVerified: false } })
      noSessionCookie(signup)
      await expect.poll(async () => (await emailControl(credentials.email))[0]?.status).toBe('pending')
      const unverified = await post('sign-in/email', credentials)
      expect(unverified.status).toBe(403)
      expect(await unverified.json()).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' })
      noSessionCookie(unverified)
      const resend = await post('send-verification-email', { email: credentials.email, callbackURL: `${origin}/` })
      expect(resend.status).toBe(200)
      expect(await resend.json()).toEqual({ status: true })
      await expect.poll(async () => (await emailControl(credentials.email)).length).toBe(2)
      expect((await emailControl(credentials.email)).every(message => message.status === 'pending')).toBe(true)
      await emailControl(credentials.email, 'release')
      await expect.poll(async () => (await emailControl(credentials.email)).every(message => message.status === 'accepted')).toBe(true)
      const text = (await emailControl(credentials.email))[0]!.text
      const verified = await followLink(text)
      expect(verified.status).toBe(302)
      noSessionCookie(verified)
      expect(await getSession()).toBeNull()
      const replay = await followLink(text)
      expect(replay.status).toBe(302)
      noSessionCookie(replay)
      expect((await post('sign-in/email', credentials)).status).toBe(200)
    }
    finally {
      await emailControl(credentials.email, 'release')
    }
  }, 90_000)

  it('rejects missing, tampered and expired verification tokens without creating sessions', async () => {
    const credentials = fixtures.credentials()
    expect((await post('sign-up/email', credentials)).status).toBe(200)
    await expect.poll(async () => (await emailControl(credentials.email)).length).toBe(1)
    const valid = emailURL((await emailControl(credentials.email))[0]!.text)
    valid.searchParams.set('token', 'tampered-token')
    const expired = await createEmailVerificationToken(secret, credentials.email, undefined, -60)
    for (const path of ['/api/auth/verify-email', `${valid.pathname}${valid.search}`, `/api/auth/verify-email?token=${expired}`]) {
      const response = await fetch(path, { redirect: 'manual' })
      expect(response.status >= 300 && response.status < 500).toBe(true)
      noSessionCookie(response)
    }
    const rows = await target.db.select().from(user).where(eq(user.email, credentials.email))
    expect(rows[0]?.emailVerified).toBe(false)
  })

  it('recovers by a single-use link and revokes every previous session', async () => {
    const credentials = fixtures.credentials()
    const first = sessionCookie(await verifiedSignUp(credentials))
    const second = sessionCookie(await post('sign-in/email', credentials))
    await emailControl(credentials.email, 'configure', 'pending')
    try {
      const reset = await post('request-password-reset', { email: credentials.email, redirectTo: `${origin}/reset-password` })
      expect(reset.status).toBe(200)
      noSessionCookie(reset)
      await expect.poll(async () => (await emailControl(credentials.email)).at(-1)?.status).toBe('pending')
      await emailControl(credentials.email, 'release')
      await expect.poll(async () => (await emailControl(credentials.email)).at(-1)?.status).toBe('accepted')
      const callback = await followLink((await emailControl(credentials.email)).at(-1)!.text)
      expect(callback.status).toBe(302)
      const destination = new URL(callback.headers.get('location')!)
      expect(destination.origin === origin && destination.pathname === '/reset-password').toBe(true)
      const body = { token: destination.searchParams.get('token'), newPassword: 'changed-password-123' }
      const changed = await post('reset-password', body)
      expect(changed.status).toBe(200)
      noSessionCookie(changed)
      expect(await getSession(first)).toBeNull()
      expect(await getSession(second)).toBeNull()
      expect((await post('reset-password', body)).status).toBe(400)
      expect((await post('sign-in/email', credentials)).status).toBe(401)
      expect((await post('sign-in/email', { ...credentials, password: body.newPassword })).status).toBe(200)
    }
    finally {
      await emailControl(credentials.email, 'release')
    }
  }, 90_000)

  it.each(['rate_limit', 'pending'])('keeps recovery generic after provider %s and permits recovery later', async (mode) => {
    const credentials = fixtures.credentials()
    expect((await post('sign-up/email', credentials)).status).toBe(200)
    await expect.poll(async () => (await emailControl(credentials.email))[0]?.status).toBe('accepted')
    await emailControl(credentials.email, 'configure', mode)
    const rejected = await post('request-password-reset', { email: credentials.email })
    const absent = await post('request-password-reset', { email: fixtures.credentials().email })
    expect(rejected.status).toBe(200)
    expect(absent.status).toBe(rejected.status)
    expect(await absent.json()).toEqual(await rejected.json())
    await expect.poll(async () => (await emailControl(credentials.email)).at(-1)?.status, { timeout: 15000 }).toBe('failed')
    expect((await target.db.select().from(user).where(eq(user.email, credentials.email)))[0]?.emailVerified).toBe(false)
    await emailControl(credentials.email, 'release')
    await emailControl(credentials.email, 'configure', 'accepted')
    const resend = await post('send-verification-email', { email: credentials.email })
    expect(resend.status).toBe(200)
    await expect.poll(async () => (await emailControl(credentials.email)).at(-1)?.status).toBe('accepted')
    expect((await followLink((await emailControl(credentials.email)).at(-1)!.text)).status).toBe(302)
    expect((await post('sign-in/email', credentials)).status).toBe(200)
  }, 150_000)
})

describe('session authorization is independent of verification policy', () => {
  it('preserves native endpoint differences for a callback registration error', async () => {
    const auth = createAuth(parseAuthConfig({ betterAuthSecret: secret, betterAuthUrl: origin }), target.db, async () => {
      throw new Error('Email background registration failed')
    })
    const credentials = fixtures.credentials()
    const dispatch = (path: string, body: unknown) => auth.handler(new Request(`${origin}/api/auth/${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body),
    }))
    const signup = await dispatch('sign-up/email', credentials)
    expect(signup.status).toBe(200)
    noSessionCookie(signup)
    expect((await dispatch('request-password-reset', { email: credentials.email })).status).toBe(200)
    expect((await dispatch('send-verification-email', { email: credentials.email })).status).toBe(500)
    const absent = await dispatch('send-verification-email', { email: fixtures.credentials().email })
    expect(absent.status).toBe(200)
  })

  it('accepts a real unverified session created by an explicit alternative Better Auth configuration', async () => {
    const baseline = createAuth(parseAuthConfig({ betterAuthSecret: secret, betterAuthUrl: origin }), target.db)
    const auth = betterAuth({
      ...baseline.options,
      emailAndPassword: { ...baseline.options.emailAndPassword, enabled: true, requireEmailVerification: false },
    })
    const credentials = fixtures.credentials()
    const response = await auth.handler(new Request(`${origin}/api/auth/sign-up/email`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(credentials),
    }))
    expect(response.status).toBe(200)
    const cookie = sessionCookie(response)
    const projected = await fetch('/__test/session', { headers: { cookie } })
    expect(projected.status).toBe(200)
    expect(await projected.json()).toEqual({ id: expect.any(String), name: credentials.name, email: credentials.email, emailVerified: false })
  })
})
