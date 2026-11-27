<script setup lang="ts">
import { safeRedirect } from '#shared/utils/safe-redirect'
import { authClient } from '~/lib/auth-client'

const route = useRoute()
const router = useRouter()
const nuxtApp = useNuxtApp()
const destination = computed(() => safeRedirect(route.query.redirect))
const heading = useTemplateRef<HTMLHeadingElement>('heading')
const completed = ref(false)
const signedIn = ref(false)
const checkingSession = ref(false)

if (import.meta.server && route.query.token !== undefined) {
  // Nuxt 4.6 serializes the request URL here. The client router can read the browser URL.
  delete nuxtApp.payload.path
}

useHead({ meta: [{ name: 'referrer', content: 'no-referrer' }] })

const token = computed(() => {
  const value = route.query.token
  if (route.query.error !== undefined || typeof value !== 'string' || !value || /[\s\p{Cc}]/u.test(value)) {
    return undefined
  }
  return value
})

function removeToken() {
  return router.replace({ path: '/reset-password', query: { redirect: destination.value } })
}

async function onInvalidLink() {
  await removeToken()
  await nextTick()
  heading.value?.focus()
}

async function onSuccess() {
  checkingSession.value = true
  completed.value = true
  nuxtApp.runWithContext(clearNavigationSession)
  await removeToken()
  await nextTick()
  heading.value?.focus()

  try {
    const { data } = await authClient.getSession({ fetchOptions: { cache: 'no-store', retry: 0 } })
    signedIn.value = Boolean(data)
  }
  catch {
    // The sign-in page checks the native session again if this lookup fails.
  }
  finally {
    checkingSession.value = false
  }
}
</script>

<template>
  <UiPageContainer
    size="narrow"
    centered
  >
    <UiCard class="w-full max-w-md">
      <UiCardHeader>
        <h1
          ref="heading"
          tabindex="-1"
          class="text-2xl font-semibold"
        >
          {{ $t(completed ? 'auth.passwordResetComplete' : 'auth.resetPassword') }}
        </h1>
        <UiCardDescription v-if="completed">
          {{ $t(signedIn ? 'auth.passwordResetSwitchAccount' : 'auth.passwordResetCompleteDescription') }}
        </UiCardDescription>
        <UiCardDescription v-else-if="token">
          {{ $t('auth.resetPasswordDescription') }}
        </UiCardDescription>
        <UiCardDescription
          v-else
          role="alert"
        >
          {{ $t('auth.errors.resetLink') }}
        </UiCardDescription>
      </UiCardHeader>

      <UiCardContent v-if="!completed && token">
        <AuthResetPasswordForm
          :key="token"
          :token="token"
          @success="onSuccess"
          @invalid-link="onInvalidLink"
        />
      </UiCardContent>

      <UiCardFooter v-if="!checkingSession">
        <UiButton
          variant="link"
          size="sm"
          class="px-0"
          as-child
        >
          <NuxtLink
            v-if="completed"
            :to="signedIn ? '/account' : { path: '/sign-in', query: { redirect: destination } }"
          >
            {{ $t(signedIn ? 'auth.goToAccount' : 'auth.signIn') }}
          </NuxtLink>
          <NuxtLink
            v-else
            :to="{ path: '/forgot-password', query: { redirect: destination } }"
          >
            {{ $t('auth.requestResetLink') }}
          </NuxtLink>
        </UiButton>
      </UiCardFooter>
    </UiCard>
  </UiPageContainer>
</template>
