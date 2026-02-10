import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Client } = pg
const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const seedPath = path.resolve(currentDirectory, '../supabase/seeds/test_seed.sql')
const migrationDatabaseUrl = process.env.MIGRATION_VERIFY_DATABASE_URL

if (!migrationDatabaseUrl) {
  console.log('MIGRATION_VERIFY_DATABASE_URL is not set. Skipping database seed step.')
  process.exit(0)
}

const run = async () => {
  const seedSql = fs.readFileSync(seedPath, 'utf8')
  const client = new Client({ connectionString: migrationDatabaseUrl })
  await client.connect()

  try {
    await client.query(seedSql)
    console.log('Seed loaded from supabase/seeds/test_seed.sql')
  } finally {
    await client.end()
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
