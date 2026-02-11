const E164_PHONE_PATTERN = /^\+[1-9]\d{7,14}$/

const US_LOCAL_PHONE_DIGITS = 10

export const normalizePhoneNumber = (rawPhoneNumber: string) => {
  const trimmedInput = rawPhoneNumber.trim()

  if (!trimmedInput) {
    throw new Error('Invalid phone number.')
  }

  let normalizedCandidate = trimmedInput.replace(/[\s().-]/g, '')

  if (normalizedCandidate.startsWith('00')) {
    normalizedCandidate = `+${normalizedCandidate.slice(2)}`
  }

  if (!normalizedCandidate.startsWith('+')) {
    const digitsOnly = normalizedCandidate.replace(/\D/g, '')

    if (digitsOnly.length === US_LOCAL_PHONE_DIGITS) {
      normalizedCandidate = `+1${digitsOnly}`
    } else {
      normalizedCandidate = `+${digitsOnly}`
    }
  }

  normalizedCandidate = `+${normalizedCandidate.slice(1).replace(/\D/g, '')}`

  if (!E164_PHONE_PATTERN.test(normalizedCandidate)) {
    throw new Error('Invalid phone number.')
  }

  return normalizedCandidate
}
