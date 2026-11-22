<script setup lang="ts">
import { safeRedirect } from '#shared/utils/safe-redirect'
import { authClient } from '~/lib/auth-client'

definePageMeta({ middleware: 'auth' })

const nuxtApp = useNuxtApp()
const route = useRoute()
// The native Vue store mounts Better Auth's cross-tab and focus listeners.
const liveSession = import.meta.client ? authClient.useSession() : undefined
const { data, error, refresh, clear } = await useFetch('/api/account', { cache: 'no-store' })
const user = computed(() => data.value && 'user' in data.value ? data.value.user : undefined)
const signingOut = ref(false)
const signOutError = ref(false)
let leavingAccount = false

async function leaveAccount(redirect?: string) {
  if (leavingAccount) return
  leavingAccount = true
  clear()

  await nuxtApp.runWithContext(() => {
    clearNavigationSession()
    return navigateTo({
      path: '/sign-in',
      query: redirect ? { redirect } : {},
    }, { replace: true })
  })
}

if (import.meta.server && error.value?.status === 401) {
  await leaveAccount(safeRedirect(route.fullPath))
}

if (liveSession) {
  watch(error, async (failure) => {
    if (failure?.status === 401) await leaveAccount(safeRedirect(route.fullPath))
  }, { immediate: true })

  watch(liveSession, async (session) => {
    if (session.isPending || session.isRefetching || signingOut.value) return
    if (session.error && session.error.status !== 401) return

    if (!session.data) await leaveAccount(safeRedirect(route.fullPath))
    else if (user.value && user.value.id !== session.data.user.id) {
      clear()
      await refresh()
    }
  }, { immediate: true })
}

async function signOut() {
  if (signingOut.value) return
  signingOut.value = true
  signOutError.value = false

  try {
    const { error } = await authClient.signOut()
    if (error) {
      signOutError.value = true
      return
    }
  }
  catch {
    signOutError.value = true
    return
  }
  finally {
    signingOut.value = false
  }

  await leaveAccount()
}
</script>

<template>
  <UiPageContainer size="narrow">
    <h1 class="text-2xl font-semibold">
      {{ $t('account.title') }}
    </h1>
    <template v-if="user">
      <p>{{ user.name }}</p>
      <p>{{ user.email }}</p>
      <div>
        <UiButton
          type="button"
          :disabled="signingOut"
          @click="signOut"
        >
          {{ $t(signingOut ? 'account.signingOut' : 'account.signOut') }}
        </UiButton>
      </div>
      <p
        v-if="signOutError"
        role="alert"
      >
        {{ $t('account.signOutError') }}
      </p>
    </template>
    <template v-else-if="error && error.status !== 401">
      <p role="alert">
        {{ $t('account.loadError') }}
      </p>
      <div>
        <UiButton
          type="button"
          @click="refresh()"
        >
          {{ $t('common.retry') }}
        </UiButton>
      </div>
    </template>
    <p
      v-else
      role="status"
    >
      {{ $t('account.loading') }}
    </p>
  </UiPageContainer>
</template>
