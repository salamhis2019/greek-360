export const TEST_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const TEST_IDS = {
  app: {
    brandLink: 'app-brand-link',
    environment: 'app-environment',
  },
  auth: {
    stepPhone: 'auth-step-phone',
    stepOtp: 'auth-step-otp',
    stepProfile: 'auth-step-profile',
    stepTitle: 'auth-step-title',
    state: 'auth-state',
    roles: 'auth-roles',
  },
  student: {
    homeHeading: 'student-home-heading',
  },
  joinInterest: {
    heading: 'join-interest-heading',
    submittedHeading: 'join-interest-submitted-heading',
  },
  privacy: {
    settingsHeading: 'privacy-settings-heading',
    deletePhoneInput: 'privacy-delete-phone-input',
  },
  offers: {
    inboxHeading: 'offers-inbox-heading',
  },
  profile: {
    heading: 'profile-heading',
  },
  directory: {
    heading: 'directory-heading',
  },
  recruitment: {
    stage1Heading: 'recruitment-stage-1-heading',
    stage2Heading: 'recruitment-stage-2-heading',
    navStage1Link: 'recruitment-nav-stage-1-link',
    navStage2Link: 'recruitment-nav-stage-2-link',
    navMessagesLink: 'recruitment-nav-messages-link',
    navMembersLink: 'recruitment-nav-members-link',
  },
  messages: {
    heading: 'messages-heading',
  },
  superAdmin: {
    universitiesHeading: 'super-universities-heading',
    organizationsHeading: 'super-organizations-heading',
    cyclesHeading: 'super-cycles-heading',
    adminsHeading: 'super-admins-heading',
  },
  admin: {
    cycleStage1Link: (cycleId: string) => `admin-cycle-${cycleId}-stage-1-link`,
    cycleStage2Link: (cycleId: string) => `admin-cycle-${cycleId}-stage-2-link`,
    cycleMessagesLink: (cycleId: string) => `admin-cycle-${cycleId}-messages-link`,
    cycleMembersLink: (cycleId: string) => `admin-cycle-${cycleId}-members-link`,
  },
  superCycles: {
    cycleOpenAdminLink: (cycleId: string) => `super-cycle-${cycleId}-open-admin-link`,
    cycleStage1Link: (cycleId: string) => `super-cycle-${cycleId}-stage-1-link`,
    cycleStage2Link: (cycleId: string) => `super-cycle-${cycleId}-stage-2-link`,
  },
} as const

export const TEST_ID_PATTERNS = {
  superCycles: {
    cycleStage1Link: /^super-cycle-[a-z0-9-]+-stage-1-link$/,
  },
} as const

const collectStaticTestIds = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return [value]
  }

  if (typeof value === 'function' || value === null || typeof value !== 'object') {
    return []
  }

  return Object.values(value).flatMap((entry) => collectStaticTestIds(entry))
}

export const ALL_STATIC_TEST_IDS = collectStaticTestIds(TEST_IDS)
