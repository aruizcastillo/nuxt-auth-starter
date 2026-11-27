<script setup lang="ts">
import { safeRedirect } from '#shared/utils/safe-redirect'

const route = useRoute()
const router = useRouter()
const verificationEmail = useVerificationEmail()
const initialEmail = verificationEmail.value
verificationEmail.value = ''

const heading = useTemplateRef<HTMLHeadingElement>('heading')
const signInLink = computed(() => ({ path: '/sign-in', query: { redirect: safeRedirect(route.query.redirect) } }))
const callbackURL = computed(() => router.resolve(signInLink.value).fullPath)
const signedIn = await useNavigationSession()

if (initialEmail) {
  onMounted(() => heading.value?.focus())
}
</script>

<template>
  <UiPageContainer
    size="narrow"
    centered="x"
  >
    <UiCard class="w-full max-w-md">
      <UiCardHeader>
        <h1
          ref="heading"
          tabindex="-1"
          class="text-2xl font-semibold"
        >
          {{ $t(signedIn ? 'auth.verifyEmail' : 'auth.checkEmail') }}
        </h1>
        <UiCardDescription>
          {{ $t(signedIn ? 'auth.verificationSessionDescription' : 'auth.checkEmailDescription') }}
        </UiCardDescription>
      </UiCardHeader>

      <UiCardContent v-if="!signedIn">
        <AuthEmailLinkForm
          purpose="verification"
          :initial-email="initialEmail"
          :return-to="callbackURL"
        />
      </UiCardContent>

      <UiCardFooter>
        <UiButton
          variant="link"
          size="sm"
          class="px-0"
          as-child
        >
          <NuxtLink :to="signedIn ? '/account' : signInLink">
            {{ $t(signedIn ? 'auth.goToAccount' : 'auth.signIn') }}
          </NuxtLink>
        </UiButton>
      </UiCardFooter>
    </UiCard>
  </UiPageContainer>
</template>
