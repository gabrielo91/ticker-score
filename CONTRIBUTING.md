# Contributing to DarkScore

## Getting Started

1. Read `AGENTS.md` — the project entry point for all contributors (human and AI)
2. Read `.specify/memory/constitution.md` — the 13 immutable rules
3. Read `.specify/specs/001-darkscore-foundation/plan.md` — current project state and next actions

## Development Workflow

### Branch Strategy
- `main` — protected, requires PR + 1 approval, linear history
- Feature branches: `feature/{spec-id}-{short-description}` (e.g., `feature/001-types-package`)
- Fix branches: `fix/{short-description}`

### PR Rules
1. Every PR must reference a spec section or task
2. Every PR must pass `pnpm turbo validate` (automated checks)
3. Every PR must pass `pnpm turbo test` (where tests exist)
4. PRs that complete a wave must update `plan.md`
5. PRs that modify the constitution or spec require owner review (CODEOWNERS)
6. No direct commits to `main` — all changes via PR

### Pre-Submission Checklist
```bash
pnpm turbo validate     # boundaries + no-any + typecheck + lint
pnpm turbo test         # unit tests
```

### For AI Agents
Follow the context chain defined in C8:
1. Read `AGENTS.md`
2. Read your package's `CONSTITUTION.md`
3. Read your task note/description
4. Read ONLY the files you will modify
5. Run `pnpm turbo validate` before reporting completion

Do NOT explore the full codebase. Do NOT add dependencies not in the spec. If unsure, stop and ask.

## Architecture

See `.specify/specs/001-darkscore-foundation/architecture.md` for the full architecture.

### Package Dependency Rules

| Package | May import from |
|---------|----------------|
| `@darkscore/types` | Nothing (leaf) |
| `@darkscore/cache` | types |
| `@darkscore/db` | types |
| `@darkscore/data-providers` | types, cache |
| `@darkscore/scoring-engine` | types (ONLY — pure computation) |
| `apps/web` | types, cache, db, data-providers, scoring-engine |

Violations are caught automatically by `scripts/check-boundaries.ts`.

## Code Standards

- **TypeScript**: strict mode, no `any`, no escape hatches
- **Naming**: camelCase (functions), PascalCase (types), SCREAMING_SNAKE (constants), kebab-case (files)
- **Testing**: Vitest, colocated as `*.test.ts`, 80% coverage target for scoring-engine and data-providers
- **Frontend**: Presentation-Domain-Data layering (C12). See `.specify/specs/001-darkscore-foundation/frontend-guidelines.md`

