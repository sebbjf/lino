import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { and, eq, gt, lt } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { boards } from './schema.ts'

/** Where shared boards are kept. The app takes one so tests can use a Map. */
export type BoardStore = {
  create: (data: unknown, bytes: number, expiresAt: Date) => Promise<string>
  get: (id: string) => Promise<unknown | null>
}

/** 12 url-safe chars, 72 random bits: unguessable, so the link is the only key. */
export const newId = () => randomBytes(9).toString('base64url')

export async function pgBoards(url: string): Promise<BoardStore & { close: () => Promise<void> }> {
  const sql = postgres(url, { max: 5 })
  const db = drizzle(sql)
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) })
  return {
    async create(data, bytes, expiresAt) {
      const id = newId()
      await db.insert(boards).values({ id, data, bytes, expiresAt })
      // ponytail: expired rows are swept on each share; move to a cron if shares become frequent.
      await db.delete(boards).where(lt(boards.expiresAt, new Date()))
      return id
    },
    async get(id) {
      const [row] = await db
        .select({ data: boards.data })
        .from(boards)
        .where(and(eq(boards.id, id), gt(boards.expiresAt, new Date())))
      return row?.data ?? null
    },
    close: () => sql.end(),
  }
}
