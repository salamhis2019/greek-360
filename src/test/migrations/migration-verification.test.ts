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

  it('includes the phase 4 recruitment decisions migration pair, secured decision writes, and queue listing functions', () => {
    const phaseFourUpPath = path.join(
      upMigrationsDirectory,
      '000005_phase4_recruitment_decisions.up.sql'
    )
    const phaseFourDownPath = path.join(
      downMigrationsDirectory,
      '000005_phase4_recruitment_decisions.down.sql'
    )

    expect(fs.existsSync(phaseFourUpPath)).toBe(true)
    expect(fs.existsSync(phaseFourDownPath)).toBe(true)

    const upSql = fs.readFileSync(phaseFourUpPath, 'utf8').toLowerCase()
    const downSql = fs.readFileSync(phaseFourDownPath, 'utf8').toLowerCase()

    expect(upSql).toContain('create table if not exists public.recruitment_decisions')
    expect(upSql).toContain("stage text not null check (stage in ('shortlist', 'final'))")
    expect(upSql).toContain('create or replace function public.assert_recruitment_decision_actor')
    expect(upSql).toContain('create or replace function public.list_recruitment_stage1_queue')
    expect(upSql).toContain('create or replace function public.list_recruitment_stage2_queue')
    expect(upSql).toContain('create or replace function public.write_recruitment_stage1_decision')
    expect(upSql).toContain('create or replace function public.write_recruitment_stage2_decision')
    expect(upSql).toContain('recruitment_stage1_decision_recorded')
    expect(upSql).toContain('recruitment_stage2_decision_recorded')

    expect(downSql).toContain('drop function if exists public.write_recruitment_stage2_decision')
    expect(downSql).toContain('drop function if exists public.write_recruitment_stage1_decision')
    expect(downSql).toContain('drop function if exists public.list_recruitment_stage2_queue')
    expect(downSql).toContain('drop function if exists public.list_recruitment_stage1_queue')
    expect(downSql).toContain('drop table if exists public.recruitment_decisions')
  })

  it('includes the phase 5 offers and memberships migration pair with offer response workflow', () => {
    const phaseFiveUpPath = path.join(
      upMigrationsDirectory,
      '000006_phase5_offers_memberships.up.sql'
    )
    const phaseFiveDownPath = path.join(
      downMigrationsDirectory,
      '000006_phase5_offers_memberships.down.sql'
    )

    expect(fs.existsSync(phaseFiveUpPath)).toBe(true)
    expect(fs.existsSync(phaseFiveDownPath)).toBe(true)

    const upSql = fs.readFileSync(phaseFiveUpPath, 'utf8').toLowerCase()
    const downSql = fs.readFileSync(phaseFiveDownPath, 'utf8').toLowerCase()

    expect(upSql).toContain('create table if not exists public.offers')
    expect(upSql).toContain('create table if not exists public.memberships')
    expect(upSql).toContain("status text not null check (status in ('pending', 'accepted', 'declined', 'expired'))")
    expect(upSql).toContain("status text not null check (status in ('active', 'inactive'))")
    expect(upSql).toContain('create unique index if not exists memberships_user_active_unique_idx')
    expect(upSql).toContain('create or replace function public.create_offer_for_final_yes')
    expect(upSql).toContain('create or replace function public.respond_to_offer')
    expect(upSql).toContain('offer_accepted')
    expect(upSql).toContain('offer_declined')
    expect(upSql).toContain('membership_activated')

    expect(downSql).toContain('drop function if exists public.respond_to_offer(uuid, text)')
    expect(downSql).toContain('drop function if exists public.create_offer_for_final_yes(uuid)')
    expect(downSql).toContain('drop table if exists public.memberships')
    expect(downSql).toContain('drop table if exists public.offers')
  })

  it('includes the phase 6 directory and privacy migration pair with search and redaction workflow', () => {
    const phaseSixUpPath = path.join(
      upMigrationsDirectory,
      '000007_phase6_directory_privacy.up.sql'
    )
    const phaseSixDownPath = path.join(
      downMigrationsDirectory,
      '000007_phase6_directory_privacy.down.sql'
    )

    expect(fs.existsSync(phaseSixUpPath)).toBe(true)
    expect(fs.existsSync(phaseSixDownPath)).toBe(true)

    const upSql = fs.readFileSync(phaseSixUpPath, 'utf8').toLowerCase()
    const downSql = fs.readFileSync(phaseSixDownPath, 'utf8').toLowerCase()

    expect(upSql).toContain('create or replace view public.directory_profile_memberships_v')
    expect(upSql).toContain('create or replace function public.search_directory_people')
    expect(upSql).toContain('users_university_lower_name_idx')
    expect(upSql).toContain('organizations_university_lower_name_idx')
    expect(upSql).toContain('phone_e164')
    expect(upSql).toContain('email')

    expect(downSql).toContain('drop function if exists public.search_directory_people(text, uuid)')
    expect(downSql).toContain('drop view if exists public.directory_profile_memberships_v')
    expect(downSql).toContain('drop index if exists users_university_lower_name_idx')
    expect(downSql).toContain('drop index if exists organizations_university_lower_name_idx')
  })
})
