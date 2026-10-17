import { randomBytes } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { eq } from 'drizzle-orm'
import { verifyPassword } from 'better-auth/crypto'
import { z } from 'zod'
import { authFixtures, testDatabase } from '../helpers/auth'
import { account, session, user } from '../../server/database/schema/auth'
import { createAuth } from '../../server/auth/options'
import { parseAuthConfig } from '../../server/auth/config'
import { createEmailSender, type SendEmail } from '../../server/email'
import { createBackgroundHandler } from '../../server/background'

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
  nuxtConfig: {
    nitro: {
      plugins: [fileURLToPath(new URL('../fixtures/email-plugin.ts', import.meta.url))],
      // Nitro 2 embeds handler paths in JS imports; normalize Windows separators.
      handlers: [{ route: '/__test/email', method: 'post', handler: fileURLToPath(new URL('../fixtures/email-control.ts', import.meta.url)).replaceAll('\\', '/') }],
    },
  },
  env: {
    NUXT_DATABASE_URL: target.databaseUrl,
    NUXT_BETTER_AUTH_SECRET: randomBytes(32).toString('base64'),
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
  // Keep Better Auth's native rules: credentials 3/10s, email requests 3/60s.
  // Honor its actual backoff header once; never mask a repeated rejection.
  noSessionCookie(response)
  const seconds = Number(response.headers.get('x-retry-after'))
  expect(Number.isInteger(seconds) && seconds > 0 && seconds <= 60).toBe(true)
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

// Verification is sent at sign-up but is not required until the policy phase.
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

const emailResponse = z.array(z.object({ text: z.string(), subject: z.string(), status: z.enum(['pending', 'accepted', 'failed']) }))

async function emailControl(to: string, action = 'read', mode?: string) {
  const response = await fetch('/__test/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ to, action, mode }),
  })
  expect(response.status).toBe(200)
  return emailResponse.parse(await response.json())
}

function emailURL(text: string) {
  const value = new URL(text.slice(text.indexOf('https://')))
  expect(value.origin === origin).toBe(true)
  return value
}

describe('mounted email callbacks', () => {
  it('sends native sign-up, resend and recovery links without waiting for delivery', async () => {
    const credentials = fixtures.credentials()
    await emailControl(credentials.email, 'configure', 'pending')
    try {
      const signup = await post('sign-up/email', credentials)
      expect(signup.status).toBe(200)
      const cookie = sessionCookie(signup)
      expect(sessionResponse.parse(await getSession(cookie)).user.emailVerified).toBe(false)
      await expect.poll(async () => (await emailControl(credentials.email)).length).toBe(1)
      expect((await emailControl(credentials.email))[0]?.status).toBe('pending')

      const resend = await post('send-verification-email', { email: credentials.email, callbackURL: `${origin}/` })
      expect(resend.status).toBe(200)
      expect(await resend.json()).toEqual({ status: true })
      await expect.poll(async () => (await emailControl(credentials.email)).length).toBe(2)
      expect((await emailControl(credentials.email)).every(email => email.status === 'pending')).toBe(true)
      await emailControl(credentials.email, 'release')
      const verification = emailURL((await emailControl(credentials.email))[0]!.text)
      expect(verification.pathname === '/api/auth/verify-email').toBe(true)
      const verified = await fetch(`${verification.pathname}${verification.search}`, { redirect: 'manual' })
      expect(verified.status).toBe(302)
      expect(sessionResponse.parse(await getSession(cookie)).user.emailVerified).toBe(true)

      const reset = await post('request-password-reset', { email: credentials.email, redirectTo: `${origin}/reset-password` })
      expect(reset.status).toBe(200)
      await expect.poll(async () => (await emailControl(credentials.email)).length).toBe(3)
      expect((await emailControl(credentials.email))[2]?.status).toBe('pending')
      const unknown = fixtures.credentials()
      const absent = await post('request-password-reset', { email: unknown.email, redirectTo: `${origin}/reset-password` })
      expect(absent.status).toBe(reset.status)
      expect(await absent.json()).toEqual(await reset.json())
      expect(await emailControl(unknown.email)).toEqual([])

      await emailControl(credentials.email, 'release')
      const recovery = emailURL((await emailControl(credentials.email))[2]!.text)
      expect(recovery.pathname.startsWith('/api/auth/reset-password/')).toBe(true)
      const callback = await fetch(`${recovery.pathname}${recovery.search}`, { redirect: 'manual' })
      expect(callback.status).toBe(302)
      const destination = new URL(callback.headers.get('location')!)
      expect(destination.origin === origin && destination.pathname === '/reset-password').toBe(true)
      const changed = await post('reset-password', { token: destination.searchParams.get('token'), newPassword: 'changed-password-123' })
      expect(changed.status).toBe(200)
      const signin = await post('sign-in/email', { ...credentials, password: 'changed-password-123' })
      expect(signin.status).toBe(200)
    }
    finally {
      await emailControl(credentials.email, 'release')
    }
  })

  it('acknowledges recovery identically for provider rejection and an unknown account', async () => {
    const credentials = fixtures.credentials()
    expect((await post('sign-up/email', credentials)).status).toBe(200)
    await emailControl(credentials.email, 'configure', 'rate_limit')
    const rejected = await post('request-password-reset', { email: credentials.email })
    const absent = await post('request-password-reset', { email: fixtures.credentials().email })
    expect(rejected.status).toBe(200)
    expect(absent.status).toBe(rejected.status)
    expect(await absent.json()).toEqual(await rejected.json())
    await expect.poll(async () => (await emailControl(credentials.email)).at(-1)?.status).toBe('failed')
  }, 90_000)
})

