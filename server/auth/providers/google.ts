import type { BetterAuthOptions } from 'better-auth'
import { z } from 'zod'
import { formatConfigError } from '../../utils/config-error'

const googleConfigSchema = z.object({
  googleClientId: z.string().trim().min(1),
  googleClientSecret: z.string().trim().min(1),
})

// Compose into socialProviders when Google is installed; both values are required.
export function createGoogleProvider(config: unknown) {
  const result = googleConfigSchema.safeParse(config)
  if (!result.success) throw new Error(formatConfigError(result.error))
  const settings = result.data
  return {
    google: {
      clientId: settings.googleClientId,
      clientSecret: settings.googleClientSecret,
    },
  } satisfies BetterAuthOptions['socialProviders']
}
