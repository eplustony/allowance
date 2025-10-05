# 💰 Kids Allowance

A simple, mobile-friendly web app to track weekly allowances and purchases for multiple children.  
Built with **FastAPI + SQLite** (backend) and **React + Vite + Nginx** (frontend), all containerized with **Docker Compose**.

---

## 🚀 Features

✅ **Per-child tracking**  
- Name, weekly allowance, and optional starting balance  
- Balances updated automatically

✅ **Weekly Allowance Automation**  
- Each Sunday, an allowance is deposited  
- Manual “🔄 Sync Allowance” button to catch up missed weeks  

✅ **Purchases**  
- “Make Purchase” prompts for amount and optional note  
- Deducts instantly from child’s balance  

✅ **Admin Mode (⚙️)**  
- Toggle on/off from the header  
- When enabled, shows “Add Child” form  
- Hidden in normal view (kid-friendly UI)

✅ **PWA / Mobile Friendly**  
- Looks great on iPhone / iPad  
- Tap “Share → Add to Home Screen” to use like an app  

✅ **Containerized**  
- FastAPI served on port `8000`  
- Nginx frontend on port `3000`  
- SQLite persistent storage via Docker volume  

---

## 🧱 Tech Stack

| Layer | Technology |
|-------|-------------|
| Frontend | React + Vite + Nginx |
| Backend | FastAPI (Python 3.11) |
| Database | SQLite (via SQLModel) |
| Orchestration | Docker Compose |
| Styling | Inline / minimal CSS (mobile-first) |

---

## 🏗️ Project Structure

allowance/
├── docker-compose.yml
├── .gitignore
├── README.md
├── backend/
│ ├── Dockerfile
│ ├── requirements.txt
│ └── main.py
└── frontend/
├── Dockerfile
├── default.conf
├── package.json
├── vite.config.js
├── index.html
├── manifest.webmanifest
└── src/
└── main.jsx

---

## ⚙️ Setup & Run

### 1️⃣ Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)  
- [Git](https://git-scm.com/) *(optional but recommended)*

### 2️⃣ Build & Run

# Clone (or unzip)
cd allowance

# Build containers
docker compose build

# Start app
docker compose up

Frontend: http://localhost:3000
Backend: http://localhost:8000/api/health

### 3️⃣ First-Time Setup
Visit http://localhost:3000
Tap ⚙️ to enter Admin Mode
Add each child with:
    Name
    Weekly allowance (USD)
    Optional starting balance
Tap “Add” ✅

### 4️⃣ Using the App
Balances update automatically every Sunday
Tap 🔄 in the header to manually apply missed weeks
Tap Make Purchase → enter amount + optional note → Confirm
Balances are stored persistently in the container volume

### 5️⃣ Add to Home Screen (iPhone / iPad)
Open Safari → visit http://localhost:3000
Tap Share → Add to Home Screen
Launch from your Home Screen — it runs fullscreen like a native app