import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Client } = pg

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const upMigrationsDirectory = path.resolve(currentDirectory, '../supabase/migrations')
const downMigrationsDirectory = path.resolve(currentDirectory, '../supabase/migrations_down')

const readMigrationFiles = (directory, suffix) =>
  fs
    .readdirSync(directory)
    .filter((fileName) => fileName.endsWith(suffix))
    .sort((first, second) => first.localeCompare(second))

const ensureMigrationPairs = () => {
  const upFiles = readMigrationFiles(upMigrationsDirectory, '.up.sql')
  const downFiles = readMigrationFiles(downMigrationsDirectory, '.down.sql')

  if (upFiles.length === 0) {
    throw new Error('No migration files found in supabase/migrations.')
  }

  for (const upFile of upFiles) {
    const downPair = upFile.replace('.up.sql', '.down.sql')
    if (!downFiles.includes(downPair)) {
      throw new Error(`Missing down migration for ${upFile}.`)
    }
  }

  return { upFiles, downFiles }
}

const migrationDatabaseUrl = process.env.MIGRATION_VERIFY_DATABASE_URL

if (!migrationDatabaseUrl) {
  console.log(
    'MIGRATION_VERIFY_DATABASE_URL is not set. Verified migration pair structure only.'
  )
  ensureMigrationPairs()
  process.exit(0)
}

const run = async () => {
  const { upFiles } = ensureMigrationPairs()
  const downFiles = [...upFiles]
    .reverse()
    .map((upFile) => upFile.replace('.up.sql', '.down.sql'))

  const client = new Client({ connectionString: migrationDatabaseUrl })
  await client.connect()

  try {
    for (const upFile of upFiles) {
      const upSql = fs.readFileSync(path.join(upMigrationsDirectory, upFile), 'utf8')
      await client.query(upSql)
      console.log(`Applied: ${upFile}`)
    }

    for (const downFile of downFiles) {
      const downSql = fs.readFileSync(path.join(downMigrationsDirectory, downFile), 'utf8')
      await client.query(downSql)
      console.log(`Rolled back: ${downFile}`)
    }
  } finally {
    await client.end()
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
