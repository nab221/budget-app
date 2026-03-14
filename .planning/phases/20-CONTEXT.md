# Phase 20 Context: Purge or Gitignore Planning Before Going Public

## Overview
Phase 20 is a critical security and privacy prerequisite for the public deployment of the repository (Phase 19). It involves safely removing all sensitive planning data and historical context from the Git repository history to ensure no personal financial details or internal workflows are exposed when the repository is made public.

## Requirements
- **PURGE-01**: Securely back up the entire local repository before beginning any destructive history-rewriting operations.
- **PURGE-02**: Obliterate the entire `.planning/` directory from the Git commit history.
- **PURGE-03**: Configure Git to ignore the `.planning/` directory moving forward so no new planning files are tracked.
- **PURGE-04**: Keep the `.planning/` directory physically intact on the local filesystem so GSD/Claude workflows continue to function seamlessly.

## Decisions

### Purge Scope
- **Complete Directory Purge**: The entire `.planning/` directory will be removed from Git history. We will not attempt to pick and choose "safe" vs "sensitive" files; a blanket purge is the safest approach to prevent accidental leakage.

### Future Workflow
- **Gitignore Integration**: After the purge, `.planning/` will be added to the project's `.gitignore`. The files will remain locally on disk but will be completely untracked by Git, ensuring local AI agents and planning workflows can still read and write to them without risking public exposure.

### Tooling
- **History Rewriting**: We will use `git filter-repo` (the modern, officially recommended Git tool for history rewriting) to remove the folder from all branches and commits.

### Safety Protocol
- **Mandatory Pre-Flight Backup**: The execution plan must strictly include a step to create a full local backup (e.g., zipping the entire repository folder) before any `git filter-repo` commands are executed. This ensures a safe rollback point if the history rewrite produces unintended consequences.

## Deferred Ideas
- Moving planning files to a separate, private Git repository was discussed but deferred, as a local `.gitignore` approach is simpler and requires no architectural changes to existing tooling.
