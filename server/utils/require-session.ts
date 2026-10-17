import { createError, type RequestEvent } from 'nuxt/server'
import { useServerAuth } from './auth'

export async function requireSession(event: RequestEvent) {
  const session = await useServerAuth(event).api.getSession({ headers: event.req.headers })
  if (!session) {
    throw createError({ status: 401, statusText: 'Unauthorized', data: { code: 'UNAUTHENTICATED' } })
  }
  const { id, name, email, emailVerified } = session.user
  return { id, name, email, emailVerified }
}
