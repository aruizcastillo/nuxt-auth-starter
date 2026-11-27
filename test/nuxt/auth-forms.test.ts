import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EmailLinkForm from '~/components/auth/EmailLinkForm.vue'
import SignInForm from '~/components/auth/SignInForm.vue'
import RegisterForm from '~/components/auth/RegisterForm.vue'
import ForgotPasswordPage from '~/pages/(auth)/forgot-password.vue'
import RegisterPage from '~/pages/(auth)/register.vue'
import ResetPasswordPage from '~/pages/(auth)/reset-password.vue'
import SignInPage from '~/pages/(auth)/sign-in.vue'
import VerifyEmailPage from '~/pages/(auth)/verify-email.vue'

const { signIn, signUp, sendVerificationEmail, requestPasswordReset, resetPassword, getSession } = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  sendVerificationEmail: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  getSession: vi.fn(),
}))

vi.mock('~/lib/auth-client', async importOriginal => ({
  authClient: {
    useSession: (await importOriginal<typeof import('~/lib/auth-client')>()).authClient.useSession,
    signIn: { email: signIn },
    signUp: { email: signUp },
    sendVerificationEmail,
    requestPasswordReset,
    resetPassword,
    getSession,
  },
}))

registerEndpoint('/api/auth/get-session', () => null)

afterEach(() => vi.resetAllMocks())

