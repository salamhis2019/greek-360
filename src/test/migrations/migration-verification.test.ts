import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const upMigrationsDirectory = path.resolve(currentDirectory, '../../../supabase/migrations')
const downMigrationsDirectory = path.resolve(
  currentDirectory,
  '../../../supabase/migrations_down'
)

const readUpMigrations = () => {
  if (!fs.existsSync(upMigrationsDirectory)) {
    return []
  }

  return fs
    .readdirSync(upMigrationsDirectory)
    .filter((fileName) => fileName.endsWith('.up.sql'))
    .sort((first, second) => first.localeCompare(second))
}

const readDownMigrations = () => {
  if (!fs.existsSync(downMigrationsDirectory)) {
    return []
  }

  return fs
    .readdirSync(downMigrationsDirectory)
    .filter((fileName) => fileName.endsWith('.down.sql'))
    .sort((first, second) => first.localeCompare(second))
}

describe('Phase 0 migration verification', () => {
  it('has at least one migration pair with up and down files', () => {
    const upFiles = readUpMigrations()
    const downFiles = readDownMigrations()

    expect(upFiles.length).toBeGreaterThan(0)
    expect(downFiles.length).toBe(upFiles.length)

    for (const upFile of upFiles) {
      const pairedDownFile = upFile.replace('.up.sql', '.down.sql')
      expect(downFiles).toContain(pairedDownFile)
    }
  })

  it('includes the core extension and timestamp helper migration', () => {
    const coreUpPath = path.join(upMigrationsDirectory, '000001_phase0_core_extensions.up.sql')
    const coreDownPath = path.join(
      downMigrationsDirectory,
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

  it('includes the phase 1 identity migration pair and users table constraints', () => {
    const phaseOneUpPath = path.join(
      upMigrationsDirectory,
      '000002_phase1_identity_onboarding.up.sql'
    )
    const phaseOneDownPath = path.join(
      downMigrationsDirectory,
      '000002_phase1_identity_onboarding.down.sql'
    )

    expect(fs.existsSync(phaseOneUpPath)).toBe(true)
    expect(fs.existsSync(phaseOneDownPath)).toBe(true)

    const upSql = fs.readFileSync(phaseOneUpPath, 'utf8').toLowerCase()
    const downSql = fs.readFileSync(phaseOneDownPath, 'utf8').toLowerCase()

    expect(upSql).toContain('create table if not exists public.users')
    expect(upSql).toContain('phone_e164 text not null unique')
    expect(upSql).toContain('enable row level security')
    expect(upSql).toContain('normalize_phone_e164')
    expect(downSql).toContain('drop table if exists public.users')
  })

  it('includes the phase 2 super-admin migration pair, core tables, and permission functions', () => {
    const phaseTwoUpPath = path.join(
      upMigrationsDirectory,
      '000003_phase2_super_admin_foundation.up.sql'
    )
    const phaseTwoDownPath = path.join(
      downMigrationsDirectory,
      '000003_phase2_super_admin_foundation.down.sql'
    )

    expect(fs.existsSync(phaseTwoUpPath)).toBe(true)
    expect(fs.existsSync(phaseTwoDownPath)).toBe(true)

    const upSql = fs.readFileSync(phaseTwoUpPath, 'utf8').toLowerCase()
    const downSql = fs.readFileSync(phaseTwoDownPath, 'utf8').toLowerCase()

    expect(upSql).toContain('create table if not exists public.universities')
    expect(upSql).toContain('create table if not exists public.organizations')
    expect(upSql).toContain('create table if not exists public.recruitment_cycles')
    expect(upSql).toContain('create table if not exists public.join_links')
    expect(upSql).toContain('create table if not exists public.organization_admins')
    expect(upSql).toContain('create table if not exists public.super_admin_users')
    expect(upSql).toContain('alter table public.universities enable row level security')
    expect(upSql).toContain('create or replace function public.create_university')
    expect(upSql).toContain('create or replace function public.assign_organization_admin')
    expect(upSql).toContain('create or replace function public.revoke_organization_admin')

    expect(downSql).toContain('drop function if exists public.revoke_organization_admin(uuid, uuid)')
    expect(downSql).toContain('drop table if exists public.organization_admins')
    expect(downSql).toContain('drop table if exists public.join_links')
    expect(downSql).toContain('drop table if exists public.recruitment_cycles')
    expect(downSql).toContain('drop table if exists public.organizations')
    expect(downSql).toContain('drop table if exists public.universities')
    expect(downSql).toContain('drop table if exists public.super_admin_users')
  })

  it('includes the phase 3 interest capture migration pair, submission functions, and audit logging', () => {
    const phaseThreeUpPath = path.join(
      upMigrationsDirectory,
      '000004_phase3_interest_capture.up.sql'
    )
    const phaseThreeDownPath = path.join(
      downMigrationsDirectory,
      '000004_phase3_interest_capture.down.sql'
    )

    expect(fs.existsSync(phaseThreeUpPath)).toBe(true)
    expect(fs.existsSync(phaseThreeDownPath)).toBe(true)

    const upSql = fs.readFileSync(phaseThreeUpPath, 'utf8').toLowerCase()
    const downSql = fs.readFileSync(phaseThreeDownPath, 'utf8').toLowerCase()

    expect(upSql).toContain('create table if not exists public.interest_entries')
    expect(upSql).toContain('create table if not exists public.audit_logs')
    expect(upSql).toContain("source text not null check (source in ('qr', 'manual_code'))")
    expect(upSql).toContain('create or replace function public.resolve_active_join_link')
    expect(upSql).toContain('create or replace function public.submit_interest')
    expect(upSql).toContain('interest_submission_duplicate')
    expect(upSql).toContain('interest_submitted')

    expect(downSql).toContain('drop function if exists public.submit_interest(text, text)')
    expect(downSql).toContain('drop function if exists public.resolve_active_join_link(text)')
    expect(downSql).toContain('drop table if exists public.interest_entries')
    expect(downSql).toContain('drop table if exists public.audit_logs')
  })
})
