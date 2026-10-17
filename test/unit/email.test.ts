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

describe('background email delivery', () => {
  it('registers once before sending and resolves while provider acceptance is pending', async () => {
    const response = Promise.withResolvers<Response>()
    const fetcher = vi.fn<typeof fetch>().mockReturnValue(response.promise)
    const tasks: Promise<unknown>[] = []
    const register = vi.fn((task: Promise<unknown>) => {
      expect(fetcher).not.toHaveBeenCalled()
      tasks.push(task)
    })
    await createEmailSender(config, register, fetcher)(email, 'verification')
    expect(register).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(console.info).toHaveBeenCalledTimes(1)
    response.resolve(Response.json({ id }))
    await Promise.all(tasks)
    const requested = vi.mocked(console.info).mock.calls[0]
    expect(requested).toEqual(['auth_email_requested', { purpose: 'verification', deliveryId: expect.any(String) }])
    expect(console.info).toHaveBeenLastCalledWith('auth_email_accepted', { ...requested?.[1], providerMessageId: id })
    expect(console.error).not.toHaveBeenCalled()
  })

  it.each([[401, 'authentication'], [429, 'rate_limit'], [403, 'rejected'], [503, 'provider']] as const)('reports HTTP %i without propagating rejection or logging email data', async (status, code) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(email.text, { status }))
    const tasks: Promise<unknown>[] = []
    const send = createEmailSender(config, task => tasks.push(task), fetcher)
    await expect(send(email, 'password_reset')).resolves.toBeUndefined()
    await expect(Promise.all(tasks)).resolves.toEqual([undefined])
    expect(console.error).toHaveBeenCalledExactlyOnceWith('auth_email_failed', { purpose: 'password_reset', deliveryId: expect.any(String), code })
    const logs = inspect([vi.mocked(console.info).mock.calls, vi.mocked(console.error).mock.calls])
    for (const secret of [...Object.values(email), config.resendApiKey, config.emailFrom]) expect(logs.includes(secret)).toBe(false)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('reports a registration error and never starts unregistered I/O', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const register = vi.fn(() => {
      throw new Error(email.text)
    })
    await expect(createEmailSender(config, register, fetcher)(email, 'verification')).resolves.toBeUndefined()
    expect(fetcher).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledExactlyOnceWith('auth_email_failed', { purpose: 'verification', deliveryId: expect.any(String), code: 'background_registration' })
  })

  it('reports a transport timeout without rejecting the registered task', async () => {
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(AbortSignal.abort())
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error(email.text))
    const tasks: Promise<unknown>[] = []
    await createEmailSender(config, task => tasks.push(task), fetcher)(email, 'verification')
    await Promise.all(tasks)
    expect(console.error).toHaveBeenCalledExactlyOnceWith('auth_email_failed', { purpose: 'verification', deliveryId: expect.any(String), code: 'timeout' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
