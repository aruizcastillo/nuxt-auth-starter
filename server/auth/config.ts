import { z } from 'zod'
import { formatConfigError } from '../utils/config-error'

// Better Auth runtime configuration.
// The caller supplies import.meta.dev; HTTPS is mandatory outside local development.
export function parseAuthConfig(config: unknown, development = false) {
  const origin = z.url({ protocol: /^https?$/, hostname: /.+/ }).refine((value) => {
    if (!URL.canParse(value)) return false
    const url = new URL(value)
    return (value === url.origin || value === `${url.origin}/`)
      && (url.protocol === 'https:' || (development && url.hostname === 'localhost'))
  })
  const schema = z.object({
    betterAuthSecret: z.string().min(32).refine(value => value.trim().length >= 32),
    betterAuthUrl: origin,
  })
  const result = schema.safeParse(config)
  if (!result.success) throw new Error(formatConfigError(result.error))
  return result.data
}
