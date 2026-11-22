import { authClient } from '~/lib/auth-client'

const sessionDataKey = 'auth-navigation-session'

export async function useNavigationSession() {
  if (import.meta.server) useResponseHeader('Cache-Control').value = 'private, no-store'

  // Keep Better Auth's signal and serialize only the navigation result.
  const { data, error } = await authClient.useSession((url, options) => useFetch(url, {
    ...options,
    key: sessionDataKey,
    cache: 'no-store',
    transform: session => session ? true : null,
  }))
  if (error.value?.status === 401) return false
  if (error.value) {
    throw createError({ status: 503, statusText: 'Session temporarily unavailable' })
  }

  return Boolean(data.value)
}

export function clearNavigationSession() {
  clearNuxtData(sessionDataKey)
}
