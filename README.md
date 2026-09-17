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
4. **Per-user keys**: Any account can add its own Gemini API key from the settings panel. It is stored server-side, encrypted at rest with AES-256-GCM, and is never sent back to the browser — the app only ever reports whether a key exists.
5. **Capacity limits**: an instance holds at most `MAX_USERS` accounts (20 by default), and each non-admin account at most `MAX_RECEIPTS_PER_USER` receipts (20 by default). Registration past the account limit answers 403, as does saving past the receipt limit; editing or deleting existing receipts is unaffected. Admins are exempt from both, so a full instance never locks the owner out. A blank or malformed value falls back to the default rather than lifting the limit.
6. **Admin accounts and everyone else**: `ADMIN_EMAILS` lists the accounts that may spend the shared `GEMINI_API_KEY` from `.env` and use the Plaid integration (connect a bank, import transactions, attach receipts and rent to them). Every other account parses with a personal key, splits and saves receipts, and tracks education expenses by hand — food lines on receipts and rent entries still work, the bank side of Budgeting is hidden and its routes answer 403. Who may hold an account at all is a separate switch: `ALLOWED_LOGIN_EMAILS` (a closed list; admins are always on it) or `ALLOW_PUBLIC_SIGNUP=true` (anyone). A production deployment refuses to start with neither.
7. **Row-level security**: every table has RLS enabled with no policies (migration `20260917120000`). The app connects as the table owner, which bypasses RLS, so nothing changes for it; on Supabase it means the project's REST API and anon key can read nothing, even before you close the API off in the dashboard.

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
- **Landing Page**: Visitors without a session land on a page that explains the app, with **Log in** / **Get started** opening the account dialog. Signed-in users go straight to the workspace. Everything the browser loads lives in `public/`: plain HTML + CSS (`styles.css` holds the design tokens and app components, `landing.css` the landing sections) and `app.js`, the TypeScript under `src/` compiled by `npm run build`.

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
   `DATABASE_URL` is pre-filled to match the bundled Docker Postgres. Put your own address in
   `ADMIN_EMAILS` so your account can use the shared Gemini key and the bank integration; leave
   `ALLOWED_LOGIN_EMAILS` blank locally for open sign-up (see
   [Security First](#-security-first-api-key-protection) for what each switch does).

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

   > **Databases created before September 2026**: one migration was renamed from
   > `20260819230000_add_rent_entry_bank_transaction` to `20260820030100_…` so that it sorts after
   > the migration that creates the table it alters (a fresh database could never get past it).
   > `npm run db:deploy` takes the renamed migration as a no-op. `npm run db:migrate`, though, will
   > see the old name in the database's history and offer a reset; to keep your data, remove that
   > one history row first:
   > ```sql
   > DELETE FROM "_prisma_migrations" WHERE migration_name = '20260819230000_add_rent_entry_bank_transaction';
   > ```

3. Build the frontend bundle and start the server:
   ```bash
   npm run start
   ```
   (`npm run start` runs `build` then launches the server. During development you can run
   `npm run build` and `npm run dev` in separate terminals.)

Open `http://localhost:4173` in your browser.

> The single Node/Express server serves `public/` **and** the `/api` routes. Nothing outside
> `public/` is ever served — source, config and `.env` stay on disk — and the only Gemini
> configuration the browser receives comes from `/api/gemini-config`, never a key.

### Architecture & Scaling

```
Browser (public/app.js)  ──fetch /api──▶  Express (server.mjs)  ──Prisma──▶  Postgres
                                           └─ also serves public/ when self-hosted
```

The database connection is a single `DATABASE_URL`. Locally it points at the Docker Postgres
(`npm run db:up`); to scale, point it at a managed Postgres (Neon, Supabase, RDS, …) and run
`npm run db:deploy` — no code changes required. Schema changes are versioned as Prisma
migrations under `prisma/migrations/`. When `DATABASE_URL` goes through a transaction-mode
pooler, give migrations the direct connection as `DIRECT_DATABASE_URL`.

### Deploying to Vercel

The repository deploys to Vercel as it is: `vercel.json` serves `public/` from the CDN and runs
the Express app as a single serverless function (`api/index.mjs`) behind `/api/*`. You need a
hosted Postgres — the Vercel Postgres (Neon) integration is the least work, but any managed
Postgres does.

1. Import the repository into Vercel. Framework preset **Other**; build and output settings come
   from `vercel.json`.
2. Add the environment variables, for Production and Preview alike:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | the (pooled) connection string of your Postgres |
   | `DIRECT_DATABASE_URL` | the direct / unpooled string, used only by migrations. Not needed with the Vercel Postgres integration, which sets `DATABASE_URL_UNPOOLED` |
   | `ADMIN_EMAILS` | your email address. Admins may use the shared Gemini key and the bank integration. **Required** unless sign-up is opened: the function refuses to serve when no account could sign in |
   | `ALLOWED_LOGIN_EMAILS` | optional: other accounts allowed to sign in (comma-separated). Or set `ALLOW_PUBLIC_SIGNUP=true` to let anyone register as a regular account |
   | `MAX_USERS`, `MAX_RECEIPTS_PER_USER` | optional: both default to 20, and only matter when sign-up is open |
   | `AUTH_SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY` | generated as described above |
   | `GEMINI_API_KEY`, `GEMINI_MODEL` | your Gemini key (or save one in Settings after signing in) and the model |
   | `PLAID_ENV`, `PLAID_CLIENT_ID`, `PLAID_SECRET` | optional, for bank import |

3. Deploy. The build runs `npm run vercel-build`: it generates the Prisma client, applies pending
   migrations with `prisma migrate deploy`, then compiles the frontend. A failed migration fails
   the deploy, so the live site never runs against a schema it does not expect.
4. Open the site and choose **Get started** with an address from `ADMIN_EMAILS` to create your
   account. An address that is not allowed in is told that registration is closed.

What the serverless shape changes:

- **Request size.** Vercel caps a function request at 4.5 MB. The browser shrinks receipt photos
  before upload (2400px JPEG for parsing, 1600px for the stored copy), so ordinary phone photos
  fit with room to spare. A photo the browser cannot decode (HEIC outside Safari) is sent as it
  is and may be refused as too large.
- **Function duration.** `vercel.json` allows 120 seconds per request for the Gemini calls. Hobby
  projects with Fluid compute allow up to 300; if your plan caps it lower, reduce the value.
- **Rate limits are per instance.** The in-memory limiters and login throttle count within one
  function instance, not across all of them. With the account lock on, login is the only
  unauthenticated surface that does anything, and passwords are scrypt-hashed. Vercel's own DDoS
  mitigation sits in front of everything.
- **Health check.** `GET /api/health` answers `{ "ok": true }` when the function can reach the
  database, for uptime monitors.

### Moving an existing database to Supabase

The app runs on any Postgres, and Supabase's free tier is a convenient host for a Vercel
deployment. This moves the data from the local Docker Postgres without losing anything. Two
things decide whether it is lossless:

- **`TOKEN_ENCRYPTION_KEY` must be the same on the new server.** It encrypts saved Gemini keys and
  Plaid bank tokens at rest. With a different key everything else still works, but the app asks
  for the Gemini key again and the bank has to be reconnected.
- **Sign in with the same email afterwards**, and list it in `ADMIN_EMAILS` so the existing account
  keeps its bank access.

1. Create the Supabase project and open **Connect**. You need two strings, both on the pooler host
   (`aws-0-<region>.pooler.supabase.com`, user `postgres.<project-ref>`):
   the **transaction pooler** (port 6543) for `DATABASE_URL`, and the **session pooler** (port
   5432) for `DIRECT_DATABASE_URL`. Skip the direct `db.<ref>.supabase.co` host: it is IPv6-only,
   which neither Vercel functions nor most home connections can reach.
2. Create the schema with the repo's migrations:
   ```bash
   DIRECT_DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require" npm run db:deploy
   ```
3. Copy the rows. Data only, without Prisma's history table (Supabase now has its own, correct
   one), and run both tools inside the Docker container so their versions match:
   ```bash
   docker exec receipt-ring-db pg_dump -U receipt -d receipt_ring --data-only --no-owner --no-privileges --exclude-table=_prisma_migrations > receipt-ring-data.sql

   docker exec -i receipt-ring-db psql "postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require" -v ON_ERROR_STOP=1 --single-transaction < receipt-ring-data.sql
   ```
   The restore is all-or-nothing: if it fails, nothing is written and it can be rerun. The schema
   has no circular foreign keys, so the dump's own table order is correct.
4. Compare counts on both sides:
   ```sql
   SELECT (SELECT count(*) FROM users) users, (SELECT count(*) FROM receipts) receipts,
          (SELECT count(*) FROM receipt_lines) lines, (SELECT count(*) FROM line_assignments) assignments,
          (SELECT count(*) FROM bank_transactions) transactions, (SELECT count(*) FROM rent_entries) rent,
          (SELECT count(*) FROM item_aliases) aliases, (SELECT count(*) FROM account_people) people;
   ```
5. In Supabase, under Project Settings → API → *Exposed schemas*, remove `public`. The app never
   uses Supabase's REST API, and the row-level security migration already blocks it, but there is
   no reason to leave the door in place.
6. On Vercel, set `DATABASE_URL` to the transaction pooler string (add `?sslmode=verify-full`),
   `DIRECT_DATABASE_URL` to the session pooler string (`?sslmode=require`), and the rest of the
   variables from the table above with `TOKEN_ENCRYPTION_KEY` copied from your local `.env`. Or
   install the Supabase integration from the Vercel marketplace, which sets `POSTGRES_URL` and
   `POSTGRES_URL_NON_POOLING` for you; both are picked up automatically. If the function logs show
   a certificate error, change the suffix to `?uselibpqcompat=true&sslmode=require`, which keeps
   the connection encrypted but skips certificate verification, as `psql` does.
7. Deploy, then **Log in** (not Get started) with your existing email and password.

### Useful scripts

| Script | Description |
| --- | --- |
| `npm run db:up` / `npm run db:down` | Start / stop the local Postgres container |
| `npm run db:migrate` | Create & apply a migration (development) |
| `npm run db:deploy` | Apply existing migrations (production) |
| `npm run build` | Generate the Prisma client and compile the TypeScript frontend to `public/app.js` |
| `npm run check` | Typecheck the frontend without emitting |
| `npm test` | Build the test bundle and run the unit tests |
| `npm run dev` | Run the server with `--watch` for reloads |
| `npm run start` | Build the frontend and start the server |
| `npm run vercel-build` | What Vercel runs on deploy: generate the client, `migrate deploy`, compile |

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