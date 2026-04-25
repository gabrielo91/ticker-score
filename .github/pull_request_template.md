## What

<!-- One-line description of what this PR does -->

## Why

<!-- Link to spec section or task that this fulfills -->
Spec: `.specify/specs/001-darkscore-foundation/spec.md`
Task: <!-- W1-1, W2-3, etc. -->

## Changes

<!-- Bullet list of what was added/changed/removed -->

## Checklist

- [ ] I have read AGENTS.md and my package's CONSTITUTION.md
- [ ] `pnpm turbo validate` passes (boundary check + no-any + typecheck + lint)
- [ ] `pnpm turbo test` passes (where tests exist)
- [ ] No `any` types, no `@ts-ignore`, no `@ts-expect-error`
- [ ] No cross-boundary imports (checked by scripts/check-boundaries.ts)
- [ ] No files created outside the task's stated scope
- [ ] No new dependencies added that aren't listed in the spec
- [ ] plan.md updated (if this PR completes a wave)

## Testing

<!-- How was this tested? What commands were run? -->

```bash
pnpm turbo validate
pnpm turbo test
```

## Screenshots / Verification

<!-- For UI changes: before/after screenshots -->
<!-- For backend changes: command output showing it works -->

