# Test ID Convention

Use `data-testid` only for selectors that need long-term stability across copy and layout changes.

## Rules

1. Define every test id in [`src/app/testing/testIds.ts`](../src/app/testing/testIds.ts).
2. Use lowercase kebab-case only: `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
3. Prefer this shape for static ids: `<domain>-<feature>-<target>`.
4. Prefer this shape for dynamic ids: `<domain>-<resource>-<id>-<target>`.
5. In tests, import ids from `TEST_IDS` or `TEST_ID_PATTERNS`; do not inline string literals.
6. Do not use CSS suffix selectors like `[data-testid$="..."]`; use `getByTestId(...)` with a constant or pattern.

## Examples

- Static heading: `student-home-heading`
- Static input: `privacy-delete-phone-input`
- Dynamic link: `admin-cycle-<cycle-id>-stage-1-link`

## Enforcement

Run:

```bash
npm run testids:check
```

This check fails when:

- `data-testid="..."` string literals are used directly in app code.
- `getByTestId('...')` string literals are used directly in tests.
- CSS selectors target `data-testid` directly instead of `getByTestId`.
