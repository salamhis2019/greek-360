import { describe, expect, it } from 'vitest'
import { ALL_STATIC_TEST_IDS, TEST_IDS, TEST_ID_PATTERN, TEST_ID_PATTERNS } from '@/app/testing/testIds'

describe('test id registry', () => {
  it('keeps static ids unique', () => {
    const uniqueIds = new Set(ALL_STATIC_TEST_IDS)
    expect(uniqueIds.size).toBe(ALL_STATIC_TEST_IDS.length)
  })

  it('keeps static ids in kebab-case', () => {
    for (const testId of ALL_STATIC_TEST_IDS) {
      expect(TEST_ID_PATTERN.test(testId)).toBe(true)
    }
  })

  it('keeps dynamic id factories in convention', () => {
    const dynamicTestIds = [
      TEST_IDS.admin.cycleStage1Link('cycle-123'),
      TEST_IDS.admin.cycleStage2Link('cycle-123'),
      TEST_IDS.admin.cycleMessagesLink('cycle-123'),
      TEST_IDS.admin.cycleMembersLink('cycle-123'),
      TEST_IDS.superCycles.cycleOpenAdminLink('cycle-123'),
      TEST_IDS.superCycles.cycleStage1Link('cycle-123'),
      TEST_IDS.superCycles.cycleStage2Link('cycle-123'),
    ]

    for (const testId of dynamicTestIds) {
      expect(TEST_ID_PATTERN.test(testId)).toBe(true)
    }
  })

  it('keeps dynamic regex patterns aligned with generated ids', () => {
    expect(TEST_ID_PATTERNS.superCycles.cycleStage1Link.test(TEST_IDS.superCycles.cycleStage1Link('cycle-123'))).toBe(true)
  })
})
