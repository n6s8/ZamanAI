
---

# 💳 ZamanAI — Financial Assistant

**ZamanAI** is an intelligent financial assistant that helps users analyze their expenses, discover saving habits, and make better financial decisions.
It works both **offline (rule-based)** and **online (AI-enhanced)** via GPT-style models.

---

## 🧠 Overview

ZamanAI provides tools for understanding spending patterns, identifying overspending areas, and suggesting practical ways to save.
It can parse **Kaspi Bank PDF/CSV statements**, visualize data, and give recommendations based on Islamic finance principles.

---

## ⚙️ Technical Stack

### Frontend

* **React + TypeScript** — core UI framework
* **Vite** — lightning-fast bundler and dev server
* **Hooks (useState, useMemo, useEffect)** — state and computation logic
* **Local categorization** — regex and keyword-based expense grouping
* **Chart.js / SVG Pie** — visual analytics
* **Offline-first design** — no dependency on external APIs

### Backend

* **Node.js + Express** — REST API
* **pdf-parse** — extract text from PDF statements
* **multer** — handle file uploads
* **dotenv** — manage environment variables
* **CORS + Fetch** — secure frontend-backend communication
* **Optional AI endpoints**:

  * `/api/chat` — financial assistant (GPT)
  * `/api/stt` — speech-to-text (Whisper)
  * `/api/tts` — text-to-speech
  * `/api/spend/pdf` — Kaspi statement parser

---

## 💡 Key Features

* **Upload Kaspi statements (PDF/CSV)**
  Extracts transactions, categorizes automatically, and displays totals.

* **Expense Analysis**
  Visualize where money goes using pie charts and summary tables.

* **Habits & Savings Advice**
  Generates actionable recommendations like “reduce cafe spending” or “opt for home cooking.”

* **Profile Memory**
  Save user data — name, city, income, goals — and compare with similar users.

* **Offline Mode**
  Works fully offline via local heuristic classification; optional AI mode adds smart context and insights.

---

## 🚀 Local Setup

### 1. Clone repository

```bash
git clone https://github.com/n6s8/ZamanAI.git
cd ZamanAI
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment setup

Create `.env`:

```bash
PORT=5210
HUB_BASE_URL=https://api.openai.com/v1
HUB_API_KEY=sk-your-key-here
VITE_API_URL=http://localhost:5210
```

### 4. Run servers

```bash
# Backend
npm run dev:server

# Frontend
npm run dev
```

Then open [http://localhost:5179](http://localhost:5179)

---

## 🧩 Modes

| Mode        | Description                        | Requires Key |
| ----------- | ---------------------------------- | ------------ |
| **Offline** | Local parsing & analysis only      | ❌            |
| **AI Mode** | GPT-based insights via `/api/chat` | ✅            |

---

## 📈 Future Plans

* Machine learning-based categorization (Naïve Bayes / embeddings)
* Integration with multiple banks
* Monthly spending reports and trend detection
* Personal goal tracking

---
