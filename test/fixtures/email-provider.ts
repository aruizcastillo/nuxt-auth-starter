import { randomUUID } from 'node:crypto'
import { z } from 'zod'

// Loaded only by the e2e Nitro configuration, never by the application.
const messageSchema = z.object({ to: z.email(), from: z.string(), subject: z.string(), text: z.string() })
const deliveries: (z.infer<typeof messageSchema> & { status: 'pending' | 'accepted' | 'failed' })[] = []
const modes = new Map<string, 'accepted' | 'pending' | 'rate_limit'>()
const releases = new Map<string, (() => void)[]>()

export function installEmailProviderFixture() {
  const original = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    if (input !== 'https://api.resend.com/emails') return original(input, init)
    if (new Headers(init?.headers).get('authorization') !== 'Bearer re_e2e-unused') throw new Error('Unexpected test email credentials')
    const email = messageSchema.parse(JSON.parse(String(init?.body)))
    const delivery: (typeof deliveries)[number] = { ...email, status: 'pending' }
    deliveries.push(delivery)
    const mode = modes.get(email.to) ?? 'accepted'
    if (mode === 'pending') {
      await new Promise<void>((resolve, reject) => {
        const signal = init?.signal
        const onAbort = () => {
          delivery.status = 'failed'
          reject(new Error('Test provider timeout'))
        }
        const callbacks = releases.get(email.to) ?? []
        callbacks.push(() => {
          signal?.removeEventListener('abort', onAbort)
          resolve()
        })
        releases.set(email.to, callbacks)
        signal?.addEventListener('abort', onAbort, { once: true })
      })
    }
    if (mode === 'rate_limit') {
      delivery.status = 'failed'
      return Response.json({ name: 'rate_limit_exceeded', message: 'private provider message' }, { status: 429 })
    }
    delivery.status = 'accepted'
    return Response.json({ id: randomUUID() })
  }
}

const commandSchema = z.object({
  action: z.enum(['read', 'configure', 'release']),
  to: z.email(),
  mode: z.enum(['accepted', 'pending', 'rate_limit']).optional(),
})

export async function emailProviderControl(body: unknown) {
  const command = commandSchema.parse(body)
  if (command.action === 'configure' && command.mode) modes.set(command.to, command.mode)
  if (command.action === 'release') {
    for (const release of releases.get(command.to) ?? []) release()
    releases.delete(command.to)
  }
  return deliveries.filter(delivery => delivery.to === command.to)
}
