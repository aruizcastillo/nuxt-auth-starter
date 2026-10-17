import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { afterAll, expect, it } from 'vitest'
import { fetch, getServerLogs, setup } from '@nuxt/test-utils/e2e'
import { eq } from 'drizzle-orm'
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

it('starts without mail, retains an unverified registration and blocks password sign-in', async () => {
  expect((await fetch('/api/auth/ok')).status).toBe(200)
  const credentials = fixtures.credentials()
  const post = (path: string) => fetch(`/api/auth/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(credentials),
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
  await expect.poll(() => JSON.stringify(getServerLogs()).includes('not_configured')).toBe(true)
})
