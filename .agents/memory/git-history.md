---
name: Git history
description: Project-specific Git history behavior and the safe way to inspect missing commits.
---

The local repository can be initialized as a shallow clone, which makes `git log` appear truncated even when the latest commit is already synchronized with `origin/main`.

**Why:** A shallow boundary can look like a failed or missing commit during history checks.

**How to apply:** Compare `HEAD` with `origin/main` first; if the repository has a shallow boundary, fetch the full history before investigating commit loss.