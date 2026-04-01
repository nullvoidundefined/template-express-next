# Spec-to-Build Prompt

Use this prompt to kick off a new application build from a spec. Paste it into a Claude Code session with the spec file in the working directory.

---

## The Prompt

Build the app according to the spec in this folder.

**Step 1:** Break the spec into atomic tasks.

### Foundation

- **Use the appropriate project template** — base the app on the matching template from the templates directory.
- **Follow domain-specific CLAUDE.md rules** — frontend, backend, testing, deployment, etc. These are already defined and are the source of truth.
- **Install Bottomless Margaritas** — the app must have direct access to formatting and CLAUDE.md files at runtime.
- **Hosting stack: Vercel, Railway, and Neon** — prefer these where possible. Do not introduce alternative infrastructure without discussion.

### Process

- **TDD throughout** — write tests first, write code, run tests, do not commit until tests pass.
- **Commit frequently and atomically** — one task per commit. Use multi-agent Git tree workflows.
- **After each task, update the task list and clear context** — the docs should be the source of truth guiding us. Do not carry stale context forward.
- **Flag spec inconsistencies immediately** — call out anything ambiguous, contradictory, or underspecified. I'd rather abort than go down a rabbit hole.

### Phase 0 Requirement

- **Bruno requests for all API endpoints** — every endpoint must have a corresponding Bruno request that can be run against it. This is a Phase 0 deliverable, not a nice-to-have.

### Model Routing

- **Opus** — architecture decisions, system design, spec decomposition.
- **Sonnet** — implementation, feature work, test writing.
- **Haiku** — chores, cleanup, formatting, mechanical refactors.

### After the Task List Is Complete

- **Run a feasibility assessment** — before writing any code, evaluate the full task list against the spec. Flag scope risks, context drift concerns, and anything likely to fall apart mid-build. I want a realistic read, not optimism.

If any of this is unclear, ask for clarification before starting work.
