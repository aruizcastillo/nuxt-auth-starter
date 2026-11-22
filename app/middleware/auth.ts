import { safeRedirect } from '#shared/utils/safe-redirect'

export default defineNuxtRouteMiddleware(async (to) => {
  const nuxtApp = useNuxtApp()
  if (await useNavigationSession()) return

  return nuxtApp.runWithContext(() => navigateTo({
    path: '/sign-in',
    query: { redirect: safeRedirect(to.fullPath) },
  }))
})
