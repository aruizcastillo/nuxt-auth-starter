import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SignInForm from '~/components/auth/SignInForm.vue'
import RegisterForm from '~/components/auth/RegisterForm.vue'
import RegisterPage from '~/pages/(auth)/register.vue'

const { signIn, signUp } = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}))

vi.mock('~/lib/auth-client', () => ({
  authClient: {
    signIn: { email: signIn },
    signUp: { email: signUp },
  },
}))

afterEach(() => {
  signIn.mockReset()
  signUp.mockReset()
})

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
    [{ code: 'EMAIL_NOT_VERIFIED', status: 403 }, 'Verify your email before signing in.'],
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

    await vi.waitFor(() => expect(wrapper.emitted('success')).toEqual([[]]))
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

  it.each(['new-user', 'synthetic-user'])('shows the same registration confirmation for a %s response', async (id) => {
    signUp.mockResolvedValueOnce({ data: { token: null, user: { id } }, error: null })
    const wrapper = await mountSuspended(RegisterPage, { attachTo: document.body })

    await wrapper.get('input[name="name"]').setValue('A Name')
    await wrapper.get('input[name="email"]').setValue('person@example.test')
    await wrapper.get('input[name="password"]').setValue('password')
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => expect(wrapper.get('h1').text()).toBe('Check your email'))
    expect(document.activeElement).toBe(wrapper.get('h1').element)
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.get('a[href^="/sign-in"]').attributes('href')).toBe('/sign-in?redirect=/account')
    expect(wrapper.text()).toContain('Delivery can take a few minutes.')
    expect(wrapper.text()).not.toContain('person@example.test')
  })
})
