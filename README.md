# Receipt Itemizer 🧾✨

Receipt Itemizer is a modern, responsive web application for splitting receipt costs from a photo, line by line. Using the Gemini API, it extracts line items, assigns costs to different people, and handles tax adjustments automatically.

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
4. **Browser Local Storage**: Alternatively, you can configure your API key directly in the application's UI settings panel, which saves it securely in your browser's local storage.

---

## 🚀 Key Features

- **AI Receipt Parsing**: Sends the receipt photo to the Gemini API to reliably extract items, prices, discounts, and totals.
- **Multiple Assignment Modes**:
  - **Split Evenly**: Distribute the cost of items equally among selected people.
  - **Split by Percentage**: Allocate item shares based on custom percentages.
  - **Split by Custom Amount**: Assign exact cost allocations to individuals.
- **Per-line People Assignment**: Each receipt line has a dropdown of the people you've added — check/uncheck to assign, choose even / percentage / custom-amount split per line.
- **Tax Auto-Calculation**: Input tax and automatically distribute it proportionally based on each person's subtotal.
- **Smart Categorization**: Categorize receipt items (Dining, Groceries, Travel, etc.) and save defaults for specific items. Receipt category defaults to **Groceries**.
- **Saved History (Postgres)**: Save a split to a Postgres database and review previous receipts, items, prices, and per-person splits under the **History** tab.
- **Budgeting (coming soon)**: A dedicated tab reserved for upcoming monthly budgets and spending trends.
- **Device Camera Support**: Snap receipt photos directly from your phone's or laptop's camera.

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
5. **Assign**: Select line items, choose an assignment mode, select the people, and click **Assign**.
6. **Settle Up**: Review individual totals under the **Split** panel including taxes.