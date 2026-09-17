# Receipt Itemizer 🧾✨

Receipt Itemizer is a modern, responsive web application for splitting receipt costs from a photo, line by line. Using the Google Gemini 3.5 Flash Lite API, it extracts line items, assigns costs to different people, and handles tax adjustments automatically.

---

## 🔒 Security First: API Key Protection

To use the advanced AI features of Gemini for parsing receipt items, the application requires a Gemini API Key. To ensure your API key remains safe and is **never** pushed to GitHub:

1. **`.env` is ignored by Git**: The `.gitignore` file is pre-configured to ignore all local environment configuration files (`.env`, `.env.*`).
2. **Use the Template**: A template file named `.env.example` is provided in the repository.
3. **Local Setup**:
   - Copy `.env.example` to a new file named `.env`:
     ```bash
     cp .env.example .env
     ```
   - Open `.env` and insert your Gemini API key:
     ```env
     GEMINI_API_KEY=your_actual_api_key_here
     ```
4. **Per-user keys**: Alternatively, you can add your own Gemini API key from the settings panel. It is stored server-side, encrypted at rest with AES-256-GCM, and is never sent back to the browser — the app only ever reports whether a key exists. Without one, requests fall back to the shared `GEMINI_API_KEY` from `.env`.

---

## 🚀 Key Features

- **AI Receipt Parsing**: Sends the receipt photo to the Gemini 3.5 Flash Lite API to reliably extract items, prices, discounts, and totals.
- **Multiple Assignment Modes**:
  - **Split Evenly**: Distribute the cost of items equally among selected people.
  - **Split by Percentage**: Allocate item shares based on custom percentages.
  - **Split by Custom Amount**: Assign exact cost allocations to individuals.
