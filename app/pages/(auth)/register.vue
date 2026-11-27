<script setup lang="ts">
import { safeRedirect } from '#shared/utils/safe-redirect'

definePageMeta({ middleware: 'guest' })

const route = useRoute()
const router = useRouter()
const verificationEmail = useVerificationEmail()
const destination = computed(() => safeRedirect(route.query.redirect))
const signInLink = computed(() => ({ path: '/sign-in', query: { redirect: destination.value } }))
const callbackURL = computed(() => router.resolve(signInLink.value).fullPath)

async function onSuccess(email: string) {
  verificationEmail.value = email
  await navigateTo({ path: '/verify-email', query: { redirect: destination.value } })
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
          {{ $t('auth.register') }}
        </h1>
        <UiCardDescription>
          {{ $t('auth.registerDescription') }}
        </UiCardDescription>
      </UiCardHeader>

      <UiCardContent>
        <AuthRegisterForm
          :callback-u-r-l="callbackURL"
          @success="onSuccess"
        />
      </UiCardContent>

      <UiCardFooter class="flex-wrap gap-x-4 gap-y-2">
        <UiButton
          variant="link"
          size="sm"
          class="px-0"
          as-child
        >
          <NuxtLink :to="signInLink">{{ $t('auth.signIn') }}</NuxtLink>
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
