<script setup lang="ts">
import 'vue-sonner/style.css'

const { locale, t } = useI18n()

useSeoMeta({
  title: () => t('app.title'),
  description: () => t('app.description'),
})

useHead(() => ({
  htmlAttrs: {
    'lang': locale.value,
    'data-theme': 'light',
    'style': { 'color-scheme': 'light' },
  },
}))
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>

  <UiToaster position="top-center" />
</template>
