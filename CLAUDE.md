# CLAUDE.md

Guidance for Claude Code (and other AI assistants) working in this repository.

**OutreachAI** is a free, fully open-source (Apache-2.0) system that helps a YouTube creator ask brands for review units. The PC does discovery, AI and sending in local mode. A small always-on tracker watches the inbox in online mode and never sends.

## Reading order for AI

Before any task, read these in order:

1. [Project overview](context/project-overview.md)
2. [Architecture](context/architecture.md)
3. [UI context](context/ui-context.md)
4. [Code standards](context/code-standards.md)
5. [Workflow rules](context/ai-workflow-rules.md)
6. [Progress tracker](context/progress-tracker.md)
7. The relevant feature specification in [context/specs/](context/specs/)

The reasoning behind decisions is in [docs/](docs/README.md). When `context/` and `docs/` disagree, `context/` wins for implementation; fix the mismatch in the same change.

## Keep the docs current

- Keep the main `context/` files updated as the project changes, in the same commit as the code.
- Use feature specifications in `context/specs/` to describe individual tasks, written before the work starts.
- Use the [progress tracker](context/progress-tracker.md) to record what was actually implemented and verified. Never mark something verified that was not run.
