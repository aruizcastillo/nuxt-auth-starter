import { inspect } from 'node:util'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createResendSender, ResendDeliveryError } from '../../server/email/providers/resend'

const config = { resendApiKey: 're_test-secret', emailFrom: 'Nuxt Auth Starter <onboarding@resend.dev>' }
const email = { to: 'recipient@example.test', subject: 'Private subject', text: 'https://example.test/reset?token=private-token' }
const id = '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794'
const sensitive = `${config.resendApiKey} ${email.to} ${email.subject} ${email.text}`

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Resend transport', () => {
  it('posts only the text contract and returns a validated acceptance ID', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id, extra: sensitive }))
    const send = createResendSender(config, fetcher)
    await expect(send(email)).resolves.toEqual({ id })
    expect(fetcher).toHaveBeenCalledExactlyOnceWith('https://api.resend.com/emails', {
      method: 'POST',
      redirect: 'error',
      signal: expect.any(AbortSignal),
      headers: { 'Authorization': `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.emailFrom, ...email }),
    })
  })

  it('uses native fetch by default and accepts a configured domain without code changes', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id }))
    vi.stubGlobal('fetch', fetcher)
    await createResendSender({ ...config, emailFrom: 'App <sender@example.test>' })(email)
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)).from).toBe('App <sender@example.test>')
  })

  it('rejects invalid configuration before sending without exposing values', () => {
    const fetcher = vi.fn<typeof fetch>()
    expect(() => createResendSender({ ...config, emailFrom: sensitive }, fetcher)).toThrow(/^Missing or invalid configuration: NUXT_EMAIL_FROM$/)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it.each([null, {}, { id: '' }, { id: 42 }, { id: sensitive }, { name: 'error', message: sensitive }])('rejects malformed success data: %j', async (data) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(data))
    await expect(createResendSender(config, fetcher)(email)).rejects.toMatchObject({ code: 'invalid_response' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it.each(['', '<html>private provider response</html>', '{"id":'])('rejects non-JSON success bodies: %s', async (body) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(body))
    await expect(createResendSender(config, fetcher)(email)).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it.each([
    [401, 'validation_error', 'API key is invalid', 'authentication'],
    [401, 'missing_api_key', sensitive, 'authentication'],
    [400, 'validation_error', 'API key is invalid', 'authentication'],
    [403, 'restricted_api_key', sensitive, 'authentication'],
    [403, 'suspended_api_key', sensitive, 'authentication'],
    [403, 'invalid_permission', sensitive, 'authentication'],
    [403, 'validation_error', sensitive, 'rejected'],
    [422, 'validation_error', sensitive, 'rejected'],
    [429, 'rate_limit_exceeded', sensitive, 'rate_limit'],
    [500, 'application_error', sensitive, 'provider'],
    [503, 'service_unavailable', sensitive, 'provider'],
  ])('classifies HTTP %i / %s safely without retrying', async (status, name, message, code) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ name, message }, { status }))
    const log = vi.spyOn(console, 'log')
    const warn = vi.spyOn(console, 'warn')
    const errorLog = vi.spyOn(console, 'error')
    const error = await createResendSender(config, fetcher)(email).catch((error: unknown) => error)
    expect(error).toBeInstanceOf(ResendDeliveryError)
    expect(error).toMatchObject({ code, message: `Email transport failed: ${code}` })
    expect(error).not.toHaveProperty('cause')
    for (const value of [config.resendApiKey, email.to, email.subject, email.text, sensitive]) {
      expect(inspect(error)).not.toContain(value)
      expect(JSON.stringify(error)).not.toContain(value)
    }
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(log).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
    expect(errorLog).not.toHaveBeenCalled()
  })

  it.each([[401, 'authentication'], [429, 'rate_limit'], [502, 'provider']])('classifies HTTP %i even with a non-JSON error body', async (status, code) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(sensitive, { status }))
    await expect(createResendSender(config, fetcher)(email)).rejects.toMatchObject({ code })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('replaces network errors and their sensitive causes without retrying', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error(sensitive, { cause: email }))
    const error = await createResendSender(config, fetcher)(email).catch((error: unknown) => error)
    expect(error).toMatchObject({ code: 'network', message: 'Email transport failed: network' })
    expect(error).not.toHaveProperty('cause')
    expect(inspect(error)).not.toContain(sensitive)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it.each(['headers', 'body'])('aborts a stalled %s phase at the real deadline without retrying', async (phase) => {
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    const fetcher = vi.fn<typeof fetch>(async (_url, options) => {
      const signal = options?.signal
      if (!signal) throw new Error('Expected an abort signal')
      if (phase === 'headers') {
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), { once: true })
        })
      }
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"id":'))
          signal.addEventListener('abort', () => controller.error(signal.reason), { once: true })
        },
      }))
    })
    await expect(createResendSender(config, fetcher)(email)).rejects.toMatchObject({ code: 'timeout' })
    expect(timeout).toHaveBeenCalledExactlyOnceWith(10_000)
    expect(fetcher).toHaveBeenCalledTimes(1)
  }, 15_000)
})
