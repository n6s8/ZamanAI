Here’s a full **README.md** describing your project based on `chat.ts` and `SpendAnalyzer.tsx`:

---

# 💳 Zaman Financial Assistant

An interactive **personal finance web application** designed to analyze Kaspi (and similar) PDF statements, visualize spending behavior, and provide actionable financial insights based on Islamic banking principles.
Built for **offline-first analysis**, with optional **AI augmentation** through a backend integration.

---

## 🧠 Overview

**Zaman Financial Assistant** allows users to:

* Upload **Kaspi PDF or CSV statements**
* Parse and categorize expenses locally (no network required)
* View **spending analytics** using tables and **interactive pie charts**
* Receive **habit recommendations** to improve savings
* Optionally chat with an **AI financial assistant** about income, goals, and budgeting
* Save and export user profiles and session memory

---

## ⚙️ Technical Stack

### 🖥️ Frontend

* **React + TypeScript** — UI and data management
* **Hooks (useState, useMemo, useEffect)** — stateful logic
* **SVG-based charts** — lightweight pie visualization
* **Local heuristics** — rule-based categorization of spendings
* **Client-only analysis** — no backend required for offline mode

### 🌐 Backend (`chat.ts`)

* **Node.js + Express**
* **Multer** — handles PDF file uploads
* **pdf-parse** — extracts text data from Kaspi PDF statements
* **dotenv** — manages environment variables
* **CORS** — allows frontend/backend communication
* **Fetch API + AbortController** — for AI chat and audio endpoints
* Optional integration with:

    * **OpenAI / LiteLLM API** (`HUB_BASE_URL` & `HUB_API_KEY`)
    * Endpoints:

        * `/api/chat` — text-based assistant (GPT-like)
        * `/api/stt` — speech-to-text via Whisper
        * `/api/tts` — text-to-speech output
        * `/api/spend/pdf` — parse PDF transactions

---

## 🧩 Features

### 📂 PDF Parsing

* Reads **Kaspi Bank PDF statements**
* Extracts:

    * Date
    * Amount (+/−)
    * Transaction kind (Purchases, Transfers, etc.)
    * Description
* Automatically detects **currency symbol (₸)**

### 📊 Spend Analyzer

* Displays **categorical spending distribution** in a **pie chart**
* Tabular breakdown of all transactions
* Smart sorting by category, amount, or date
* **Offline heuristic categorization**:

    * *Supermarkets → Food & Groceries*
    * *Bolt / Yandex → Transport*
    * *Cafes → Dining*
    * *Utilities → Bills*

### 💡 Habits Section

* Dynamically generated **recommendations** based on spend ratios
  Example:

    * “You spent 25% on dining — try preparing meals at home.”
    * “Transportation exceeds 20% — consider public transit.”

### 🧭 Profile Panel

* Editable profile with:

    * Name
    * City
    * Age
    * Monthly income
    * Personal goals
* Session memory with export (`.txt`)
* Benchmark comparison (“Users like you spend 40% on essentials”)

---

## 🛠️ Installation & Local Setup

### 1. Clone repository

```bash
git clone https://github.com/your-username/zaman-finance
cd zaman-finance
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set environment variables

Create `.env` in root:

```bash
HUB_BASE_URL=https://api.openai.com/v1
HUB_API_KEY=sk-your-key-here
PORT=3001
```

### 4. Run backend

```bash
npm run server
```

### 5. Run frontend (React)

```bash
npm run dev
```

---

## 🔐 Offline Mode vs AI Mode

| Mode        | Source of Insight               | Requires API Key |
| ----------- | ------------------------------- | ---------------- |
| **Offline** | Local regex + heuristics        | ❌                |
| **AI Mode** | `/api/spend/ai` and `/api/chat` | ✅                |

---

## 🧩 Future Enhancements

* AI-driven categorization using Naïve Bayes or BERT embeddings
* Multi-bank PDF compatibility
* Personal goal progress tracker
* Monthly report exports

---

## 🧾 License

MIT — free for personal and academic use.

---

Would you like me to include a short **architecture diagram (text-based)** showing data flow (PDF → Parser → Analyzer → Habits → Profile)?
