<script setup lang="ts">
import { computed } from 'vue'

type PageSize = 'sm' | 'md' | 'lg' | 'xl' | 'narrow' | 'default' | 'wide' | 'wider' | 'full'

type PageGap = 'none' | 'sm' | 'md' | 'lg' | 'xl'

type PageCentering = 'x' | 'y' | 'all'

const sizeClasses: Record<PageSize, string> = {
  sm: 'max-w-xl',
  md: 'max-w-3xl',
  lg: 'max-w-5xl',
  xl: 'max-w-7xl',
  narrow: 'max-w-xl',
  default: 'max-w-5xl',
  wide: 'max-w-7xl',
  wider: 'max-w-screen-2xl',
  full: 'max-w-none',
}

const gapClasses: Record<PageGap, string> = {
  none: 'gap-0',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
}

const centeringClasses: Record<PageCentering, string> = {
  x: 'items-center',
  y: 'flex-1 justify-center',
  all: 'flex-1 items-center justify-center',
}

const props = withDefaults(
  defineProps<{
    size?: PageSize
    gap?: PageGap
    centered?: PageCentering | false
  }>(),
  {
    size: 'default',
    gap: 'md',
    centered: false,
  },
)

const sizeClass = computed(() => sizeClasses[props.size])
const gapClass = computed(() => gapClasses[props.gap])
</script>

<template>
  <div
    :class="[
      'mx-auto flex w-full flex-col px-4 md:px-6 lg:px-8',
      sizeClass,
      gapClass,
      centered && centeringClasses[centered],
    ]"
  >
    <slot />
  </div>
</template>
