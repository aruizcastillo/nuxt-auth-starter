import type { z } from 'zod'

// Report variable names only, never values or raw validation issues.
export function formatConfigError(error: z.ZodError): string {
  const names = [...new Set(error.issues.map((issue) => {
    const key = String(issue.path[0])
    return `NUXT_${key.replace(/[A-Z]/g, letter => `_${letter}`).toUpperCase()}`
  }))]
  return `Missing or invalid configuration: ${names.join(', ')}`
}
