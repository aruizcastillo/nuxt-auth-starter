import { inspect } from 'node:util'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmailSender } from '../../server/email'

const config = { resendApiKey: 're_private-key', emailFrom: 'sender@example.test' }
const email = { to: 'private-recipient@example.test', subject: 'Private subject', text: 'https://auth.example.test/?token=private-token' }
const id = '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794'

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => vi.restoreAllMocks())

describe('email service', () => {
  it('waits for provider acceptance and correlates sanitized events', async () => {
    const response = Promise.withResolvers<Response>()
    const fetcher = vi.fn<typeof fetch>().mockReturnValue(response.promise)
    const send = createEmailSender(config, fetcher)
    expect(fetcher).not.toHaveBeenCalled()
    let completed = false
    const attempt = send(email, 'verification').then(() => {
      completed = true
    })
    await Promise.resolve()
    expect(completed).toBe(false)
    expect(console.info).toHaveBeenCalledTimes(1)
    response.resolve(Response.json({ id }))
    await attempt
    const requested = vi.mocked(console.info).mock.calls[0]
    expect(requested).toEqual(['auth_email_requested', { purpose: 'verification', deliveryId: expect.any(String) }])
    expect(console.info).toHaveBeenLastCalledWith('auth_email_accepted', { ...requested?.[1], providerMessageId: id })
    expect(console.error).not.toHaveBeenCalled()
  })

  it.each([[401, 'authentication'], [429, 'rate_limit'], [403, 'rejected'], [503, 'provider']] as const)('propagates HTTP %i without logging email data', async (status, code) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(email.text, { status }))
    await expect(createEmailSender(config, fetcher)(email, 'password_reset')).rejects.toMatchObject({ code })
    expect(console.error).toHaveBeenCalledExactlyOnceWith('auth_email_failed', { purpose: 'password_reset', deliveryId: expect.any(String), code })
    const logs = inspect([vi.mocked(console.info).mock.calls, vi.mocked(console.error).mock.calls])
    for (const secret of [...Object.values(email), config.resendApiKey, config.emailFrom]) expect(logs.includes(secret)).toBe(false)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('reports and propagates a transport timeout', async () => {
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(AbortSignal.abort())
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error(email.text))
    await expect(createEmailSender(config, fetcher)(email, 'verification')).rejects.toMatchObject({ code: 'timeout' })
    expect(console.error).toHaveBeenCalledExactlyOnceWith('auth_email_failed', { purpose: 'verification', deliveryId: expect.any(String), code: 'timeout' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
