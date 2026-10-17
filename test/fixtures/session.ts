import { defineEventHandler } from 'nuxt/server'
import { requireSession } from '../../server/utils/require-session'

export default defineEventHandler(event => requireSession(event))
