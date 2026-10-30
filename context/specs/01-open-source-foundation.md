# Spec 01: Open-source foundation (M0)

**Status:** In progress (requirements 1–3 done 2026-10-31; 4–10 to do) · **Milestone:** M0 · **License:** Apache-2.0, confirmed by owner 2026-10-31

## Feature purpose

Make the repository legally open source and ready for v1 code: license, required third-party notices, a Python project skeleton, and CI that enforces quality and license rules from the first commit.

## Requirements

1. Add `LICENSE` with the full Apache-2.0 text (or the license the owner chooses) and the copyright line `Copyright 2026 Hitesh Patil and contributors`.
2. Add `NOTICE` containing the Crawl4AI attribution statement word for word: *"This product includes software developed by UncleCode (https://x.com/unclecode) as part of the Crawl4AI project"*.
3. Add the same attribution to the root `README.md` under a "Credits" heading.
4. Root `README.md`: short project description, status (v0 kit usable, v1 in design), links to `docs/` and `context/`, license badge.
5. `pyproject.toml` for package `outreach` (Python ≥ 3.12) with two entry points: `outreach` and `outreach-tracker` (stubs that print the version), managed with `uv` and a committed `uv.lock`.
6. Empty package layout from [architecture.md](../architecture.md#folder-structure) with `__init__.py` files, plus `tests/` with one smoke test.
7. Dev tools configured in `pyproject.toml`: ruff (lint + format), mypy strict, pytest, import-linter contract "pc code must not import tracker; tracker must not import sender", pip-licenses.
8. GitHub Actions workflow `ci.yml` on push and PR: install with `uv`, then run ruff, mypy, pytest, import-linter, and a license check failing on non-OSI licenses (list in a config file).
9. `CONTRIBUTING.md` (points to `context/` reading order and checks), `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `SECURITY.md` (how to report privately), issue templates (bug, feature).
10. `.gitignore` extended for `uv`, `.mypy_cache`, `.ruff_cache`, `*.sqlite`, `outreach.toml`, `.env*`.

## User flow

1. Owner confirms the license choice.
2. A contributor clones the repo, runs `uv sync`, then `uv run pytest`: everything passes.
3. They open a PR; CI runs and shows green checks.
4. Anyone visiting GitHub sees the license in the sidebar and the credits in the README.

## UI behavior

No dashboard yet. CLI only:

- `outreach --version` and `outreach-tracker --version` print `outreach 0.1.0.dev0`.
- `outreach --help` ends with the Crawl4AI credit line.

## Data changes

None. No database yet.

## Permissions

None at runtime. Repository: CI runs with read-only `contents` permission.

## Edge cases

- The owner picks AGPL-3.0 or MIT instead: swap the LICENSE text, keep NOTICE (the Crawl4AI credit is required either way), and update [docs/08](../../docs/08-licensing-and-compliance.md) and the progress tracker.
- A dependency's license is reported as `UNKNOWN` by pip-licenses: add an explicit allow entry with a comment pointing to its LICENSE file, never a blanket allow.
- Windows line endings: add `.gitattributes` with `* text=auto eol=lf` so diffs stay clean between Windows and the Linux tracker.

## Acceptance criteria

- [x] GitHub shows "Apache-2.0 license" on the repo page (GitHub API reported `Apache-2.0` on 2026-10-31).
- [x] `NOTICE` and README contain the exact Crawl4AI attribution.
- [ ] `uv sync && uv run pytest` passes on a fresh clone on Windows and Linux.
- [ ] CI is green on `main` and runs all five checks.
- [ ] Adding a dependency with a non-OSI license makes CI fail (tested once on a throwaway branch, then removed).
- [ ] The import-linter contract fails if `outreach.cli` imports `outreach.tracker` (tested once, then reverted).
- [ ] `context/progress-tracker.md` updated with a dated note and the test results.

## Test plan

| Check | How |
|---|---|
| Smoke test | `tests/test_smoke.py` imports `outreach` and checks `__version__` |
| Entry points | Run `uv run outreach --version` and `uv run outreach-tracker --version` |
| License gate | Temporary branch adding a known non-OSI package; confirm CI fails; delete the branch |
| Import contract | Temporary import of `outreach.tracker` in `outreach.cli`; confirm import-linter fails; revert |
| Fresh clone | Clone into a new folder on Windows; `uv sync`; run all checks |
