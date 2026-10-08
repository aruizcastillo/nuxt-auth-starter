import { createDatabase } from './providers/neon'

export { createDatabase }
export type Database = ReturnType<typeof createDatabase>
