# context/

## Folder purpose

Short, working context for anyone (human or AI assistant) about to change this repository. It says **what we are building, how, to what standard, and where things stand**.

- `docs/` is the **design**: long-form research, options and reasons. Read it when you need the *why*.
- `context/` is the **working brief**: the decisions in their current form, rules to follow, and a record of what was actually built and verified.

When `context/` and `docs/` disagree, `context/` wins for implementation work. Fix the mismatch in the same change.

## File descriptions

| File | What it holds |
|---|---|
| [project-overview.md](project-overview.md) | What OutreachAI is, who uses it, journeys, features, scope, success criteria |
| [architecture.md](architecture.md) | Stack, folder layout, boundaries between PC and tracker, data models, auth, integrations, business rules |
| [ui-context.md](ui-context.md) | Look and behaviour of the tracker dashboard and the CLI output |
| [code-standards.md](code-standards.md) | Naming, structure, typing, validation, errors, API style, migrations, tests |
| [ai-workflow-rules.md](ai-workflow-rules.md) | How an AI assistant must work in this repo: scope, safety, verification |
| [progress-tracker.md](progress-tracker.md) | Current goal, done, in progress, blockers, decisions, test results, dated notes |
| [specs/](specs/) | One file per feature or milestone task, written before the work starts |

Current specs:

| Spec | Milestone |
|---|---|
| [specs/01-open-source-foundation.md](specs/01-open-source-foundation.md) | M0: license, notices, repo layout, CI |
| [specs/02-tracker-service-and-auth.md](specs/02-tracker-service-and-auth.md) | M1: tracker API, database, API token and dashboard login |
| [specs/03-send-and-track-slice.md](specs/03-send-and-track-slice.md) | M2: send over SMTP from the PC, detect the reply on the tracker |

## Reading order

The same order is in the root [CLAUDE.md](../CLAUDE.md), which AI coding assistants load automatically. Keep the two in step. For any task:

1. [project-overview.md](project-overview.md)
2. [architecture.md](architecture.md)
3. [ui-context.md](ui-context.md) (if the task touches the dashboard or CLI output)
4. [code-standards.md](code-standards.md)
5. [ai-workflow-rules.md](ai-workflow-rules.md)
6. [progress-tracker.md](progress-tracker.md)
7. The relevant spec in [specs/](specs/)

## Documentation update rules

- **Main files describe the system as it is meant to be now.** Change them in the same commit as the code that changes the design. No "will update later".
- **Specs describe one piece of work.** Write or update the spec *before* implementing. Once it's done, mark its status `Done` and leave it unchanged except to fix errors.
- **The progress tracker records what really happened**: what was built, what was tested, and how. Never mark something verified that was not run.
- New spec files are numbered in order: `NN-short-name.md`. Copy the section list from an existing spec.
- Dates use `YYYY-MM-DD`. Times are IST unless stated.
- Keep files short. Put long research in `docs/` and link to it.
