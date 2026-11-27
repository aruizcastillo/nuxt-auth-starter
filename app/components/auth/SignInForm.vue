<script setup lang="ts">
import { Field as VeeField, useForm } from 'vee-validate'
import { z } from 'zod'
import { maxPasswordLength } from '#shared/validation/auth'
import { authClient } from '~/lib/auth-client'

const emit = defineEmits<{ success: [], verificationRequired: [email: string] }>()
const { t } = useI18n()
const id = useId()
const form = useTemplateRef<HTMLFormElement>('form')
const formError = ref<string>()

const { handleSubmit, isSubmitting, resetForm } = useForm({
  initialValues: { email: '', password: '' },
  validationSchema: z.object({
    email: z.email({ error: 'auth.errors.invalidEmail' }),
    password: z.string()
      .min(1, 'auth.errors.passwordRequired')
      .max(maxPasswordLength, 'auth.errors.passwordTooLong'),
  }),
})

const submitCredentials = handleSubmit(async (credentials) => {
  try {
    const { data, error } = await authClient.signIn.email(credentials)
    if (error || !data) {
      switch (error?.code) {
        case 'INVALID_EMAIL_OR_PASSWORD':
          formError.value = 'auth.errors.invalidCredentials'
          break
        case 'EMAIL_NOT_VERIFIED':
          resetForm()
          emit('verificationRequired', credentials.email)
          return
        default:
          formError.value = error?.status === 429 ? 'auth.errors.rateLimited' : 'auth.errors.signInFailed'
      }
      return
    }
  }
  catch {
    formError.value = 'auth.errors.signInFailed'
    return
  }

  resetForm()
  emit('success')
}, async () => {
  await nextTick()
  form.value?.querySelector<HTMLInputElement>('input[aria-invalid="true"]')?.focus()
})

function onSubmit(event: SubmitEvent) {
  if (isSubmitting.value) return
  formError.value = undefined
  return submitCredentials(event)
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
      <VeeField
        v-slot="{ componentField, errorMessage }"
        name="email"
      >
        <UiField :data-invalid="!!errorMessage">
          <UiFieldLabel :for="`${id}-email`">
            {{ t('auth.email') }}
          </UiFieldLabel>
          <UiInput
            v-bind="componentField"
            :id="`${id}-email`"
            type="email"
            autocomplete="username"
            required
            :aria-invalid="!!errorMessage"
            :aria-describedby="errorMessage ? `${id}-email-error` : undefined"
          />
          <UiFieldError
            v-if="errorMessage"
            :id="`${id}-email-error`"
          >
            {{ t(errorMessage) }}
          </UiFieldError>
        </UiField>
      </VeeField>

      <VeeField
        v-slot="{ componentField, errorMessage }"
        name="password"
      >
        <UiField :data-invalid="!!errorMessage">
          <UiFieldLabel :for="`${id}-password`">
            {{ t('auth.password') }}
          </UiFieldLabel>
          <UiInput
            v-bind="componentField"
            :id="`${id}-password`"
            type="password"
            autocomplete="current-password"
            required
            :aria-invalid="!!errorMessage"
            :aria-describedby="errorMessage ? `${id}-password-error` : undefined"
          />
          <UiFieldError
            v-if="errorMessage"
            :id="`${id}-password-error`"
          >
            {{ t(errorMessage, { max: maxPasswordLength }) }}
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
        :disabled="isSubmitting"
      >
        <UiSpinner
          v-if="isSubmitting"
          data-icon="inline-start"
          aria-hidden="true"
        />
        {{ t('auth.signIn') }}
      </UiButton>
      <p
        class="sr-only"
        role="status"
      >
        {{ isSubmitting ? t('auth.signingIn') : '' }}
      </p>
    </UiFieldGroup>
  </form>
</template>
