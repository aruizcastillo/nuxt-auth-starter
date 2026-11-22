<script setup lang="ts">
definePageMeta({ middleware: 'guest' })
</script>

<template>
  <UiPageContainer size="narrow">
    <h1 class="text-2xl font-semibold">
      {{ $t('auth.register') }}
    </h1>
  </UiPageContainer>
</template>
