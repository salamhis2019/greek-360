import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const migrationsDirectory = path.resolve(currentDirectory, '../../../supabase/migrations')

const readMigrations = (suffix: '.up.sql' | '.down.sql') => {
  if (!fs.existsSync(migrationsDirectory)) {
    return []
  }

  return fs
    .readdirSync(migrationsDirectory)
    .filter((fileName) => fileName.endsWith(suffix))
    .sort((first, second) => first.localeCompare(second))
}

describe('Phase 0 migration verification', () => {
  it('has at least one migration pair with up and down files', () => {
    const upFiles = readMigrations('.up.sql')
    const downFiles = readMigrations('.down.sql')

    expect(upFiles.length).toBeGreaterThan(0)
    expect(downFiles.length).toBe(upFiles.length)

    for (const upFile of upFiles) {
      const pairedDownFile = upFile.replace('.up.sql', '.down.sql')
      expect(downFiles).toContain(pairedDownFile)
    }
  })

  it('includes the core extension and timestamp helper migration', () => {
    const coreUpPath = path.join(
      migrationsDirectory,
      '000001_phase0_core_extensions.up.sql'
    )
    const coreDownPath = path.join(
      migrationsDirectory,
      '000001_phase0_core_extensions.down.sql'
    )

    expect(fs.existsSync(coreUpPath)).toBe(true)
    expect(fs.existsSync(coreDownPath)).toBe(true)

    const upSql = fs.readFileSync(coreUpPath, 'utf8')
    const downSql = fs.readFileSync(coreDownPath, 'utf8')

    expect(upSql.toLowerCase()).toContain('create extension if not exists pgcrypto')
    expect(upSql.toLowerCase()).toContain('create or replace function public.set_updated_at')
    expect(downSql.toLowerCase()).toContain('drop function if exists public.set_updated_at')
  })
})
