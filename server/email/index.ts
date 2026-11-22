import { EmailDeliveryError } from './delivery-error'
import { sendConsoleEmail } from './providers/console'
import { createResendSender, isResendUnconfigured } from './providers/resend'

export interface Email {
  to: string
  subject: string
  text: string
}

export type EmailPurpose = 'verification' | 'password_reset'
export type SendEmail = (email: Email, purpose: EmailPurpose) => Promise<void>

export function createEmailSender(config: unknown, development: boolean, fetcher?: typeof fetch): SendEmail {
  if (development && isResendUnconfigured(config)) return sendConsoleEmail

  const send = createResendSender(config, fetcher)
  return async (email, purpose) => {
    const deliveryId = crypto.randomUUID()
    console.info('auth_email_requested', { purpose, deliveryId })
    try {
      const { id: providerMessageId } = await send(email)
      console.info('auth_email_accepted', { purpose, deliveryId, providerMessageId })
    }
    catch (error) {
      const code = error instanceof EmailDeliveryError ? error.code : 'unexpected'
      console.error('auth_email_failed', { purpose, deliveryId, code })
      throw error
    }
  }
}
