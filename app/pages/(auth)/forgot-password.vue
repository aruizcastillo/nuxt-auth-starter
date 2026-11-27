<script setup lang="ts">
import { safeRedirect } from '#shared/utils/safe-redirect'

const route = useRoute()
const router = useRouter()
const destination = computed(() => safeRedirect(route.query.redirect))
const redirectTo = computed(() => router.resolve({
  path: '/reset-password',
  query: { redirect: destination.value },
}).fullPath)
</script>

<template>
  <UiPageContainer
    size="narrow"
    centered
  >
    <UiCard class="w-full max-w-md">
      <UiCardHeader>
        <h1 class="text-2xl font-semibold">
          {{ $t('auth.recoverPassword') }}
        </h1>
        <UiCardDescription>{{ $t('auth.recoverPasswordDescription') }}</UiCardDescription>
      </UiCardHeader>

      <UiCardContent>
        <AuthEmailLinkForm
          purpose="recovery"
          :return-to="redirectTo"
        />
      </UiCardContent>

      <UiCardFooter>
        <UiButton
          variant="link"
          size="sm"
          class="px-0"
          as-child
        >
          <NuxtLink :to="{ path: '/sign-in', query: { redirect: destination } }">
            {{ $t('auth.signIn') }}
          </NuxtLink>
        </UiButton>
      </UiCardFooter>
    </UiCard>
  </UiPageContainer>
</template>
