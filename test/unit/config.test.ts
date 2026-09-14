import { describe, expect, it } from 'vitest'
import { parseAuthConfig } from '../../server/auth/config'
import { parseDatabaseConfig } from '../../server/database/config'

const auth = { betterAuthSecret: 'a'.repeat(32), betterAuthUrl: 'https://app.example.test' }

describe('private configuration', () => {
  it('accepts PostgreSQL URLs and rejects missing/non-PostgreSQL URLs without leaking values', () => {
    expect(parseDatabaseConfig({ databaseUrl: 'postgresql://user:password@localhost/db' }).databaseUrl).toContain('postgresql:')
    for (const databaseUrl of [undefined, '', 'https://private:password@example.test/db', 'postgresql:///db']) {
      expect(() => parseDatabaseConfig({ databaseUrl })).toThrow('Missing or invalid configuration: NUXT_DATABASE_URL')
    }
  })

  it('accepts canonical HTTPS origins and allows localhost HTTP only in development', () => {
    expect(parseAuthConfig(auth).betterAuthUrl).toBe(auth.betterAuthUrl)
    expect(parseAuthConfig({ ...auth, betterAuthUrl: 'http://localhost:3000' }, true).betterAuthUrl).toBe('http://localhost:3000')
    for (const betterAuthUrl of ['http://localhost:3000', 'http://example.test', 'https://app.example.test/path', 'https://user:password@app.example.test', 'https://app.example.test?query=1', 'https://app.example.test#hash']) {
      expect(() => parseAuthConfig({ ...auth, betterAuthUrl })).toThrow('NUXT_BETTER_AUTH_URL')
    }
    expect(() => parseAuthConfig({ ...auth, betterAuthUrl: 'http://example.test' }, true)).toThrow('NUXT_BETTER_AUTH_URL')
  })

  it('requires a non-padding secret of at least 32 characters', () => {
    for (const betterAuthSecret of ['', 'x'.repeat(31), ' '.repeat(32), ` ${'x'.repeat(31)}`]) {
      expect(() => parseAuthConfig({ ...auth, betterAuthSecret })).toThrow('NUXT_BETTER_AUTH_SECRET')
    }
  })

  it('ignores optional integration settings, including incomplete or invalid leftovers', () => {
    expect(parseAuthConfig(auth)).toEqual(auth)
    expect(parseAuthConfig({ ...auth, googleClientId: 'id', resendApiKey: 'key', emailFrom: 123 })).toEqual(auth)
    expect(parseAuthConfig({ ...auth, googleClientSecret: false })).toEqual(auth)
  })
})
