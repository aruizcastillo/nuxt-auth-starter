<script setup lang="ts">
import { Field as VeeField, useForm } from 'vee-validate'
import { z } from 'zod'
import { maxPasswordLength, minPasswordLength } from '#shared/validation/auth'
import { authClient } from '~/lib/auth-client'

const props = defineProps<{ callbackURL: string }>()
const emit = defineEmits<{ success: [email: string] }>()
const { t } = useI18n()
const id = useId()
const form = useTemplateRef<HTMLFormElement>('form')
const formError = ref<string>()
const passwordBounds = { min: minPasswordLength, max: maxPasswordLength }

const { handleSubmit, isSubmitting, resetForm } = useForm({
  initialValues: { name: '', email: '', password: '' },
  validationSchema: z.object({
    name: z.string().refine(name => name.trim().length > 0, 'auth.errors.nameRequired'),
    email: z.email({ error: 'auth.errors.invalidEmail' }),
    password: z.string()
      .min(minPasswordLength, 'auth.errors.passwordTooShort')
      .max(maxPasswordLength, 'auth.errors.passwordTooLong'),
  }),
})

const submitRegistration = handleSubmit(async (credentials) => {
  try {
    const { data, error } = await authClient.signUp.email({ ...credentials, callbackURL: props.callbackURL })
    if (error || !data) {
      formError.value = error?.status === 429 ? 'auth.errors.rateLimited' : 'auth.errors.registrationFailed'
      return
    }
  }
  catch {
    formError.value = 'auth.errors.registrationFailed'
    return
  }

  resetForm()
  emit('success', credentials.email)
}, async () => {
  await nextTick()
  form.value?.querySelector<HTMLInputElement>('input[aria-invalid="true"]')?.focus()
})

function onSubmit(event: SubmitEvent) {
  if (isSubmitting.value) return
  formError.value = undefined
  return submitRegistration(event)
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
        name="name"
      >
        <UiField :data-invalid="!!errorMessage">
          <UiFieldLabel :for="`${id}-name`">
            {{ t('auth.name') }}
          </UiFieldLabel>
          <UiInput
            v-bind="componentField"
            :id="`${id}-name`"
            autocomplete="name"
            required
            :aria-invalid="!!errorMessage"
            :aria-describedby="errorMessage ? `${id}-name-error` : undefined"
          />
          <UiFieldError
            v-if="errorMessage"
            :id="`${id}-name-error`"
          >
            {{ t(errorMessage) }}
          </UiFieldError>
        </UiField>
      </VeeField>

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
            autocomplete="email"
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
        {{ t('auth.register') }}
      </UiButton>
      <p
        class="sr-only"
        role="status"
      >
        {{ isSubmitting ? t('auth.registering') : '' }}
      </p>
    </UiFieldGroup>
  </form>
</template>
