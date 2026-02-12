const JOIN_CODE_PATTERN = /^[A-Z0-9]{6,12}$/

export class JoinCodeValidationError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export const normalizeJoinCodeInput = (value: string) => {
  return value.trim().toUpperCase().replace(/[\s-]+/g, '')
}

export const isJoinCodeFormatValid = (value: string) => {
  return JOIN_CODE_PATTERN.test(normalizeJoinCodeInput(value))
}

export const parseJoinCodeOrThrow = (value: string) => {
  const normalizedCode = normalizeJoinCodeInput(value)

  if (!JOIN_CODE_PATTERN.test(normalizedCode)) {
    throw new JoinCodeValidationError('Join code must be 6-12 uppercase letters or numbers.')
  }

  return normalizedCode
}
