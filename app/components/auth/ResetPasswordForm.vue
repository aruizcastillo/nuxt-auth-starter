<script setup lang="ts">
import { Field as VeeField, useForm } from 'vee-validate'
import { z } from 'zod'
import { maxPasswordLength, minPasswordLength } from '#shared/validation/auth'
import { authClient } from '~/lib/auth-client'

const props = defineProps<{ token: string }>()
const emit = defineEmits<{ success: [], invalidLink: [] }>()
const { t } = useI18n()
const id = useId()
const form = useTemplateRef<HTMLFormElement>('form')
const formError = ref<string>()
const passwordBounds = { min: minPasswordLength, max: maxPasswordLength }
const { isCoolingDown, respectRetryAfter } = useAuthRetryAfter()
const { handleSubmit, isSubmitting, resetForm } = useForm({
  initialValues: { newPassword: '', confirmPassword: '' },
  validationSchema: z.object({
    newPassword: z.string()
      .min(minPasswordLength, 'auth.errors.passwordTooShort')
      .max(maxPasswordLength, 'auth.errors.passwordTooLong'),
    confirmPassword: z.string(),
  }).refine(({ newPassword, confirmPassword }) => newPassword === confirmPassword, {
    error: 'auth.errors.passwordMismatch',
    path: ['confirmPassword'],
  }),
})

const submit = handleSubmit(async ({ newPassword }) => {
  try {
    const { data, error } = await authClient.resetPassword({
      token: props.token,
      newPassword,
      fetchOptions: {
        retry: 0,
        onError: ({ response }) => respectRetryAfter(response),
      },
    })

    if (error || data?.status !== true) {
      const code = error?.code
      if (code === 'INVALID_TOKEN' || code === 'TOKEN_EXPIRED' || code === 'USER_NOT_FOUND') {
        resetForm()
        emit('invalidLink')
        return
      }
      formError.value = error?.status === 429 ? 'auth.errors.rateLimited' : 'auth.errors.resetFailed'
      return
    }
  }
  catch {
    formError.value = 'auth.errors.resetFailed'
    return
  }

  resetForm()
  emit('success')
}, async () => {
  await nextTick()
  form.value?.querySelector<HTMLInputElement>('input[aria-invalid="true"]')?.focus()
})

function onSubmit(event: SubmitEvent) {
  if (isSubmitting.value || isCoolingDown.value) return
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
      <VeeField
        v-slot="{ componentField, errorMessage }"
        name="newPassword"
      >
        <UiField :data-invalid="!!errorMessage">
          <UiFieldLabel :for="`${id}-password`">
            {{ t('auth.newPassword') }}
          </UiFieldLabel>
          <UiInput
            v-bind="componentField"
            :id="`${id}-password`"
            type="password"
            autocomplete="new-password"
            required
            :aria-invalid="!!errorMessage"
            :aria-describedby="errorMessage ? `${id}-password-error` : `${id}-password-description`"
          />
          <UiFieldError
            v-if="errorMessage"
            :id="`${id}-password-error`"
          >
            {{ t(errorMessage, passwordBounds) }}
          </UiFieldError>
          <UiFieldDescription
            v-else
            :id="`${id}-password-description`"
          >
            {{ t('auth.passwordLength', passwordBounds) }}
          </UiFieldDescription>
        </UiField>
      </VeeField>

      <VeeField
        v-slot="{ componentField, errorMessage }"
        name="confirmPassword"
      >
        <UiField :data-invalid="!!errorMessage">
          <UiFieldLabel :for="`${id}-confirm-password`">
            {{ t('auth.confirmPassword') }}
          </UiFieldLabel>
          <UiInput
            v-bind="componentField"
            :id="`${id}-confirm-password`"
            type="password"
            autocomplete="new-password"
            required
            :aria-invalid="!!errorMessage"
            :aria-describedby="errorMessage ? `${id}-confirm-password-error` : undefined"
          />
          <UiFieldError
            v-if="errorMessage"
            :id="`${id}-confirm-password-error`"
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
        {{ t('auth.saveNewPassword') }}
      </UiButton>
      <p
        class="sr-only"
        role="status"
      >
        {{ isSubmitting ? t('auth.resettingPassword') : '' }}
      </p>
    </UiFieldGroup>
  </form>
</template>
