import { defineEventHandler } from 'nuxt/server'
import { z } from 'zod'
import { requireSession } from '../utils/require-session'

const emptyQuery = z.literal(0)

export default defineEventHandler(async (event) => {
  event.res.headers.set('Cache-Control', 'private, no-store')

  const user = await requireSession(event)
  if (!emptyQuery.safeParse(event.url.searchParams.size).success) {
    // A thrown Nitro error would include the original URL and its query values.
    return Response.json({ statusCode: 400, statusMessage: 'Invalid query' }, { status: 400 })
  }

  return { user }
})
