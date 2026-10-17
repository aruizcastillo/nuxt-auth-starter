import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2'
import type { Database } from '../database'
import { authTables } from '../database/schema'
import type { parseAuthConfig } from './config'
import type { SendEmail } from '../email'

// Pure Better Auth factory.
// Environment loading and database creation stay outside this function, making the auth configuration reusable from Nuxt runtime, tooling and tests.
export function createAuth(settings: ReturnType<typeof parseAuthConfig>, database: Database, createSender?: () => SendEmail) {
  // Runtime auth is instantiated per request; the hook and callbacks share only this sender.
  let sender: SendEmail | undefined
  const prepareSender = createSender && (() => {
    try {
      return sender ??= createSender()
    }
    catch {
      console.error('auth_email_unavailable')
      throw new APIError('SERVICE_UNAVAILABLE', {
        code: 'EMAIL_DELIVERY_UNAVAILABLE',
        message: 'Email delivery is unavailable',
      })
    }
  })

  return betterAuth({
    database: drizzleAdapter(database, {
      provider: 'pg',
      schema: authTables,
      transaction: false,
    }),
    baseURL: settings.betterAuthUrl,
    secret: settings.betterAuthSecret,
    basePath: '/api/auth',
    ...(prepareSender && {
      hooks: {
        before: createAuthMiddleware(async (ctx) => {
          // Extend these explicit routes whenever adding email triggers.
          // Availability must be checked before any account-dependent branch.
          if (ctx.path === '/sign-up/email'
            || ctx.path === '/send-verification-email'
            || ctx.path === '/request-password-reset') {
            prepareSender()
          }
        }),
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      ...(prepareSender && {
        sendResetPassword: async ({ user, url }) => {
          await prepareSender()({ to: user.email, subject: 'Reset your password', text: `Reset your password: ${url}` }, 'password_reset')
        },
      }),
    },
    ...(prepareSender && {
      emailVerification: {
        sendOnSignUp: true,
        sendVerificationEmail: async ({ user, url }) => {
          await prepareSender()({ to: user.email, subject: 'Verify your email', text: `Verify your email: ${url}` }, 'verification')
        },
      },
    }),
    // Cookie caching is explicitly disabled so session reads use the database.
    session: { cookieCache: { enabled: false } },
  })
}
