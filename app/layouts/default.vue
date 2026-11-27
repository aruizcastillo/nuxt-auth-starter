<template>
  <div class="flex min-h-dvh flex-col">
    <AppHeader class="p-6" />

    <main class="flex grow flex-col py-8 md:py-16">
      <slot />
    </main>

    <AppFooter class="self-center p-6" />
  </div>
</template>
