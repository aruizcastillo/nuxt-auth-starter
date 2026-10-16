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

export function parseResendConfig(config: unknown) {
  const result = resendConfigSchema.safeParse(config)
  if (!result.success) throw new Error(formatConfigError(result.error))
  return result.data
}

export interface ResendEmail {
  to: string
  subject: string
  text: string
}

export type ResendErrorCode = 'authentication' | 'rate_limit' | 'rejected' | 'provider' | 'timeout' | 'network' | 'invalid_response'

export class ResendDeliveryError extends Error {
  constructor(public readonly code: ResendErrorCode) {
    super(`Email transport failed: ${code}`)
    this.name = 'ResendDeliveryError'
  }
}

const acceptedEmailSchema = z.object({ id: z.uuid() })
const providerErrorSchema = z.object({ name: z.string(), message: z.string() })

function classifyFailure(status: number, data: unknown): ResendErrorCode {
  const error = providerErrorSchema.safeParse(data)
  if (status === 401) return 'authentication'
  if (status === 429) return 'rate_limit'
  if (status >= 500) return 'provider'
  if (error.success && (
    (status === 403 && ['restricted_api_key', 'suspended_api_key', 'invalid_permission'].includes(error.data.name))
    || (status === 400 && error.data.name === 'validation_error' && error.data.message === 'API key is invalid')
  )) return 'authentication'
  return 'rejected'
}

// The future runtime caller supplies useRuntimeConfig(); no request is retained.
export function createResendSender(config: unknown, fetcher: typeof fetch = fetch) {
  const settings = parseResendConfig(config)

  return async function sendEmail({ to, subject, text }: ResendEmail): Promise<{ id: string }> {
    // Native fetch keeps this deadline active through body consumption, too.
    const signal = AbortSignal.timeout(10_000)
    try {
      const response = await fetcher('https://api.resend.com/emails', {
        method: 'POST',
        redirect: 'error',
        signal,
        headers: {
          'Authorization': `Bearer ${settings.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: settings.emailFrom, to, subject, text }),
      })
      let data: unknown
      try {
        data = await response.json()
      }
      catch (error) {
        if (!(error instanceof SyntaxError)) throw error
      }
      if (!response.ok) throw new ResendDeliveryError(classifyFailure(response.status, data))
      const result = acceptedEmailSchema.safeParse(data)
      if (!result.success) throw new ResendDeliveryError('invalid_response')
      return result.data
    }
    catch (error) {
      if (signal.aborted) throw new ResendDeliveryError('timeout')
      if (error instanceof ResendDeliveryError) throw error
      // Never retain a cause, response, request, or provider message (including URLs/tokens).
      throw new ResendDeliveryError('network')
    }
  }
}
