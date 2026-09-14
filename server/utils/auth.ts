import type { H3Event } from 'h3'
import { useRuntimeConfig } from '#imports'
import { createAuth } from '../auth/options'
import { createDatabase } from '../database/clients/neon'
import { parseAuthConfig } from '../auth/config'
import { parseDatabaseConfig } from '../database/config'

export function useServerAuth(event: H3Event) {
  const config = useRuntimeConfig(event)
  const settings = parseAuthConfig(config, import.meta.dev)
  const { databaseUrl } = parseDatabaseConfig(config)
  return createAuth(settings, createDatabase(databaseUrl))
}
