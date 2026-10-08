import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { relations } from '../schema'

// The server caller validates the URL with parseDatabaseConfig(useRuntimeConfig(event)).
export function createDatabase(databaseUrl: string) {
  return drizzle({ client: neon(databaseUrl), relations })
}
