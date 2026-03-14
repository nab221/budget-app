# Phase 20 Plan: Purge or Gitignore Planning Before Going Public

## Objective
Safely remove the `.planning/` directory from the Git history while keeping it locally available for continued development.

## Prerequisites
- **Tooling**: `python` and `pip` must be available (verified).
- **Environment**: PowerShell (verified).

## Implementation Steps

### STEP 1: Full Repository Backup (PURGE-01)
Perform a full, recursive copy of the repository to a safe location before any history rewriting.
```powershell
# In the parent directory (C:\Users\nab221\CODE\)
$backupPath = "C:\Users\nab221\CODE\budget-app-PRE-PURGE-BACKUP"
Copy-Item -Path "C:\Users\nab221\CODE\budget-app" -Destination $backupPath -Recurse -Force
```

### STEP 2: Temporary `.planning/` Preservation
Copy the `.planning/` directory to a temporary location outside the repository to ensure it can be restored.
```powershell
$tempPlanning = "C:\Users\nab221\.gemini\tmp\planning-backup"
if (Test-Path $tempPlanning) { Remove-Item -Path $tempPlanning -Recurse -Force }
Copy-Item -Path "C:\Users\nab221\CODE\budget-app\.planning" -Destination $tempPlanning -Recurse -Force
```

### STEP 3: Install `git-filter-repo`
Install the necessary tool via `pip`.
```powershell
pip install git-filter-repo
```

### STEP 4: Rewrite Git History (PURGE-02)
Use `git-filter-repo` to remove `.planning/` from all commits and branches.
```powershell
# Navigate to the repository root
cd "C:\Users\nab221\CODE\budget-app"
# Execute the purge
git filter-repo --path .planning/ --invert-paths --force
```

### STEP 5: Restore `.planning/` Directory (PURGE-04)
Move the preserved `.planning/` directory back into the repository.
```powershell
# Ensure we're in the right place
Move-Item -Path $tempPlanning -Destination "C:\Users\nab221\CODE\budget-app\.planning" -Force
```

### STEP 6: Configure `.gitignore` (PURGE-03)
Add `.planning/` to the `.gitignore` file to prevent it from being tracked in the future.
```powershell
Add-Content -Path ".gitignore" -Value "`n# GSD Planning Data`n.planning/"
git add .gitignore
git commit -m "chore: ignore .planning directory for public release"
```

## Verification Loop

### VERIFY-01: History Purge
Run `git log --all -- .planning/` to ensure no history remains for the folder.
- **PASS**: The command returns no results.
- **FAIL**: History for the folder is still present.

### VERIFY-02: Local Persistence
Verify the `.planning/` directory and its subdirectories still exist on the filesystem.
- **PASS**: `Test-Path .planning/` returns true.
- **FAIL**: Folder is missing.

### VERIFY-03: Ignored Status
Verify that `.planning/` is correctly ignored by Git.
- **PASS**: `git check-ignore -v .planning/` returns the expected ignore rule.
- **FAIL**: Not ignored.

## Rollback Plan
If any step fails or results in data loss:
1. Delete the corrupted repository: `Remove-Item -Path "C:\Users\nab221\CODE\budget-app" -Recurse -Force`
2. Restore from backup: `Copy-Item -Path "C:\Users\nab221\CODE\budget-app-PRE-PURGE-BACKUP" -Destination "C:\Users\nab221\CODE\budget-app" -Recurse -Force`
