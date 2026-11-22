const fallback = '/account'
const unsafeCharacters = /[\p{Cc}\\]/u

export function safeRedirect(destination: unknown): string {
  if (typeof destination !== 'string') return fallback

  const [path] = destination.split(/[?#]/, 1)
  if (path !== '/' && path !== '/account') return fallback

  try {
    return unsafeCharacters.test(decodeURIComponent(destination)) ? fallback : destination
  }
  catch {
    return fallback
  }
}
