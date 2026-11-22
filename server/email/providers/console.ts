import { stdout } from 'node:process'
import type { SendEmail } from '../index'

export const sendConsoleEmail: SendEmail = async ({ to, text }, purpose) => {
  // Write directly to the terminal so the link stays out of Nuxt's console log hooks.
  stdout.write(`[auth-email:development] ${JSON.stringify({ purpose, to, text })}\n`)
}
