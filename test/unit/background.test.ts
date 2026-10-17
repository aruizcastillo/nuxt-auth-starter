import { AsyncLocalStorage } from 'node:async_hooks'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBackgroundHandler } from '../../server/background'

const symbol = Symbol.for('@vercel/request-context')
const original = Object.getOwnPropertyDescriptor(globalThis, symbol)

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  Reflect.deleteProperty(globalThis, symbol)
})

afterEach(() => {
  if (original) Object.defineProperty(globalThis, symbol, original)
  else Reflect.deleteProperty(globalThis, symbol)
  vi.restoreAllMocks()
})

describe('background hosting contracts', () => {
  it.each(['nitro-dev', 'node-server'])('uses Nitro event registration for %s and preserves its receiver', (preset) => {
    const tasks: Promise<unknown>[] = []
    const event = {
      tasks,
      waitUntil(task: Promise<unknown>) { this.tasks.push(task) },
    }
    const task = Promise.resolve()
    createBackgroundHandler(event, preset)(task)
    expect(tasks).toEqual([task])
  })

  it.each(['aws-lambda', 'netlify', 'cloudflare-module', 'vercel-edge', 'node-listener', undefined])('rejects unverified hosting %s even if a waitUntil method exists', (preset) => {
    const register = vi.fn()
    expect(() => createBackgroundHandler({ waitUntil: register }, preset)).toThrow('Background tasks unavailable')
    expect(register).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledExactlyOnceWith('background_tasks_unavailable')
  })

  it.each([undefined, {}, { waitUntil: null }])('rejects missing Nitro support', (event) => {
    expect(() => createBackgroundHandler(event, 'node-server')).toThrow('Background tasks unavailable')
  })

  it.each([undefined, {}, { get: () => undefined }, { get: () => ({}) }, { get: () => ({ waitUntil: true }) }, { get: () => {
    throw new Error('private-value')
  } }])('rejects absent or malformed Vercel context without falling back to Nitro', (reader) => {
    Reflect.set(globalThis, symbol, reader)
    const register = vi.fn()
    expect(() => createBackgroundHandler({ waitUntil: register }, 'vercel')).toThrow(/^Background tasks unavailable$/)
    expect(register).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledExactlyOnceWith('background_tasks_unavailable')
  })

  it('delegates through the real @vercel/functions helper in each concurrent request context', async () => {
    const storage = new AsyncLocalStorage<{ waitUntil: (task: Promise<unknown>) => void }>()
    Reflect.set(globalThis, symbol, { get: () => storage.getStore() })
    const first = vi.fn()
    const second = vi.fn()
    await Promise.all([first, second].map(register => storage.run({ waitUntil: register }, async () => {
      const handler = createBackgroundHandler({}, 'vercel')
      await Promise.resolve()
      const task = Promise.resolve()
      handler(task)
      expect(register).toHaveBeenCalledExactlyOnceWith(task)
    })))
  })

  it('rejects a context lost before registration', () => {
    Reflect.set(globalThis, symbol, { get: () => ({ waitUntil: vi.fn() }) })
    const handler = createBackgroundHandler({}, 'vercel')
    Reflect.deleteProperty(globalThis, symbol)
    expect(() => handler(Promise.resolve())).toThrow('Background tasks unavailable')
  })
})
