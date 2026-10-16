import { useRuntimeConfig } from 'nuxt/server'
import { createAuth } from '../auth/options'
import { createDatabase } from '../database'
import { parseAuthConfig } from '../auth/config'
import { parseDatabaseConfig } from '../database/config'

export function useServerAuth() {
  const config = useRuntimeConfig()
  const settings = parseAuthConfig(config, import.meta.dev)
  const { databaseUrl } = parseDatabaseConfig(config)
  return createAuth(settings, createDatabase(databaseUrl))
}
