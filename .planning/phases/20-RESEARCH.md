# Phase 20 Research: Purge or Gitignore Planning Before Going Public

## History Rewriting Options
- **git filter-repo**: The modern, officially recommended tool for rewriting Git history. It is faster and more reliable than `git filter-branch`.
- **git filter-branch**: The legacy Git command. Not recommended but available in standard Git installations.
- **BFG Repo-Cleaner**: An alternative, but requires a Java runtime.

## Tool Availability
- `git filter-repo`: Not currently available in the system PATH.
- `python`: Available (3.12.10).
- `pip`: Available (26.0.1).
- `bfg`: Not available.

**Finding**: `git-filter-repo` can be installed via `pip install git-filter-repo`. Alternatively, a standalone Python script can be used if `pip` is restricted.

## Operation: Deleting `.planning/` from History
The command to remove a directory from all commits in the repository is:
```bash
git filter-repo --path .planning/ --invert-paths
```
**Safety Note**: This command is destructive. A full backup is mandatory.

## Local File Preservation
- `git filter-repo` will remove the folder from the current checkout as well.
- **Strategy**: 
  1. Back up the entire repo (directory-level copy).
  2. Backup the `.planning/` directory separately.
  3. Execute `git filter-repo`.
  4. Restore the `.planning/` directory.
  5. Update `.gitignore` to include `.planning/`.

## Post-Processing
After rewriting history, the local repository will no longer be connected to its remote origin (if any) because the commit hashes will have changed.
**Action**: The user will need to `git push --force` if they want to update a remote repository, or simply use the rewritten local history for the new public repo.

## Backup Verification
- For **PURGE-01**, we should use a command like `Copy-Item -Path . -Destination ..\budget-app-backup -Recurse` or a simple zip command.