describe('credential forms', () => {
  it('associates validation errors, focuses the first invalid field and blocks submission', async () => {
    const wrapper = await mountSuspended(SignInForm, { attachTo: document.body })
    await wrapper.get('form').trigger('submit')

    const email = wrapper.get<HTMLInputElement>('input[name="email"]')
    await vi.waitFor(() => {
      expect(email.attributes('aria-invalid')).toBe('true')
      expect(document.activeElement).toBe(email.element)
    })
    expect(wrapper.get(`#${email.attributes('aria-describedby')}`).text()).toBe('Enter a valid email address.')
    expect(signIn).not.toHaveBeenCalled()
  })

  it('blocks concurrent sign-in, preserves password spaces and lets a rejected request be retried', async () => {
    const pending = Promise.withResolvers<{ data: null, error: { code: string, status: number } }>()
    signIn.mockReturnValueOnce(pending.promise).mockResolvedValueOnce({ data: { redirect: false }, error: null })
    const wrapper = await mountSuspended(SignInForm)
    const email = wrapper.get<HTMLInputElement>('input[name="email"]')
    const password = wrapper.get<HTMLInputElement>('input[name="password"]')
    const form = wrapper.get('form')
    const button = wrapper.get<HTMLButtonElement>('button[type="submit"]')

    await email.setValue('person@example.test')
    await password.setValue(' x ')
    await form.trigger('submit')
    await form.trigger('submit')
    await vi.waitFor(() => expect(signIn).toHaveBeenCalledExactlyOnceWith({ email: 'person@example.test', password: ' x ' }))
    expect(button.element.disabled).toBe(true)
    expect(wrapper.get('[role="status"]:not([aria-hidden])').text()).toBe('Signing in…')

    pending.resolve({ data: null, error: { code: 'INVALID_EMAIL_OR_PASSWORD', status: 401 } })
    await vi.waitFor(() => expect(button.element.disabled).toBe(false))
    expect(wrapper.get('[role="alert"]').text()).toBe('The email address or password is incorrect.')
    expect(email.element.value).toBe('person@example.test')
    expect(wrapper.emitted('success')).toBeUndefined()

    await form.trigger('submit')
    await vi.waitFor(() => expect(wrapper.emitted('success')).toEqual([[]]))
    expect(password.element.value).toBe('')
  })

  it.each([
    [{ status: 429 }, 'Too many attempts. Wait a moment and try again.'],
    [{ code: 'INTERNAL_ERROR', status: 500 }, 'We couldn’t sign you in. Try again.'],
  ])('shows a retryable message for %j', async (error, message) => {
    signIn.mockResolvedValueOnce({ data: null, error })
    const wrapper = await mountSuspended(SignInForm)

    await wrapper.get('input[name="email"]').setValue('person@example.test')
    await wrapper.get('input[name="password"]').setValue('password')
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toBe(message))
    expect(wrapper.get<HTMLButtonElement>('button[type="submit"]').element.disabled).toBe(false)
    expect(wrapper.emitted('success')).toBeUndefined()
  })

  it.each([7, 8, 128, 129])('checks the %i-character registration password boundary', async (length) => {
    signUp.mockResolvedValueOnce({ data: { token: null }, error: null })
    const callbackURL = '/sign-in?redirect=/account'
    const wrapper = await mountSuspended(RegisterForm, { props: { callbackURL } })
    const password = ` ${'x'.repeat(length - 2)} `

    await wrapper.get('input[name="name"]').setValue('A Name')
    await wrapper.get('input[name="email"]').setValue('person@example.test')
    await wrapper.get('input[name="password"]').setValue(password)
    await wrapper.get('form').trigger('submit')

    if (length === 7 || length === 129) {
      const message = length === 7 ? 'Use at least 8 characters.' : 'Use no more than 128 characters.'
      await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toBe(message))
      expect(signUp).not.toHaveBeenCalled()
      expect(wrapper.emitted('success')).toBeUndefined()
      return
    }

    await vi.waitFor(() => expect(wrapper.emitted('success')).toEqual([['person@example.test']]))
    expect(signUp).toHaveBeenCalledExactlyOnceWith({ name: 'A Name', email: 'person@example.test', password, callbackURL })
    expect(wrapper.get<HTMLInputElement>('input[name="password"]').element.value).toBe('')
  })

  it('keeps field values and retranslates validation errors when the locale changes', async () => {
    const wrapper = await mountSuspended(SignInForm)
    const email = wrapper.get<HTMLInputElement>('input[name="email"]')
    const i18n = wrapper.vm.$i18n

    await email.setValue('person')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Enter a valid email address.'))

    try {
      await i18n.setLocale('es')
      expect(wrapper.text()).toContain('Introduce un correo electrónico válido.')
      expect(email.element.value).toBe('person')
      expect(signIn).not.toHaveBeenCalled()
    }
    finally {
      await i18n.setLocale('en')
    }
  })

  it.each(['new-user', 'synthetic-user'])('opens verification after a %s registration response', async (id) => {
    signUp.mockResolvedValueOnce({ data: { token: null, user: { id } }, error: null })
    const wrapper = await mountSuspended(RegisterPage, { route: '/register' })
    const router = wrapper.vm.$router

    await wrapper.get('input[name="name"]').setValue('A Name')
    await wrapper.get('input[name="email"]').setValue('person@example.test')
    await wrapper.get('input[name="password"]').setValue('password')
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/verify-email?redirect=/account'))
    const verification = await mountSuspended(VerifyEmailPage, { route: router.currentRoute.value.fullPath })
    expect(verification.get('h1').text()).toBe('Check your email')
    expect(verification.get<HTMLInputElement>('input[name="email"]').element.value).toBe('person@example.test')

    const directVisit = await mountSuspended(VerifyEmailPage, { route: '/verify-email' })
    expect(directVisit.get<HTMLInputElement>('input[name="email"]').element.value).toBe('')
  })

  it('opens verification with a safe destination only for unverified credentials', async () => {
    signIn.mockResolvedValueOnce({ data: null, error: { code: 'EMAIL_NOT_VERIFIED', status: 403 } })
    const destination = '/account?tab=profile#name'
    const wrapper = await mountSuspended(SignInPage, { route: `/sign-in?${new URLSearchParams({ redirect: destination })}` })
    const router = wrapper.vm.$router

    await wrapper.get('input[name="email"]').setValue('person@example.test')
    await wrapper.get('input[name="password"]').setValue('password')
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/verify-email'))
    expect(router.currentRoute.value.query).toEqual({ redirect: destination })
    expect(wrapper.get<HTMLInputElement>('input[name="password"]').element.value).toBe('')
    const verification = await mountSuspended(VerifyEmailPage, { route: router.currentRoute.value.fullPath })
    expect(verification.get<HTMLInputElement>('input[name="email"]').element.value).toBe('person@example.test')
  })
})

