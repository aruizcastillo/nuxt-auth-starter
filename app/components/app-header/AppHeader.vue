<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <UiPageContainer size="wide">
    <header
      class="flex flex-row items-center gap-6"
      :aria-label="t('navigation.main')"
    >
      <div class="flex w-full flex-row items-center justify-between gap-2">
        <NuxtLink
          class="font-bold text-inherit no-underline"
          to="/"
          :aria-label="t('app.name')"
        >
          <AppLogo
            aria-hidden="true"
            width="3rem"
            height="auto"
          />
        </NuxtLink>

        <div class="flex items-center gap-1">
          <UiButton
            variant="ghost"
            size="sm"
            as-child
          >
            <a
              href="https://example.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              example.com!
            </a>
          </UiButton>
        </div>
      </div>
    </header>
  </UiPageContainer>
</template>
