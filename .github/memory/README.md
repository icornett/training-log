# Development Memory System

## Purpose
The memory system captures patterns, decisions, and lessons discovered during day-to-day development. It helps the team and AI assistants avoid repeating failed approaches, preserve successful workflows, and carry useful context forward across sessions.

## Two Types of Memory
There are two complementary memory layers in this repository:

1. Persistent memory in [.github/copilot-instructions.md](../copilot-instructions.md)
- Stores foundational project principles, workflow rules, and always-applicable guidance.
- Changes infrequently.
- Treated as the long-term operating manual for contributors and AI.

2. Working memory in [.github/memory/](.)
- Stores session-level discoveries, emerging patterns, and implementation notes.
- Changes frequently as work progresses.
- Acts as the evolving knowledge layer built from real execution.

## Directory Structure
- [.github/memory/session-notes.md](session-notes.md)
Purpose: Historical summaries of completed sessions and outcomes.
- [.github/memory/patterns-discovered.md](patterns-discovered.md)
Purpose: Accumulated implementation and debugging patterns.
- [.github/memory/scratch/working-notes.md](scratch/working-notes.md)
Purpose: Active-session notes, hypotheses, decisions, and blockers in progress.

## File Usage by Workflow

### TDD Workflow
Use this order when running Red-Green-Refactor loops:
1. Record immediate test goal and scope in [.github/memory/scratch/working-notes.md](scratch/working-notes.md).
2. Capture what failed and why (RED) under Key Findings.
3. Capture chosen implementation direction (GREEN) under Decisions Made.
4. After refactor, move durable lessons into [.github/memory/patterns-discovered.md](patterns-discovered.md).
5. At session end, summarize major outcomes in [.github/memory/session-notes.md](session-notes.md).

### Linting and Code Quality Workflow
1. Track lint categories and fix strategy in [.github/memory/scratch/working-notes.md](scratch/working-notes.md).
2. If a recurring lint issue appears, add a reusable fix pattern to [.github/memory/patterns-discovered.md](patterns-discovered.md).
3. Record final quality outcomes and unresolved risks in [.github/memory/session-notes.md](session-notes.md).

### Debugging and Integration Workflow
1. Log symptoms, failing tests, and hypotheses in [.github/memory/scratch/working-notes.md](scratch/working-notes.md).
2. Capture confirmed root cause and fix rationale in [.github/memory/patterns-discovered.md](patterns-discovered.md) if reusable.
3. Store session-level summary and impact in [.github/memory/session-notes.md](session-notes.md).

## How AI Uses This Memory
AI assistants should read these files before and during implementation work:
1. Read persistent guidance from [.github/copilot-instructions.md](../copilot-instructions.md).
2. Read active context from [.github/memory/scratch/working-notes.md](scratch/working-notes.md).
3. Reuse proven solutions from [.github/memory/patterns-discovered.md](patterns-discovered.md).
4. Use [.github/memory/session-notes.md](session-notes.md) to understand prior outcomes and avoid regressions.

When generating suggestions, AI should prioritize:
- Existing project patterns over novel rewrites.
- Previously successful debugging and testing strategies.
- Small, testable changes aligned with established workflows.

## Committed vs Ephemeral Memory
- [.github/memory/session-notes.md](session-notes.md): committed to git. It is the historical record of completed sessions.
- [.github/memory/scratch/working-notes.md](scratch/working-notes.md): not committed to git. It is an active scratchpad for in-progress work only.

Use this boundary to keep active notes lightweight while preserving high-value learnings in committed files.
