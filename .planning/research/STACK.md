# Technology Stack: File System & Database

**Project:** budget-app
**Researched:** 2024-05-24

## Recommended Stack

### Local File System
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| File System Access API | Modern | File Sync / Export | Native browser API, no server required, supports direct write. |
| idb-keyval | Latest | Handle Storage | Lightweight Promise wrapper for storing FileHandles in IndexedDB. |

### Local Database
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Dexie.js | 4.x | IndexedDB Wrapper | Already in use, robust schema management, observable queries. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| File Handling | File System Access API | Legacy <input type="file"> | Legacy cannot write back to the file without a fresh download. |
| Handle Storage | IndexedDB | LocalStorage | FileSystemHandles are serializable objects, only IndexedDB supports them properly. |

## Installation

```bash
# Optional dependency for cleaner IndexedDB handle storage
npm install idb-keyval
```

## Sources

- [MDN File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
- [web.dev: The File System Access API](https://web.dev/file-system-access/)