describe('verification and recovery forms', () => {
  it('resends once and focuses a generic acknowledgement without changing the email input', async () => {
    const pending = Promise.withResolvers<{ data: { status: boolean }, error: null }>()
    sendVerificationEmail.mockReturnValueOnce(pending.promise)
    const wrapper = await mountSuspended(EmailLinkForm, {
      attachTo: document.body,
      props: { purpose: 'verification', initialEmail: 'person@example.test', returnTo: '/sign-in?redirect=/account' },
    })
    const form = wrapper.get('form')
    const button = wrapper.get<HTMLButtonElement>('button[type="submit"]')

    await form.trigger('submit')
    await form.trigger('submit')
    await vi.waitFor(() => expect(sendVerificationEmail).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      email: 'person@example.test',
      callbackURL: '/sign-in?redirect=/account',
    })))
    expect(button.element.disabled).toBe(true)
    pending.resolve({ data: { status: true }, error: null })

    await vi.waitFor(() => expect(document.activeElement).toBe(wrapper.get('h2').element))
    expect(wrapper.text()).toContain('If a link can be sent to that address')
    expect(wrapper.get<HTMLInputElement>('input[name="email"]').element.value).toBe('person@example.test')
  })

  it('waits for the server retry interval and accepts a corrected recovery address afterward', async () => {
    requestPasswordReset.mockImplementationOnce(async ({ fetchOptions }) => {
      fetchOptions.onError({ response: new Response(null, { status: 429, headers: { 'X-Retry-After': '1' } }) })
      return { data: null, error: { status: 429 } }
    }).mockResolvedValueOnce({ data: { status: true }, error: null })
    const wrapper = await mountSuspended(ForgotPasswordPage, { route: '/forgot-password?redirect=%2F' })
    const form = wrapper.get('form')
    const button = wrapper.get<HTMLButtonElement>('button[type="submit"]')

    await wrapper.get('input[name="email"]').setValue('first@example.test')
    await form.trigger('submit')
    await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toContain('Too many attempts'))
    expect(button.element.disabled).toBe(true)
    expect(wrapper.find('h2').exists()).toBe(false)
    await form.trigger('submit')
    expect(requestPasswordReset).toHaveBeenCalledTimes(1)

    await vi.waitFor(() => expect(button.element.disabled).toBe(false), { timeout: 2000 })
    await wrapper.get('input[name="email"]').setValue('second@example.test')
    await form.trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('If a link can be sent to that address'))
    expect(requestPasswordReset).toHaveBeenLastCalledWith(expect.objectContaining({
      email: 'second@example.test',
      redirectTo: '/reset-password?redirect=/',
    }))
  })

  it.each(['', '?token=', '?token=a%20b', '?token=a&token=b', '?token=a&error=INVALID_TOKEN'])('offers a fresh link for an invalid query %s', async (query) => {
    const wrapper = await mountSuspended(ResetPasswordPage, { route: `/reset-password${query}` })
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.get('a[href^="/forgot-password"]').attributes('href')).toBe('/forgot-password?redirect=/account')
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it.each([false, true])('validates confirmation and removes the token after success with another session %s', async (anotherSession) => {
    resetPassword.mockResolvedValueOnce({ data: { status: true }, error: null })
    getSession.mockResolvedValueOnce({ data: anotherSession ? { user: { id: 'other' } } : null, error: null })
    const wrapper = await mountSuspended(ResetPasswordPage, {
      route: '/reset-password?token=fixture&redirect=%2F',
      attachTo: document.body,
    })
    const router = wrapper.vm.$router
    const password = ' valid password '
    const form = wrapper.get('form')
    await wrapper.get('input[name="newPassword"]').setValue(password)
    await wrapper.get('input[name="confirmPassword"]').setValue('different')
    await form.trigger('submit')
    await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toBe('The passwords must match.'))
    expect(resetPassword).not.toHaveBeenCalled()

    await wrapper.get('input[name="confirmPassword"]').setValue(password)
    await form.trigger('submit')
    await vi.waitFor(() => expect(wrapper.get('h1').text()).toBe('Password updated'))
    const link = anotherSession ? '/account' : '/sign-in?redirect=/'
    await vi.waitFor(() => expect(wrapper.get(`a[href="${link}"]`).exists()).toBe(true))
    const request = { token: 'fixture', newPassword: password, fetchOptions: expect.any(Object) }
    expect(resetPassword).toHaveBeenCalledExactlyOnceWith(request)
    expect(router.currentRoute.value.query).toEqual({ redirect: '/' })
    expect(wrapper.find('form').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('h1').element)
  })

  it('replaces an invalid token after a native rejection and keeps the recovery link', async () => {
    resetPassword.mockResolvedValueOnce({ data: null, error: { code: 'INVALID_TOKEN', status: 400 } })
    const wrapper = await mountSuspended(ResetPasswordPage, { route: '/reset-password?token=fixture' })
    const router = wrapper.vm.$router

    await wrapper.get('input[name="newPassword"]').setValue('replacement-password')
    await wrapper.get('input[name="confirmPassword"]').setValue('replacement-password')
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ redirect: '/account' }))
    expect(wrapper.get('[role="alert"]').text()).toContain('Request a new link')
    expect(wrapper.get('a[href^="/forgot-password"]').exists()).toBe(true)
    expect(getSession).not.toHaveBeenCalled()
  })
})
