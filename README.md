# Budget Console

A local-first, privacy-focused personal finance tracker with automatic file-based sync.

## Quick Start (Development)

1. **Install dependencies**: `npm install`
2. **Start development server**: `npm run dev`
3. **Open browser**: Visit `http://localhost:5173`

## Quick Start (Production / Static)

If you just want to use the app without a development environment:
1. Open `index.html` in a modern browser (Chrome/Edge recommended).
2. Bookmark the page.

## Key Features

- **Local Storage**: Data is stored in your browser's **IndexedDB**.
- **Automatic Sync**: Mirrors your data to a local `.json` file via **File System Access API**.
- **Cloud Ready**: Save your budget file in **OneDrive**, **Dropbox**, or **Google Drive** for cross-device sync.
- **Privacy First**: No cloud accounts, no servers, no trackers. Your data never leaves your machine.

## Technical Details

| Component | Technology |
|-----------|------------|
| **Database** | Dexie.js (IndexedDB wrapper) |
| **Sync** | File System Access API (Desktop Chrome/Edge/Opera) |
| **UI** | Modular JavaScript (ES Modules), Vanilla CSS |
| **Build Tool** | Vite |
| **PWA** | Vite PWA Plugin (Offline support, Installable) |

## Data Storage & Backup

- **Primary**: IndexedDB (Browser internal).
- **Secondary (Auto)**: On supported browsers, data mirrors to a selected JSON file automatically.
- **Manual**: Export/Import JSON files via the toolbar.

---
Built for local-first, privacy-first personal finance tracking.
