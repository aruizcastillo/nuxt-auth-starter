import { describe, expect, it } from 'vitest'
import { safeRedirect } from '../../shared/utils/safe-redirect'

describe('safe return destinations', () => {
  it.each([
    '/',
    '/?tab=profile#heading',
    '/?label=a%20b&tab=one&tab=two',
    '/account?section=profile#display-name',
  ])('preserves %s', (destination) => {
    expect(safeRedirect(destination)).toBe(destination)
  })

  it.each([
    undefined,
    null,
    ['/', '/account'],
    ['/'],
    '',
    'https://example.test/',
    '//example.test/',
    '/\\example.test/',
    '/%2fexample.test',
    '/%61ccount?tab=profile',
    '/path/../?tab=profile',
    '/%2e%2e/?tab=profile',
    '/account/',
    '/sign-in?redirect=/',
    '/register',
    '/api/account',
    '/?value=%5c',
    '/?value=%0d%0a',
    '/?value=%zz',
    '/?value=\u0000',
  ].map(destination => ({ destination })))('falls back for $destination', ({ destination }) => {
    expect(safeRedirect(destination)).toBe('/account')
  })
})
