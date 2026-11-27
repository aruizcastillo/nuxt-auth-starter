<script setup lang="ts">
import { safeRedirect } from '#shared/utils/safe-redirect'

definePageMeta({ middleware: 'guest' })

const route = useRoute()
const nuxtApp = useNuxtApp()
const destination = computed(() => safeRedirect(route.query.redirect))
const verificationFailed = computed(() => {
  const error = route.query.error
  return error === 'INVALID_TOKEN' || error === 'TOKEN_EXPIRED' || error === 'USER_NOT_FOUND'
})

async function onSuccess() {
  await nuxtApp.runWithContext(() => {
    clearNavigationSession()
    return navigateTo(destination.value, { replace: true })
  })
}
</script>

<template>
  <UiPageContainer
    size="narrow"
    centered
  >
    <UiCard class="w-full max-w-md">
      <UiCardHeader>
        <h1 class="text-2xl font-semibold">
          {{ $t('auth.signIn') }}
        </h1>
        <UiCardDescription>{{ $t('auth.signInDescription') }}</UiCardDescription>
      </UiCardHeader>

      <UiCardContent class="flex flex-col gap-4">
        <p
          v-if="verificationFailed"
          class="text-destructive text-sm"
          role="alert"
        >
          {{ $t('auth.errors.verificationLink') }}
        </p>
        <AuthSignInForm @success="onSuccess" />
      </UiCardContent>

      <UiCardFooter class="flex-wrap gap-x-4 gap-y-2">
        <UiButton
          variant="link"
          size="sm"
          class="px-0"
          as-child
        >
          <NuxtLink :to="{ path: '/register', query: { redirect: destination } }">
            {{ $t('auth.register') }}
          </NuxtLink>
        </UiButton>
        <UiButton
          variant="link"
          size="sm"
          class="px-0"
          as-child
        >
          <NuxtLink to="/">{{ $t('navigation.home') }}</NuxtLink>
        </UiButton>
      </UiCardFooter>
    </UiCard>
  </UiPageContainer>
</template>
