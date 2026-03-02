# Local Budget Console — Installation & Usage

## Quick Start (3 steps)

1. **Unzip** this archive anywhere on your machine (Desktop, Documents, etc.)
2. **Open** `budget-app.html` by double-clicking it — it opens in your default browser
3. **Bookmark** the page (Ctrl+D / Cmd+D) for easy access

That's it. No server, no internet, no installation.

## Requirements

- A modern browser: **Chrome 80+**, **Edge 80+**, **Firefox 78+**, or **Safari 15+**
- The first load fetches Dexie.js (~45 KB) from a CDN; after that it is cached.
  If you need 100 % offline, see "Fully Offline Mode" below.

## What the App Does

| Tab | Purpose |
|-----|---------|
| **Dashboard** | Summary cards: income, expenses, net position, net worth, fixed/variable ratios |
| **Income** | Log each salary or other payment |
| **Fixed Spends** | Recurring bills with paid/pending status |
| **Variable** | Day-to-day spending (groceries, eating out, etc.) |
| **Subscriptions** | Monthly & annual subscriptions with renewal dates |
| **Debts** | **Credit-card & loan tracker** — balances, limits, APR, monthly statements, interest, minimum-payment projections, Snowball vs Avalanche payoff strategies |
| **Assets** | House, investments, savings — snapshot values for net-worth tracking |
| **Settings** | Manage spending categories (add/edit/delete); import seed categories |

## Data Storage

- **Primary Storage**: All data is stored locally in your browser's **IndexedDB** database.
- **Secondary Storage**: On supported browsers, data is automatically mirrored to a local JSON file (see **File-Based Sync** below).
- **Persistence**: Data persists across browser restarts, but can be lost if you clear site data.
- **Backups**: Always export backups (JSON) regularly if not using File-Based Sync.

## File-Based Sync (Automatic)

Budget Console supports the **File System Access API** for a seamless, cloud-synced experience:

1. **How it works**: Select or create a JSON file (e.g., `budget-data.json`) on first launch.
2. **Auto-save**: Every change you make is automatically saved to this file (with a 500ms debounce).
3. **Cloud Sync**: By saving the file in your **OneDrive**, **Dropbox**, or **Google Drive** folder, the file is automatically synced across all your devices.
4. **Browser Support**:
   - **Supported**: Desktop Chrome, Edge, and Opera (version 86+).
   - **Unsupported**: Firefox, Safari, and all mobile browsers. These will fall back to manual Export/Import.

## Export / Import / Reset

- **Export**: Downloads a `.json` file with all your data. Use this for manual backups.
- **Import**: Merges a previously exported `.json` file into the current database.
- **Reset**: 
  - **Manual mode**: Permanently deletes all data in the current browser profile.
  - **File-Sync mode**: Disconnects the current file handle (data remains in the browser).

## Fully Offline Mode

The HTML loads Dexie.js from `cdn.jsdelivr.net`. To go fully offline:

1. Download `https://cdn.jsdelivr.net/npm/dexie@4.0.8/dist/dexie.min.js`
2. Save it as `dexie.min.js` in the same folder as `budget-app.html`
3. Open `budget-app.html` in a text editor and change:
   ```html
   <script src="https://cdn.jsdelivr.net/npm/dexie@4.0.8/dist/dexie.min.js"></script>
   ```
   to:
   ```html
   <script src="dexie.min.js"></script>
   ```

## Credit-Card & Debt Tracker — How It Works

### Adding a Debt
Go to the **Debts** tab → fill in name, type (Credit Card / Loan / Mortgage),
credit limit, APR %, and minimum-payment rule (% of balance or fixed amount).

### Monthly Statements
Click **+ Statement** on any debt row to log a monthly snapshot:
- Opening balance, purchases, payments made, interest charged, closing balance.

### Payoff Projections
The **Payoff Planner** panel shows:
- **Minimum-payment projection**: months to clear each debt paying only the minimum.
- **Extra-payment impact**: enter an extra monthly amount and see how much time/interest you save.
- **Snowball vs Avalanche**: side-by-side comparison across all debts.

### UK Minimum Payment Defaults
The default minimum-payment formula is UK-standard:
`max(1% of balance + interest, 2.25% of balance, £5)`.
You can override per card.

## Future Features (Roadmap)

- CSV / Excel import from bank statements
- Recurring transaction templates (auto-populate monthly fixed spends)
- Charts: spending trends, debt-payoff timeline, net-worth over time
- Budget targets per category with progress bars
- Dark / Light theme toggle
- PWA manifest for "install as app" on desktop/mobile
- Multi-currency support (GBP/BRL)
- Encrypted export (password-protected JSON)

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Data disappeared | You may have cleared browser data; restore from an exported JSON backup |
| App won't open | Ensure you're opening the `.html` file directly, not via a cloud sync viewer |
| Dexie error on load | Check internet (CDN) or switch to offline mode (see above) |

---
Built for local-first, privacy-first personal finance tracking.
