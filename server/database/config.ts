import { z } from 'zod'
import { formatConfigError } from '../utils/config-error'

const databaseSchema = z.object({
  databaseUrl: z.url({ protocol: /^postgres(ql)?$/, hostname: /.+/ }),
})

// Database config is parsed lazily when database functionality is initialized.
// Runtime callers pass useRuntimeConfig(event); tooling supplies values directly.
export function parseDatabaseConfig(config: unknown) {
  const result = databaseSchema.safeParse(config)
  if (!result.success) throw new Error(formatConfigError(result.error))
  return result.data
}
