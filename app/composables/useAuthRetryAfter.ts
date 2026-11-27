import { useTimeoutFn } from '@vueuse/core'

export function useAuthRetryAfter() {
  const delay = ref(0)
  const { isPending: isCoolingDown, start } = useTimeoutFn(() => {}, delay, { immediate: false })

  function respectRetryAfter(response: Response) {
    if (response.status !== 429) return
    const seconds = Number(response.headers.get('X-Retry-After'))
    if (!Number.isSafeInteger(seconds) || seconds <= 0) return
    delay.value = Math.min(seconds * 1000, 2_147_483_647)
    start()
  }

  return { isCoolingDown, respectRetryAfter }
}
