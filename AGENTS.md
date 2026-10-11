# QuantLab — Persistent AI Development Rules

Before changing code, read `PROJECT_CONTEXT.md` and inspect the actual repository.

## Mandatory rules

1. Preserve the existing working functionality and architecture unless a change is justified and approved.
2. Make small, focused, reversible changes.
3. Inspect relevant files and tests before editing.
4. Never claim a feature is implemented or tests pass without verification.
5. Run relevant tests after each meaningful change. Run `python -m pytest -q` and `ruff check .` when appropriate.
6. Keep the quantitative engine independent of the frontend and web framework.
7. Do not duplicate trading rules inside React components or FastAPI route handlers.
8. Prevent look-ahead bias and validate execution timing, transaction costs, cash, positions, and equity calculations.
9. Treat backtest results as historical research, not guaranteed future performance.
10. Never commit secrets, credentials, or private data without permission.
11. Inspect `git status` before making changes. Never overwrite uncommitted work.
12. Before destructive commands, major refactoring, dependency changes, database migrations, or deployment, explain the impact and request approval.
13. For significant tasks, explain the plan, affected files, acceptance criteria, and verification steps.
14. Update `PROJECT_CONTEXT.md` when major features, architecture, or project decisions change.

## Development workflow

For every feature:

- Define the expected behavior and acceptance criteria.
- Inspect the current implementation.
- Add or update tests.
- Implement the smallest appropriate change.
- Run tests and quality checks.
- Report the exact commands run and their actual results.
- Identify remaining limitations.

## Priority

Correctness first, then testability, maintainability, usability, and advanced features.

The project owner is a student developing QuantLab with AI assistance. Keep explanations clear and actionable, and ensure the resulting code can be understood and explained during a project demonstration or academic evaluation.
