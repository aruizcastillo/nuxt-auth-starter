import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import { createDatabase } from '../../server/database/clients/neon'
import { account, session, user } from '../../server/database/schema/auth'
import { parseDatabaseConfig } from '../../server/database/config'

// Explicitly allow only the disposable branch verified through Neon metadata.
// Re-provisioning this branch requires reviewing the new endpoint here.
export function testDatabase() {
  const { databaseUrl } = parseDatabaseConfig({ databaseUrl: process.env.NUXT_DATABASE_URL })
  const url = new URL(databaseUrl)
  if (process.env.NEON_BRANCH !== 'test-phase3'
    || url.hostname !== 'ep-rough-resonance-zadpdt75-pooler.c-2.eu-west-2.aws.neon.tech'
    || url.pathname !== '/nuxt_auth_starter_db') {
    throw new Error('Supply the verified test-phase3 target explicitly; development/production targets are forbidden')
  }
  return { databaseUrl, db: createDatabase(databaseUrl) }
}

export function authFixtures(db: ReturnType<typeof createDatabase>) {
  const emails: string[] = []
  return {
    credentials() {
      const email = `phase3-${randomUUID()}@example.test`
      emails.push(email)
      return { name: 'Phase 3 integration', email, password: randomUUID() }
    },
    async cleanup() {
      if (!emails.length) return
      const rows = await db.select({ id: user.id }).from(user).where(inArray(user.email, emails))
      for (const row of rows) {
        await db.delete(session).where(eq(session.userId, row.id))
        await db.delete(account).where(eq(account.userId, row.id))
        await db.delete(user).where(eq(user.id, row.id))
      }
    },
  }
}
