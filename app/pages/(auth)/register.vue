<script setup lang="ts">
import { safeRedirect } from '#shared/utils/safe-redirect'

definePageMeta({ middleware: 'guest' })

const route = useRoute()
const router = useRouter()
const signInLink = computed(() => ({ path: '/sign-in', query: { redirect: safeRedirect(route.query.redirect) } }))
const callbackURL = computed(() => router.resolve(signInLink.value).fullPath)
const registered = ref(false)
const heading = useTemplateRef<HTMLHeadingElement>('heading')

async function onSuccess() {
  registered.value = true
  await nextTick()
  heading.value?.focus()
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
          class="text-2xl font-semibold"
          :tabindex="registered ? -1 : undefined"
        >
          {{ $t(registered ? 'auth.checkEmail' : 'auth.register') }}
        </h1>
        <UiCardDescription v-if="!registered">
          {{ $t('auth.registerDescription') }}
        </UiCardDescription>
      </UiCardHeader>

      <UiCardContent>
        <p v-if="registered">
          {{ $t('auth.checkEmailDescription') }}
        </p>
        <AuthRegisterForm
          v-else
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
