import { createResendSender, ResendDeliveryError } from './providers/resend'

export interface Email {
  to: string
  subject: string
  text: string
}

export type EmailPurpose = 'verification' | 'password_reset'
export type SendEmail = (email: Email, purpose: EmailPurpose) => Promise<void>

export function createEmailSender(config: unknown, register: (task: Promise<unknown>) => void, fetcher?: typeof fetch): SendEmail {
  const send = createResendSender(config, fetcher)
  return async (email, purpose) => {
    const deliveryId = crypto.randomUUID()
    console.info('auth_email_requested', { purpose, deliveryId })
    // Register before starting I/O. A synchronous registration failure must not
    // leave a detached send running or change account-dependent HTTP responses.
    let registered = false
    const task = Promise.resolve().then(async () => {
      if (!registered) return
      try {
        await send(email)
        console.info('auth_email_accepted', { purpose, deliveryId })
      }
      catch (error) {
        const code = error instanceof ResendDeliveryError ? error.code : 'unexpected'
        console.error('auth_email_failed', { purpose, deliveryId, code })
      }
    })
    try {
      register(task)
      registered = true
    }
    catch {
      console.error('auth_email_failed', { purpose, deliveryId, code: 'background_registration' })
    }
  }
}
