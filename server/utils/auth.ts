import { useRuntimeConfig, type RequestEvent } from 'nuxt/server'
import { createAuth } from '../auth/options'
import { createDatabase } from '../database'
import { parseAuthConfig } from '../auth/config'
import { parseDatabaseConfig } from '../database/config'
import { createBackgroundHandler } from '../background'
import { createEmailSender } from '../email'

export function useServerAuth(event: RequestEvent) {
  // Validate hosting support before Better Auth performs any account lookup.
  const register = createBackgroundHandler(event)
  const config = useRuntimeConfig()
  const settings = parseAuthConfig(config, import.meta.dev)
  const { databaseUrl } = parseDatabaseConfig(config)
  return createAuth(settings, createDatabase(databaseUrl), createEmailSender(config, register))
}
