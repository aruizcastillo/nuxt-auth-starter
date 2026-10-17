import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2'
import type { Database } from '../database'
import { authTables } from '../database/schema'
import type { parseAuthConfig } from './config'
import type { SendEmail } from '../email'

// Pure Better Auth factory.
// Environment loading and database creation stay outside this function, making the auth configuration reusable from Nuxt runtime, tooling and tests.
export function createAuth(settings: ReturnType<typeof parseAuthConfig>, database: Database, sendEmail?: SendEmail) {
  return betterAuth({
    database: drizzleAdapter(database, {
      provider: 'pg',
      schema: authTables,
      transaction: false,
    }),
    baseURL: settings.betterAuthUrl,
    secret: settings.betterAuthSecret,
    basePath: '/api/auth',
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      ...(sendEmail && {
        sendResetPassword: async ({ user, url }) => {
          await sendEmail({ to: user.email, subject: 'Reset your password', text: `Reset your password: ${url}` }, 'password_reset')
        },
      }),
    },
    ...(sendEmail && {
      emailVerification: {
        sendOnSignUp: true,
        sendVerificationEmail: async ({ user, url }) => {
          await sendEmail({ to: user.email, subject: 'Verify your email', text: `Verify your email: ${url}` }, 'verification')
        },
      },
    }),
    // Cookie caching is explicitly disabled so session reads use the database.
    session: { cookieCache: { enabled: false } },
  })
}
