import { describe, expect, it } from 'vitest'
import { createGoogleProvider } from '../../server/auth/providers/google'
import { parseResendConfig } from '../../server/email/providers/resend'

describe('integration-owned configuration', () => {
  it('requires both Google values when the module is used', () => {
    expect(createGoogleProvider({ googleClientId: ' id ', googleClientSecret: ' secret ' })).toEqual({
      google: { clientId: 'id', clientSecret: 'secret' },
    })
    for (const config of [{}, { googleClientId: 'id' }, { googleClientSecret: 'secret' }, { googleClientId: ' ', googleClientSecret: ' ' }]) {
      expect(() => createGoogleProvider(config)).toThrow(/Missing or invalid configuration: NUXT_GOOGLE_CLIENT_/)
    }
  })

  it('requires Resend settings and accepts plain or named senders', () => {
    for (const emailFrom of ['sender@example.test', 'Starter <sender@example.test>']) {
      expect(parseResendConfig({ resendApiKey: 'key', emailFrom })).toEqual({ resendApiKey: 'key', emailFrom })
    }
    for (const config of [{}, { resendApiKey: 'key' }, { emailFrom: 'sender@example.test' }, { resendApiKey: ' ', emailFrom: ' ' }]) {
      expect(() => parseResendConfig(config)).toThrow('Missing or invalid configuration: NUXT_')
    }
    for (const emailFrom of ['invalid-private-value', 'Starter\r\nBcc: other@example.test <sender@example.test>']) {
      expect(() => parseResendConfig({ resendApiKey: 'private-key', emailFrom })).toThrow(/^Missing or invalid configuration: NUXT_EMAIL_FROM$/)
    }
  })
})
