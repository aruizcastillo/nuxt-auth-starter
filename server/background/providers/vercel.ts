import { waitUntil } from '@vercel/functions'

function hasRequestContext() {
  // @vercel/functions 3.10.1 has no public capability check and silently does
  // nothing without this context. Keep this source-verified internal guard here.
  // See docs/deployment.md#background-tasks before upgrading the package/runtime.
  try {
    const reader: unknown = Reflect.get(globalThis, Symbol.for('@vercel/request-context'))
    if (!reader || typeof reader !== 'object' || !('get' in reader) || typeof reader.get !== 'function') return false
    const context: unknown = reader.get()
    return !!context && typeof context === 'object' && 'waitUntil' in context && typeof context.waitUntil === 'function'
  }
  catch {
    return false
  }
}

export function createVercelBackgroundHandler() {
  if (!hasRequestContext()) return
  return (task: Promise<unknown>): void => {
    // Recheck within the callback's request context, before calling the public API.
    if (!hasRequestContext()) throw new Error('Background tasks unavailable')
    waitUntil(task)
  }
}
