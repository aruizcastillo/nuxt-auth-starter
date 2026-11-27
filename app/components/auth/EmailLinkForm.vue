<script setup lang="ts">
import { Field as VeeField, useForm } from 'vee-validate'
import { z } from 'zod'
import { authClient } from '~/lib/auth-client'

const props = defineProps<{
  purpose: 'verification' | 'recovery'
  returnTo: string
  initialEmail?: string
}>()

const { t } = useI18n()
const emailId = useId()
const form = useTemplateRef<HTMLFormElement>('form')
const confirmation = useTemplateRef<HTMLHeadingElement>('confirmation')
const accepted = ref(false)
const formError = ref<string>()
const { isCoolingDown, respectRetryAfter } = useAuthRetryAfter()
const { handleSubmit, isSubmitting } = useForm({
  initialValues: { email: props.initialEmail ?? '' },
  validationSchema: z.object({
    email: z.email({ error: 'auth.errors.invalidEmail' }),
  }),
})

const submit = handleSubmit(async ({ email }) => {
  const fetchOptions = {
    retry: 0,
    onError: ({ response }: { response: Response }) => respectRetryAfter(response),
  }

  try {
    const { data, error } = props.purpose === 'verification'
      ? await authClient.sendVerificationEmail({ email, callbackURL: props.returnTo, fetchOptions })
      : await authClient.requestPasswordReset({ email, redirectTo: props.returnTo, fetchOptions })

    if (error || data?.status !== true) {
      formError.value = error?.status === 429 ? 'auth.errors.rateLimited' : 'auth.errors.emailRequestFailed'
      return
    }
  }
  catch {
    formError.value = 'auth.errors.emailRequestFailed'
    return
  }

  accepted.value = true
  await nextTick()
  confirmation.value?.focus()
}, async () => {
  await nextTick()
  form.value?.querySelector('input')?.focus()
})

function onSubmit(event: SubmitEvent) {
  if (isSubmitting.value || isCoolingDown.value) return
  accepted.value = false
  formError.value = undefined
  return submit(event)
}
</script>

<template>
  <form
    ref="form"
    method="post"
    novalidate
    @submit.prevent="onSubmit"
  >
    <UiFieldGroup>
      <div
        v-if="accepted"
        class="flex flex-col gap-1"
      >
        <h2
          ref="confirmation"
          tabindex="-1"
          class="text-sm font-semibold"
        >
          {{ t('auth.emailRequestAccepted') }}
        </h2>
        <p class="text-muted-foreground text-sm">
          {{ t('auth.emailRequestDescription') }}
        </p>
      </div>

      <VeeField
        v-slot="{ componentField, errorMessage }"
        name="email"
      >
        <UiField :data-invalid="!!errorMessage">
          <UiFieldLabel :for="emailId">
            {{ t('auth.email') }}
          </UiFieldLabel>
          <UiInput
            v-bind="componentField"
            :id="emailId"
            type="email"
            autocomplete="email"
            required
            :aria-invalid="!!errorMessage"
            :aria-describedby="errorMessage ? `${emailId}-error` : undefined"
          />
          <UiFieldError
            v-if="errorMessage"
            :id="`${emailId}-error`"
          >
            {{ t(errorMessage) }}
          </UiFieldError>
        </UiField>
      </VeeField>

      <p
        v-if="formError"
        class="text-destructive text-sm"
        role="alert"
      >
        {{ t(formError) }}
      </p>
      <UiButton
        type="submit"
        :disabled="isSubmitting || isCoolingDown"
      >
        <UiSpinner
          v-if="isSubmitting"
          data-icon="inline-start"
          aria-hidden="true"
        />
        {{ t(purpose === 'verification' ? 'auth.resendVerification' : 'auth.sendResetLink') }}
      </UiButton>
      <p
        class="sr-only"
        role="status"
      >
        {{ isSubmitting ? t('auth.requestingEmail') : '' }}
      </p>
    </UiFieldGroup>
  </form>
</template>
