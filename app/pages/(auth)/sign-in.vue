<script setup lang="ts">
import { safeRedirect } from '#shared/utils/safe-redirect'

definePageMeta({ middleware: 'guest' })

const route = useRoute()
const nuxtApp = useNuxtApp()
const verificationEmail = useVerificationEmail()
const destination = computed(() => safeRedirect(route.query.redirect))
const verificationLink = computed(() => ({ path: '/verify-email', query: { redirect: destination.value } }))
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

async function onVerificationRequired(email: string) {
  verificationEmail.value = email
  await navigateTo(verificationLink.value)
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
        <div
          v-if="verificationFailed"
          class="flex flex-col items-start gap-1"
        >
          <p
            class="text-destructive text-sm"
            role="alert"
          >
            {{ $t('auth.errors.verificationLink') }}
          </p>
          <NuxtLink
            :to="verificationLink"
            class="text-sm underline underline-offset-4"
          >
            {{ $t('auth.requestVerificationLink') }}
          </NuxtLink>
        </div>
        <AuthSignInForm
          @success="onSuccess"
          @verification-required="onVerificationRequired"
        />
        <NuxtLink
          :to="{ path: '/forgot-password', query: { redirect: destination } }"
          class="self-start text-sm underline underline-offset-4"
        >
          {{ $t('auth.forgotPassword') }}
        </NuxtLink>
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
