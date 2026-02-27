import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOTS = ['src', 'tests']
const SOURCE_FILE_PATTERN = /\.(?:[cm]?[jt]sx?)$/
const ALLOWED_LITERAL_TEST_ID_FILES = new Set(['src/app/testing/testIds.ts'])

const DATA_TESTID_LITERAL_PATTERN = /data-testid\s*=\s*(["'`])[^"'`]+\1/g
const GET_BY_TESTID_LITERAL_PATTERN = /getByTestId\(\s*(["'`])[^"'`]+\1\s*\)/g
const DATA_TESTID_LOCATOR_PATTERN = /locator\(\s*(["'`])[^"'`]*\[data-testid[^"'`]*\1\s*\)/g

const walkFiles = (directory) => {
  const entries = readdirSync(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const resolvedPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkFiles(resolvedPath))
      continue
    }

    if (!entry.isFile() || !SOURCE_FILE_PATTERN.test(entry.name)) {
      continue
    }

    files.push(resolvedPath)
  }

  return files
}

const resolveLineNumber = (content, index) => content.slice(0, index).split('\n').length

const findMatches = (content, regex, violationType) => {
  const matches = []
  for (const match of content.matchAll(regex)) {
    if (match.index === undefined) {
      continue
    }

    matches.push({
      line: resolveLineNumber(content, match.index),
      snippet: match[0],
      violationType,
    })
  }

  return matches
}

const violations = []

for (const root of ROOTS) {
  if (!statSync(root, { throwIfNoEntry: false })) {
    continue
  }

  for (const absolutePath of walkFiles(root)) {
    const filePath = relative(process.cwd(), absolutePath)
    const content = readFileSync(absolutePath, 'utf8')
    const fileViolations = []

    if (!ALLOWED_LITERAL_TEST_ID_FILES.has(filePath)) {
      fileViolations.push(...findMatches(content, DATA_TESTID_LITERAL_PATTERN, 'literal-data-testid'))
    }

    fileViolations.push(
      ...findMatches(content, GET_BY_TESTID_LITERAL_PATTERN, 'literal-getByTestId'),
      ...findMatches(content, DATA_TESTID_LOCATOR_PATTERN, 'css-data-testid-locator')
    )

    for (const violation of fileViolations) {
      violations.push({
        filePath,
        ...violation,
      })
    }
  }
}

if (violations.length > 0) {
  console.error('Test ID convention violations found:')
  for (const violation of violations) {
    console.error(
      `- ${violation.filePath}:${violation.line} [${violation.violationType}] ${violation.snippet}`
    )
  }
  process.exit(1)
}

console.log('Test ID convention check passed.')
