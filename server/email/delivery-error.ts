export type EmailDeliveryErrorCode = 'authentication' | 'rate_limit' | 'rejected' | 'provider' | 'timeout' | 'network' | 'invalid_response'

export class EmailDeliveryError extends Error {
  constructor(public readonly code: EmailDeliveryErrorCode) {
    super(`Email transport failed: ${code}`)
    this.name = 'EmailDeliveryError'
  }
}
