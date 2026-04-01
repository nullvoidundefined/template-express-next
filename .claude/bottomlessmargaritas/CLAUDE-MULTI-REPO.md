# Multi-Repo & Multi-Agent Work

These rules apply when performing the same task across multiple repositories or packages, or when launching parallel agents. Follow them to avoid wasted tokens, redundant work, and failed operations.

---

## Audit Before Acting

Before launching agents or making changes across repos:

1. **Grep across all repos first.** A single `grep -rl "pattern"` shows which repos already have the code. Only target repos that actually need changes.
2. **Read task/TODO status upfront.** Check if tasks are already done or partially complete. A single audit pass identifies the real gaps and prevents redoing finished work.
3. **Check the environment.** Verify assumptions (e.g., is the directory a git repo? does the branch exist? is the file already present?) before launching work that depends on them. One failed assumption wastes an entire agent run.

---

## Minimize Prompt Size

- **Use a shared template file.** Instead of embedding the full code in every agent prompt, write a single template file first, then tell each agent "copy from `{source-repo}` and adapt." Much shorter prompts.
- **Reference by path, not by content.** "Apply the ApiError pattern from `job-tracker-ai/src/utils/ApiError.ts`" is far cheaper than pasting the full class 8 times.
- **Use diff-style instructions for variations.** "Same as the template, but change the queue name to `content-pipeline`" rather than repeating the entire file with one line changed.

---

## Batch and Sequence Intelligently

- **Batch similar repos into one agent.** Instead of 1 agent per repo, have 1 agent handle 2-3 repos with identical structure. One agent can `cd` between them.
- **Do the first repo manually, then templatize.** Complete the pattern in one repo, verify it works, then use a concise prompt for the rest: "Apply the same pattern from `{first-repo}`. Files to change: `{list}`."
- **Sequential with pattern reuse beats parallel with redundancy.** Eight agents each figuring out the same pattern independently is worse than one agent establishing the pattern and seven agents applying it.

---

## Agent Launch Checklist

Before spawning a parallel agent:

| Check | Why |
|-------|-----|
| Does this repo already have the code? | `grep` first — skip repos that don't need work |
| Is the task already marked done? | Read task status — don't redo finished work |
| Is the working directory a valid git repo? | Worktree operations fail on non-repo directories |
| Can this agent share work with another? | Batch 2-3 similar repos into one agent |
| Is the prompt under ~200 lines? | Reference files by path instead of inlining content |
| Does the agent need the full file or just the diff? | "Change line 42 from X to Y" beats "here's the entire 300-line file" |

---

## Model Selection for Agents

Not every agent needs the most powerful model. Match model capability to task complexity:

| Task Type | Recommended Model | Examples |
|-----------|------------------|----------|
| Mechanical / repetitive | Sonnet (or equivalent fast model) | Copy a pattern to another repo, add a CI config file, rename imports, apply a known fix |
| Deep reasoning | Opus (or equivalent capable model) | Architecture decisions, complex refactoring, debugging test failures, designing new abstractions |

**Default to the cheaper model.** If the agent's job is "copy this file, change these 3 values," that does not require top-tier reasoning. Reserve the most capable model for tasks where the agent needs to make judgment calls, understand complex interactions, or debug non-obvious failures.

---

## Common Pitfalls

| Pitfall | Cost | Fix |
|---------|------|-----|
| Launching agents before checking existing state | Agents do redundant work on repos that already have the code | `grep -rl` across all repos first |
| Inlining full code in every agent prompt | Multiplied token usage (N repos x full file) | Write template once, reference by path |
| One agent per repo for identical changes | High parallelism overhead, redundant pattern discovery | Batch 2-3 similar repos per agent |
| Assuming directory structure without checking | Worktree failures, wrong paths, wasted retries | `ls` and `git status` before launching |
| Not reading TODO/task status before starting | Redoing completed tasks | Single audit pass first |
| Retrying failed operations without diagnosing | Same failure repeated | Check root cause (not a git repo, file doesn't exist, etc.) before retry |
| Using the most capable model for every agent | Unnecessary token cost on mechanical tasks | Use Sonnet for copy/paste pattern work, Opus for reasoning-heavy tasks |
