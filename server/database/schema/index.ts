import { defineRelations } from 'drizzle-orm'
import { account, authRelations, session, user, verification } from './auth'

export const authTables = { user, session, account, verification }
export const relations = { ...defineRelations(authTables), ...authRelations }
