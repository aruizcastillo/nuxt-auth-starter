import 'dotenv/config'
import { createAuth } from './options'
import { createDatabase } from '../database/clients/neon'
import { parseAuthConfig } from './config'
import { parseDatabaseConfig } from '../database/config'

// Tooling entrypoint.
// This file runs outside Nuxt/Nitro, so it reads environment variables directly instead of using useRuntimeConfig().
const settings = parseAuthConfig({
  betterAuthSecret: process.env.NUXT_BETTER_AUTH_SECRET,
  betterAuthUrl: process.env.NUXT_BETTER_AUTH_URL,
}, process.env.NODE_ENV === 'development')
const { databaseUrl } = parseDatabaseConfig({ databaseUrl: process.env.NUXT_DATABASE_URL })

// Shared Better Auth instance used by CLI/tooling.
export const auth = createAuth(settings, createDatabase(databaseUrl))
