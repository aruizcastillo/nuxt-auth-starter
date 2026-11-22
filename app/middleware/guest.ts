import { safeRedirect } from '#shared/utils/safe-redirect'

export default defineNuxtRouteMiddleware(async (to) => {
  const nuxtApp = useNuxtApp()
  if (await useNavigationSession()) {
    return nuxtApp.runWithContext(() => navigateTo(safeRedirect(to.query.redirect)))
  }
})
