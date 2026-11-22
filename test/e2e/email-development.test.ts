import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { afterAll, expect, it } from 'vitest'
import { fetch, getServerLogs, setup } from '@nuxt/test-utils/e2e'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { authFixtures, testDatabase } from '../helpers/auth'
import { account, session, user } from '../../server/database/schema/auth'

const target = testDatabase()
const fixtures = authFixtures(target.db)
const origin = 'https://auth.example.test'

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  dev: true,
  browser: false,
  setupTimeout: 600000,
  env: {
    NUXT_DATABASE_URL: target.databaseUrl,
    NUXT_BETTER_AUTH_SECRET: randomBytes(32).toString('base64'),
    NUXT_BETTER_AUTH_URL: origin,
    NUXT_RESEND_API_KEY: '',
    NUXT_EMAIL_FROM: '',
  },
})
afterAll(() => fixtures.cleanup())

const logPrefix = '[auth-email:development] '
const consoleMessage = z.object({
  purpose: z.enum(['verification', 'password_reset']),
  to: z.string(),
  text: z.string(),
})

async function followConsoleLink(to: string, purpose: z.infer<typeof consoleMessage>['purpose']) {
  const readMessage = () => getServerLogs()
    .filter(line => line.startsWith(logPrefix))
    .map(line => consoleMessage.parse(JSON.parse(line.slice(logPrefix.length))))
    .find(message => message.to === to && message.purpose === purpose)

  await expect.poll(() => Boolean(readMessage())).toBe(true)
  const message = readMessage()
  if (!message) throw new Error('Development email was not logged')
  const url = new URL(message.text.slice(message.text.indexOf('https://')))
  expect(url.origin === origin).toBe(true)
  return fetch(`${url.pathname}${url.search}`, { redirect: 'manual' })
}

it('verifies and resets a password via native links printed without a provider', async () => {
  expect((await fetch('/api/auth/ok')).status).toBe(200)
  const credentials = fixtures.credentials()
  const post = (path: string, body: unknown = credentials) => fetch(`/api/auth/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(body),
  })
  const signup = await post('sign-up/email')
  expect(signup.status).toBe(200)
  expect(await signup.json()).toMatchObject({ token: null, user: { emailVerified: false } })
  expect(signup.headers.getSetCookie().some(value => value.includes('session_token='))).toBe(false)
  const rows = await target.db.select().from(user).where(eq(user.email, credentials.email))
  expect(rows).toHaveLength(1)
  expect(rows[0]?.emailVerified).toBe(false)
  expect(await target.db.select().from(account).where(eq(account.userId, rows[0]!.id))).toHaveLength(1)
  expect(await target.db.select().from(session).where(eq(session.userId, rows[0]!.id))).toHaveLength(0)
  expect((await post('sign-in/email')).status).toBe(403)
  expect(await (await fetch('/api/auth/get-session')).json()).toBeNull()

  const verification = await followConsoleLink(credentials.email, 'verification')
  expect(verification.status).toBe(302)
  expect(verification.headers.getSetCookie().some(value => value.includes('session_token='))).toBe(false)
  expect((await post('sign-in/email')).status).toBe(200)

  const reset = await post('request-password-reset', { email: credentials.email, redirectTo: `${origin}/reset-password` })
  expect(reset.status).toBe(200)
  const recovery = await followConsoleLink(credentials.email, 'password_reset')
  expect(recovery.status).toBe(302)
  const destination = new URL(recovery.headers.get('location') ?? '')
  expect(destination.origin === origin && destination.pathname === '/reset-password').toBe(true)
  const token = destination.searchParams.get('token')
  expect(Boolean(token)).toBe(true)
  const newPassword = randomBytes(24).toString('hex')
  expect((await post('reset-password', { token, newPassword })).status).toBe(200)
  expect((await post('sign-in/email')).status).toBe(401)
  expect((await post('sign-in/email', { email: credentials.email, password: newPassword })).status).toBe(200)
})
