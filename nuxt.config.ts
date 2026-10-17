import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

  modules: ['@nuxt/eslint', 'shadcn-nuxt', '@nuxtjs/i18n'],

  devtools: {
    enabled: true,
  },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Nuxt Starter',
      meta: [
        { name: 'description', content: 'An opinionated Nuxt starter.' },
      ],
      link: [
        { rel: 'icon', href: '/favicon.ico' },
      ],
    },
  },

  css: [
    '~/assets/styles/main.css',
  ],

  runtimeConfig: {
    databaseUrl: '',
    betterAuthSecret: '',
    betterAuthUrl: '',
    googleClientId: '',
    googleClientSecret: '',
    resendApiKey: '',
    emailFrom: '',
  },
  compatibilityDate: '2025-07-15',

  nitro: {
    vercel: {
      // Nitro 2.13.4's automatic version mapping stops at Node 22.
      functions: { runtime: 'nodejs24.x' },
    },
  },

  vite: {
    plugins: [
      tailwindcss(),
    ],
  },

  typescript: {
    nodeTsConfig: {
      include: [
        '../drizzle.config.ts',
        '../vitest.config.ts',
        '../test/unit/**/*.ts',
        '../test/helpers/**/*.ts',
        '../test/e2e/**/*.ts',
        '../test/fixtures/**/*.ts',
      ],
    },
  },

  eslint: {
    config: {
      stylistic: true,
    },
  },

  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'en',
    locales: [
      { code: 'en', language: 'en', name: 'English', file: 'en.json' },
      { code: 'es', language: 'es', name: 'Español', file: 'es.json' },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
    },
  },
})