- **Per-line People Assignment**: Each receipt line has a dropdown of the people you've added — check/uncheck to assign, choose even / percentage / custom-amount split per line.
- **Batch Select**: Tick several lines (or the header checkbox for all of them, shift-click for a run) and a bar appears above the table: one click puts a person on every selected line, clicking their name again takes them off, and the same bar marks the selection as food, ignores it, or identifies just those items. Escape clears the selection.
- **Tax Auto-Calculation**: Input tax and automatically distribute it proportionally based on each person's subtotal.
- **Item Identification**: Receipts print shorthand — `GV SHRD MOZZ 8Z` — which is unreadable weeks later. Hit **Identify items** and every line gets its real product name, with a confidence score. Click any item to see what the receipt printed, its item code, brand, size, where the answer came from and why; correct it, or pick one of the alternatives. Corrections are remembered, so the same item on your next receipt from that shop is named for free.
- **Smart Categorization**: Categorize receipt items (Dining, Groceries, Travel, etc.) and save defaults for specific items. Receipt category defaults to **Groceries**.
- **Saved History (Postgres)**: Save a split to a Postgres database and review previous receipts, items, prices, and per-person splits under the **History** tab. Marked something wrong? **Edit in Split** reopens a saved receipt in the Split tab with its assignments, food flags, and item names, and **Save changes** updates it in place — it keeps its photo, its budget month, and any linked bank transaction.
- **Bank Connection (Plaid)**: Securely link a bank through [Plaid Link](https://plaid.com/docs/link/) to import **read-only** transactions. Access tokens are exchanged server-side and stored AES-256-GCM encrypted at rest — they never reach the browser.
- **Budgeting**: The **Budgeting** tab aggregates saved receipts and imported bank transactions into monthly spend by category, visualized as a spending ring.
- **Device Camera Support**: Snap receipt photos directly from your phone's or laptop's camera.
- **Landing Page**: Visitors without a session land on a page that explains the app, with **Log in** / **Get started** opening the account dialog. Signed-in users go straight to the workspace. The frontend is plain HTML + CSS (`styles.css` holds the design tokens and app components, `landing.css` the landing sections) and TypeScript compiled to `dist/app.js`.

---

## 🔍 How item identification works

Receipt shorthand is ambiguous, so identification runs in tiers — cheapest
first, and each tier only ever sees what the one before it could not place:

| Tier | What it is | Cost | Confidence |
| --- | --- | --- | --- |
| 1 | **Names you confirmed before**, looked up by item code or label, scoped to the store | free, instant | 100% |
| 2 | **Local abbreviation dictionary** — `GV`→Great Value, `MLK`→Milk, `8Z`→8 oz | free, instant | up to 90% |
| 3 | **Gemini**, one batched request for the whole receipt | one API call | self-reported, clamped |
| 4 | **Unresolved** — the app says it doesn't know rather than guessing | — | — |

A few consequences worth knowing:

- **Corrections compound.** Confirming a name saves it against the item's
  code (or its label) for that store. Your second Costco receipt is mostly
  named before Gemini is called at all.
- **The item code is used when the receipt prints one.** `007874203922` names
  a product unambiguously in a way `GV SHRD MOZZ 8Z` never can, so the parser
  keeps it and the lookup prefers it.
- **A confidence chip only appears when it should change what you do.** Nothing
  is shown on a name you confirmed, or on one the app is confident about.
- **Nothing is invented.** A line the tiers cannot place is reported as
  unidentified, keeping any low-confidence guess as an alternative rather than
  presenting it as the answer.
- **It costs money per receipt**, so the identify endpoint is rate limited
  separately from the rest of the API, and the free tiers run first
  specifically to shrink what reaches the model.

Identifications are saved with the receipt, so reopening it from **History**
shows the names without paying for them again.

---

## 🛠️ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [Docker](https://www.docker.com/) (for the local Postgres database)

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/Rahil-Shah/Receipt-Itemizer.git
   cd Receipt-Itemizer
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

3. Set up your environment variables:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and replace `your_gemini_api_key_here` with your real Gemini API key. The
   `DATABASE_URL` is pre-filled to match the bundled Docker Postgres.

   Then generate the two secrets the server refuses to start without —
   `AUTH_SESSION_SECRET` and `TOKEN_ENCRYPTION_KEY`. The placeholders in
   `.env.example` are not valid keys:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   Run it once for each and paste the results in. Keep `TOKEN_ENCRYPTION_KEY` stable —
   rotating it makes already-stored bank tokens undecryptable.

   To enable the optional **bank connection**, add your [Plaid](https://dashboard.plaid.com/)
   credentials — `PLAID_CLIENT_ID` and `PLAID_SECRET`. `PLAID_ENV` defaults to `sandbox`
   (fake data); switch to `production` with the matching secret to link real banks — no
   code change required. Leave these blank to run without bank import.

### Running the App Locally

1. Start the Postgres database (Docker):
   ```bash
   npm run db:up
   ```

2. Apply the database schema (first run only, or after schema changes):
   ```bash
   npm run db:migrate
   ```

3. Build the frontend bundle and start the server:
   ```bash
   npm run start
   ```
   (`npm run start` runs `build` then launches the server. During development you can run
   `npm run build` and `npm run dev` in separate terminals.)

Open `http://localhost:4173` in your browser.

> The single Node/Express server serves the frontend **and** the `/api` routes. It never
> exposes `.env` or source files over HTTP — the Gemini config is served via `/api/gemini-config`.

### Database Management with pgweb

To visually manage the Postgres database, pgweb provides a web-based PostgreSQL client:

1. **Start pgweb** (runs in a separate Docker container):
   ```bash
   npm run pgweb:up
   ```

2. **Access pgweb** at `http://localhost:5050` in your browser.

3. **Log in** with the following credentials:
   - **Host**: `localhost`
   - **Port**: `5433`
   - **User**: `receipt`
   - **Password**: `receipt`
   - **Database**: `receipt_ring`

4. Once logged in, you can:
   - Browse tables and schemas
   - Run SQL queries
   - View and edit data directly
   - Inspect the database structure

5. To stop pgweb:
   ```bash
   npm run pgweb:down
   ```

> **Note**: pgweb runs independently of the main app and the Postgres container will continue running — it's just a GUI tool for database inspection and management.

### Architecture & Scaling

```
Browser (dist/app.js)  ──fetch /api──▶  Express (server.mjs)  ──Prisma──▶  Postgres
                                         └─ also serves the static frontend
```

The database connection is a single `DATABASE_URL`. Locally it points at the Docker Postgres
(`npm run db:up`); to scale, point it at a managed Postgres (Neon, Supabase, RDS, …) and run
`npm run db:deploy` — no code changes required. Schema changes are versioned as Prisma
migrations under `prisma/migrations/`.

### Useful scripts

| Script | Description |
| --- | --- |
| `npm run db:up` / `npm run db:down` | Start / stop the local Postgres container |
| `npm run db:migrate` | Create & apply a migration (development) |
| `npm run db:deploy` | Apply existing migrations (production) |
| `npm run build` | Compile the TypeScript frontend to `dist/app.js` |
| `npm run dev` | Run the server with `--watch` for reloads |
| `npm run start` | Build the frontend and start the server |

---

## ⚙️ How It Works

1. **Upload or Capture**: Upload a receipt image file or use the built-in camera function to capture one.
2. **Parse**: The image is sent to the Gemini API, which returns the structured line items, discounts, and totals.
3. **Itemize**: You can also paste raw receipt text and click **Itemize receipt** to detect lines locally.
4. **Add People**: Enter names of individuals to add them to the splitting roster.
5. **Identify** (optional): Click **Identify items** to turn abbreviated line
   items into real product names. Click any item to check, correct, or rename
   it — corrections are remembered for next time. With lines selected, the
   batch bar's **Identify** does just those.
6. **Assign**: Open a line's dropdown to assign it, or tick several lines and click a name in the batch bar to assign them all at once.
7. **Settle Up**: Review individual totals under the **Split** panel including taxes.