describe('per-request email preparation with the real Better Auth handler and database', () => {
  it.each(['incomplete Resend settings', 'missing Vercel context'])('isolates %s from sessions and link consumption and rejects send flows before lookup', async (failure) => {
    const settings = parseAuthConfig({ betterAuthSecret: randomBytes(32).toString('base64'), betterAuthUrl: origin })
    const config = { resendApiKey: 're_local-unused', emailFrom: 'sender@example.test' }
    const messages: { text: string }[] = []
    const tasks: Promise<unknown>[] = []
    const fetcher: typeof globalThis.fetch = async (_input, init) => {
      messages.push(z.object({ text: z.string() }).parse(JSON.parse(String(init?.body))))
      return Response.json({ id: crypto.randomUUID() })
    }
    const ready = vi.fn(() => createEmailSender(config, task => tasks.push(task), fetcher))
    const unavailable = vi.fn(() => failure === 'incomplete Resend settings'
      ? createEmailSender({ resendApiKey: config.resendApiKey }, task => tasks.push(task), fetcher)
      : createEmailSender(config, createBackgroundHandler(undefined, 'vercel'), fetcher))
    // Match runtime ownership: construct a new Better Auth instance for every request.
    const dispatch = (path: string, body?: unknown, cookie = '', factory: () => SendEmail = unavailable) => {
      const auth = createAuth(settings, target.db, factory)
      return auth.handler(new Request(new URL(path, `${origin}/api/auth/`), {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'content-type': 'application/json', origin, cookie },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }))
    }

    const credentials = fixtures.credentials()
    const signup = await dispatch('sign-up/email', credentials, '', ready)
    expect(signup.status).toBe(200)
    await Promise.all(tasks)
    const cookie = sessionCookie(signup)
    const reset = await dispatch('request-password-reset', { email: credentials.email, redirectTo: `${origin}/reset-password` }, '', ready)
    expect(reset.status).toBe(200)
    await Promise.all(tasks)
    expect(messages).toHaveLength(2)
    // Hook and callback share one preparation, while distinct requests prepare separately.
    expect(ready).toHaveBeenCalledTimes(2)

    expect((await dispatch('sign-in/email', credentials)).status).toBe(200)
    const active = await dispatch('get-session', undefined, cookie)
    expect(active.status).toBe(200)
    expect(sessionResponse.parse(await active.json()).user.email).toBe(credentials.email)
    const verified = await dispatch(emailURL(messages[0]!.text).href)
    expect(verified.status).toBe(302)
    expect(sessionResponse.parse(await (await dispatch('get-session', undefined, cookie)).json()).user.emailVerified).toBe(true)
    const callback = await dispatch(emailURL(messages[1]!.text).href)
    expect(callback.status).toBe(302)
    const destination = new URL(callback.headers.get('location')!)
    const changed = await dispatch('reset-password', { token: destination.searchParams.get('token'), newPassword: 'changed-password-123' })
    expect(changed.status).toBe(200)
    const signin = await dispatch('sign-in/email', { ...credentials, password: 'changed-password-123' })
    expect(signin.status).toBe(200)
    const signedOut = await dispatch('sign-out', {}, sessionCookie(signin))
    expect(signedOut.status).toBe(200)
    expect(await signedOut.json()).toEqual({ success: true })
    clearedSessionCookie(signedOut)
    expect(await (await dispatch('get-session', undefined, sessionCookie(signin))).json()).toBeNull()
    expect(unavailable).not.toHaveBeenCalled()

    const query = vi.spyOn(target.db.$client, 'query')
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const unknown = fixtures.credentials()
      for (const path of ['sign-up/email', 'send-verification-email', 'request-password-reset']) {
        for (const identity of [credentials, unknown]) {
          const response = await dispatch(path, identity)
          expect(response.status).toBe(503)
          expect(await response.json()).toEqual({ code: 'EMAIL_DELIVERY_UNAVAILABLE', message: 'Email delivery is unavailable' })
          noSessionCookie(response)
        }
      }
      expect(unavailable).toHaveBeenCalledTimes(6)
      expect(query).not.toHaveBeenCalled()
      expect(messages).toHaveLength(2)
      expect(errors.mock.calls.every(args => args.length === 1 && ['auth_email_unavailable', 'background_tasks_unavailable'].includes(args[0]))).toBe(true)
    }
    finally {
      query.mockRestore()
      errors.mockRestore()
    }
  })
})
