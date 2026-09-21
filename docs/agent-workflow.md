# Agent workflow

AGENTS.md is the only common instruction source. Tool adapters contain references,
not copies of these rules. No MCP, external memory or paid provider is required.

## Loading instructions

Codex CLI `0.155.1` and Claude Code `2.1.278` were available during this work (actual
`--version` output, not required commercial model choices). Codex loads AGENTS.md
along the project path at session startup according to its
[official instructions](https://developers.openai.com/codex/guides/agents-md/).
Claude's local adapter uses `@AGENTS.md`, the relative import documented in
[Claude Code memory](https://code.claude.com/docs/en/memory). Start at the repository
root and verify the loaded instruction files when troubleshooting configuration.
These mechanisms were checked against current documentation; no paid Claude run
was needed or claimed for implementation.

For any other Markdown-consuming agent, explicitly provide AGENTS.md, docs/spec.md,
the assigned task row and docs/context-handoff.md before asking it to edit. There is
no universal autodetection claim or unused provider adapter. A fresh process has
everything required to continue in Git and these documents.

## Coordination protocol

1. Record `git status`, branch, target/reference SHAs and local instructions.
2. Assign ID, owner, base SHA, allowed paths, dependencies, contract version,
   acceptance and commands. Use states pendiente/en curso/bloqueada/revisión/hecha.
3. Prefer one feature worktree per writer. In one workspace, use disjoint paths,
   serialize shared edits and leave staging/commits to the orchestrator. Never
   switch its branch while another writer is active.
4. Give the research browser one owner. E2E uses a separate context, temporary
   database/data root and reserved ports. Avoid simultaneous browser-heavy jobs.
5. Agree and commit schema/fixtures before dependent producer/API/UI work. A change
   to a boundary requires a version/fixture update and notification before use.
6. Return concise evidence: commit or integration owner, files, decisions,
   commands/results, limitations and remaining work. The orchestrator integrates
   small commits, reviews diffs and runs boundary tests.
7. A reviewer who did not author a capability checks integration and acceptance.
   Correct findings, rerun affected checks and consolidate the handoff.

This session used real built-in subagents: research/scraper, backend/migration,
QA/review, plus orchestrator/frontend/docs. Audits ran concurrently; producer,
consumer and UI progressed after the `50d54e5` contract checkpoint. No simulated
delegation, external agent services or reference publication permissions were used.
