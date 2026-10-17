import { defineEventHandler } from 'nuxt/server'
import { emailProviderControl } from './email-provider'

export default defineEventHandler(async event => emailProviderControl(await event.req.json()))
