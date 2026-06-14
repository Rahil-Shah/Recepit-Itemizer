# Receipt Ring 🧾✨

Receipt Ring is a modern, responsive web application for splitting receipt costs from a photo, line by line. Using Tesseract OCR and the Gemini API, it extracts line items, assigns costs to different people, and handles tax adjustments automatically.

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

- **Consensus OCR & AI Parsing**: Combines local Tesseract OCR with the Gemini API to reliably extract items, quantities, and prices.
- **Multiple Assignment Modes**:
  - **Split Evenly**: Distribute the cost of items equally among selected people.
  - **Split by Percentage**: Allocate item shares based on custom percentages.
  - **Split by Custom Amount**: Assign exact cost allocations to individuals.
- **Tax Auto-Calculation**: Input tax and automatically distribute it proportionally based on each person's subtotal.
- **Diagnostics Panel**: See real-time OCR status and debug parser results.
- **Smart Categorization**: Categorize receipt items (Dining, Groceries, Travel, etc.) and save defaults for specific items.
- **Device Camera Support**: Snap receipt photos directly from your phone's or laptop's camera.

---

## 🛠️ Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed.

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
   Open `.env` and replace `your_gemini_api_key_here` with your real Gemini API key.

### Running the App Locally

Start the development server:
```bash
npm run dev
```

Open `http://localhost:4173` (or the port specified by your dev server) in your browser.

---

## ⚙️ How It Works

1. **Upload or Capture**: Upload a receipt image file or use the built-in camera function to capture one.
2. **Detect & Read**: Tesseract reads the image layout and overlays detected text boxes.
3. **Itemize**: Click **Itemize receipt**. The Gemini API parses the text into individual line items.
4. **Add People**: Enter names of individuals to add them to the splitting roster.
5. **Assign**: Select line items, choose an assignment mode, select the people, and click **Assign**.
6. **Settle Up**: Review individual totals under the **Split** panel including taxes.