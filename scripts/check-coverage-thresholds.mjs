import fs from 'node:fs'
import path from 'node:path'

const summaryPath = path.resolve('coverage/coverage-summary.json')

if (!fs.existsSync(summaryPath)) {
  console.error('coverage/coverage-summary.json was not found. Run npm run test:coverage first.')
  process.exit(1)
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'))

const fileEntries = Object.entries(summary).filter(([filePath]) => filePath !== 'total')

const categories = [
  {
    name: 'Domain and permission logic',
    threshold: 90,
    matcher: /(?:\/|^)(domain|logic|permissions?|state-machine)(?:\/|\.|$)/i,
  },
  {
    name: 'Edge functions and data workflows',
    threshold: 85,
    matcher: /(?:\/|^)(supabase|edge|workflows?|data)(?:\/|\.|$)/i,
  },
  {
    name: 'UI critical paths',
    threshold: 80,
    matcher: /(?:\/|^)(app|features|pages)(?:\/|\.|$)/i,
  },
]

const aggregateCoverage = (entries) => {
  let covered = 0
  let total = 0

  for (const [, fileSummary] of entries) {
    covered += fileSummary.lines.covered
    total += fileSummary.lines.total
  }

  const pct = total === 0 ? 100 : (covered / total) * 100
  return { covered, total, pct }
}

let hasFailure = false

for (const category of categories) {
  const matchedEntries = fileEntries.filter(([filePath]) => category.matcher.test(filePath))

  if (matchedEntries.length === 0) {
    console.log(`${category.name}: skipped (no matching files yet).`)
    continue
  }

  const result = aggregateCoverage(matchedEntries)
  console.log(
    `${category.name}: ${result.pct.toFixed(2)}% (${result.covered}/${result.total})`
  )

  if (result.pct < category.threshold) {
    hasFailure = true
    console.error(
      `${category.name} coverage below threshold (${result.pct.toFixed(2)}% < ${category.threshold}%).`
    )
  }
}

if (hasFailure) {
  process.exit(1)
}
