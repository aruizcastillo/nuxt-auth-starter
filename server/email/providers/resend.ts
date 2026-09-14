import { z } from 'zod'
import { formatConfigError } from '../../utils/config-error'

const resendConfigSchema = z.object({
  resendApiKey: z.string().trim().min(1),
  emailFrom: z.string().trim().min(1).refine((value) => {
    // Accept both "email@example.com" and "Name <email@example.com>".
    const address = value.match(/^[^<>\r\n]+ <([^<>\r\n]+)>$/)?.[1] ?? value
    return z.email().safeParse(address).success
  }),
})

// Phase 4's delivery implementation belongs here and owns these requirements.
export function parseResendConfig(config: unknown) {
  const result = resendConfigSchema.safeParse(config)
  if (!result.success) throw new Error(formatConfigError(result.error))
  return result.data
}
