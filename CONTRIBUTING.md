# Contributing

Read AGENTS.md and start a feature branch from the recorded base. Preserve unrelated
working changes; record them before editing. Claim a ticket and file ownership in
docs/tasks.md. Use a separate worktree per writer, or strictly disjoint files in a
single workspace. Root contracts, lockfiles and status documents have one owner.

Behavior changes at migration/import/media boundaries start with a failing test.
Keep commits focused on one capability. Schema changes update Python/TypeScript
validation, generated types and canonical fixtures in the same review. Run the
README checks, including offline browser tests, then request independent review.

Describe the concrete behavior change, executed tests and remaining risks. Do not
commit live captures, databases, downloaded game assets or credentials. No live
scraping runs in CI. See THIRD_PARTY_NOTICES.md before copying reference code.
