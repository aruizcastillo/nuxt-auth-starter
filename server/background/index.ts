import { createNitroBackgroundHandler } from './providers/nitro'
import { createVercelBackgroundHandler } from './providers/vercel'

// The effective Nitro preset identifies the hosting contract, including production
// Node servers. Never infer persistent-process support from NODE_ENV or a method alone.
export function createBackgroundHandler(event: unknown, preset: string | undefined = import.meta.preset) {
  const register = preset === 'vercel'
    ? createVercelBackgroundHandler()
    : preset === 'nitro-dev' || preset === 'node-server'
      ? createNitroBackgroundHandler(event)
      : undefined
  if (!register) {
    console.error('background_tasks_unavailable')
    throw new Error('Background tasks unavailable')
  }
  return register
}
