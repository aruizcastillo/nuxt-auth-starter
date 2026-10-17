// Nitro 2 adds this method to the event; it is not part of Nuxt's portable event type.
export function createNitroBackgroundHandler(event: unknown) {
  if (!event || typeof event !== 'object' || !('waitUntil' in event) || typeof event.waitUntil !== 'function') return
  const register = event.waitUntil.bind(event)
  return (task: Promise<unknown>): void => {
    register(task)
  }
}
