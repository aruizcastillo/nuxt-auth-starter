import { initializeAuthEmail } from '../utils/auth'

export default defineNitroPlugin(() => {
  if (!import.meta.prerender) initializeAuthEmail()
})
