<template>
  <UiPageContainer
    size="wide"
    gap="sm"
  >
    <span>
      {{ $t('home.greeting') }}
    </span>
    <div class="flex flex-wrap gap-2">
      <UiButton as-child>
        <NuxtLink to="/sign-in">{{ $t('auth.signIn') }}</NuxtLink>
      </UiButton>
      <UiButton
        variant="outline"
        as-child
      >
        <NuxtLink to="/register">{{ $t('auth.register') }}</NuxtLink>
      </UiButton>
    </div>
  </UiPageContainer>
</template>
