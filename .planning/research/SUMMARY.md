# Research Summary: File System Access API & Database Mutations

**Domain:** Browser File System API and Budget App Data Layer
**Researched:** 2024-05-24 (Simulated)
**Overall confidence:** HIGH

## Executive Summary

The research focused on two main areas: best practices for the File System Access API (specifically handle persistence and cloud sync compatibility) and a comprehensive audit of database mutation points in the `budget-app` project.

The File System Access API provides a powerful way to interact with local files, but requires careful handle management in IndexedDB and proactive error handling for cloud-synced folders (OneDrive/Dropbox). Persisting handles is straightforward as they are serializable, but permission management remains a session-based or PWA-specific hurdle.

The `budget-app` database audit revealed a dual-layer mutation pattern: a modern repository-based layer in `src/db/repository.js` and a legacy inline Dexie layer in `budget-app.html`. Future refactoring should consolidate these into the repository layer to ensure consistent trigger logic (like balance recalculations).

## Key Findings

**Stack:** Browser File System Access API + Dexie.js (IndexedDB).
**Architecture:** Repository pattern used in `src/db/` but inconsistent usage in `budget-app.html`.
**Critical pitfall:** Cloud sync providers (OneDrive/Dropbox) frequently lock files or use "online-only" placeholders, causing `NoModificationAllowedError` or `NotFoundError` if not handled.

## Implications for Roadmap

Based on research, suggested phase structure for File Sync/System Access integration:

1. **Handle Persistence Layer** - Implement IndexedDB storage for file handles using `idb-keyval` or similar.
   - Addresses: User session persistence.
   - Avoids: Needing to pick the file on every reload.

2. **Permission Lifecycle UI** - Create a "Re-connect" or "Authorize" UI flow to handle the `queryPermission` and `requestPermission` lifecycle.
   - Addresses: Browser security constraints.

3. **Cloud-Sync Resilience** - Implement retry logic with exponential backoff and "Offline-only" detection/warnings for OneDrive/Dropbox users.
   - Avoids: Crashing or failing silently during sync locks.

**Phase ordering rationale:**
- Persistence and basic UI must come before advanced error handling to provide a baseline functional experience.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | API is well-documented; Dexie usage is standard. |
| Features | MEDIUM | Cloud sync behavior varies slightly by provider/OS. |
| Architecture | HIGH | Codebase audit was comprehensive. |
| Pitfalls | HIGH | Common errors (Locks, Placeholders) are well-known in community. |

## Gaps to Address

- **PWA Specifics:** Deep-dive into Chrome's persistent permissions for installed PWAs (Chrome 122+) to see if `requestPermission` can be bypassed entirely after initial setup.
- **Atomic Writes:** Further testing on how `createWritable` swap files interact with OneDrive versioning.
