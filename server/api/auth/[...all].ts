import { defineEventHandler } from 'nuxt/server'
import { useServerAuth } from '../../utils/auth'

// Forward all /api/auth/* requests to Better Auth.
export default defineEventHandler((event) => {
  return useServerAuth().handler(event.req)
})
