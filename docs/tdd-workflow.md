# TDD Workflow (Required)

This repository follows strict TDD for every phase and every feature.

## Red -> Green -> Refactor

1. Red:
- Write a failing test for behavior before writing implementation.
- Confirm failure locally.

2. Green:
- Implement the minimum code required to pass.
- Re-run tests and confirm green.

3. Refactor:
- Improve structure/readability without changing behavior.
- Re-run full impacted suite.

## Required Test Layers

- Unit tests for pure logic.
- Integration tests for DB/function boundaries.
- E2E tests for critical user flows.
- Security tests for authorization and abuse paths.

## Phase 0 Baseline Commands

```bash
npm run lint
npm run typecheck
npm run test:ci
npm run migration:verify
npm run test:coverage
npm run test:e2e
npm run test:security
```

## Definition of Done Checklist

- Failing test existed before implementation.
- Negative paths are covered where applicable.
- CI fast and full checks are green.
- Migration rollback verification passes for schema changes.
- PR template TDD section is fully completed.
