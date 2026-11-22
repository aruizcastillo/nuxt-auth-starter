import { useRuntimeConfig, type RequestEvent } from 'nuxt/server'
import { createAuth } from '../auth/options'
import { createDatabase } from '../database'
import { parseAuthConfig } from '../auth/config'
import { parseDatabaseConfig } from '../database/config'
import { createEmailSender, type SendEmail } from '../email'

let emailSender: SendEmail | undefined

// Called once by the Nitro startup plugin, never while importing this module.
export function initializeAuthEmail(development = import.meta.dev) {
  emailSender = createEmailSender(useRuntimeConfig(), development)
}

export function useServerAuth(event: RequestEvent) {
  const config = useRuntimeConfig()
  const settings = parseAuthConfig(config, import.meta.dev)
  const { databaseUrl } = parseDatabaseConfig(config)
  return createAuth(settings, createDatabase(databaseUrl), async (email, purpose) => {
    let registered = false
    // Defer I/O until registration succeeds; the caught task never rejects unobserved.
    const task = Promise.resolve().then(async () => {
      if (!registered) return
      if (!emailSender) {
        console.error('auth_email_failed', { purpose, deliveryId: crypto.randomUUID(), code: 'sender_not_initialized' })
        throw new Error('Email transport was not initialized')
      }
      await emailSender(email, purpose)
    }).catch(() => {}) // A failed send has already been reported.
    try {
      if (!('waitUntil' in event) || typeof event.waitUntil !== 'function') throw new Error('Missing waitUntil')
      event.waitUntil(task)
      registered = true
    }
    catch {
      console.error('auth_email_failed', { purpose, deliveryId: crypto.randomUUID(), code: 'background_registration' })
      throw new Error('Email background registration failed')
    }
  })
}
