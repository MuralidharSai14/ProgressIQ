# 🚀 PROGRESSIQ — Universal 24/7 Cloud Production Deployment & Multi-User Guide

This guide details how to deploy **PROGRESSIQ** as a real-time, multi-user, cloud-connected progress intelligence platform that runs **24/7 in the cloud with your laptop turned off**, accessible from **any smartphone, tablet, or laptop on any Wi-Fi or cellular network (4G/5G)** — with **100% free-tier services**.

---

## 🏛 24/7 Universal Cloud Architecture

```text
                     🌐 PUBLIC CLOUD (Runs 24/7, Laptop Off)
        ┌─────────────────────────────────────────────────────────────┐
        │                         PROGRESSIQ                          │
        │                                                             │
        │  Frontend Web UI (Vercel / Render / Netlify HTTPS)          │
        │  FastAPI Async Backend API (Render / Railway / Fly.io)      │
        │  Managed PostgreSQL DB (Supabase / Neon / Render)           │
        │  Unified Object Storage (Supabase Storage / S3 / Disk)      │
        │  AI Extraction & Consistency Engine (Gemini / Offline Mock) │
        │  JWT Multi-User Authentication & Role-Based Access Control  │
        │  Server-Sent Events (SSE) Live Sync Event Stream            │
        └──────────────────────────────┬──────────────────────────────┘
                                       │
      ┌────────────────────────────────┼────────────────────────────────┐
      ↓                                ↓                                ↓
📱 Smartphone (Site Engineer)    💻 Laptop (Project Manager)      📱 Smartphone (Auditor/Exec)
- Connected on 4G / 5G Mobile    - Connected on Home/Office Wi-Fi  - Connected on Remote Wi-Fi
- "+ Live Field Update"          - Real-Time Live Dashboards      - Audit trails & Analytics
- Camera photo site proof        - WBS Planned vs Actual metrics  - Safety & Logistics review
- Low-network draft storage      - Decision & Verification Queue  - Read-only KPI inspection
```

---

## 🌍 Generalized For Any Industry & Any User

PROGRESSIQ is a universal project progress platform supporting any domain:

| Domain / Industry | Supported Workflows & Sample Templates |
| :--- | :--- |
| 🏗️ **Building & Civil Construction** | Raft foundations, structural steel columns, shear walls, curtain wall facade, MEP services, interior fitout. |
| 💻 **Software & IT Engineering** | API specs, OAuth2 RBAC, microservices, React UI, AI vector search, CI/CD pipelines, SOC2 & security audits. |
| ⚡ **Renewable Energy & Power** | 200-acre land grading, 110,000 bifacial PV modules, inverter stations, 33kV grid switchyard, SCADA telemetry. |
| 🛢️ **Infrastructure & Utilities** | Pumping stations, intake chambers, pipeline trenching, thrust blocks, HT transmission lines. |
| 📋 **Custom Schedules & Projects** | Upload any `.xlsx`, `.xls`, `.csv`, `.json` schedule with custom WBS hierarchy and auto-diagnostics. |

---

## 🆓 100% Free Cloud Stack (Zero Cost Forever)

You do **not** need a credit card or paid servers to deploy and run PROGRESSIQ 24/7:

| Layer | Free Cloud Provider | Free Tier Specification |
| :--- | :--- | :--- |
| **Backend API** | [Render](https://render.com) / [Railway](https://railway.app) / [Fly.io](https://fly.io) | Free Python web service running 24/7 |
| **Database** | [Supabase](https://supabase.com) or [Neon](https://neon.tech) | 500MB Managed PostgreSQL with asyncpg |
| **Object Storage** | [Supabase Storage](https://supabase.com) or Local Static | 1GB free storage for site photos & documents |
| **Frontend UI** | [Vercel](https://vercel.com) or [Render Static](https://render.com) | Global CDN, custom domains, free HTTPS |
| **AI Extraction** | [Google AI Studio](https://aistudio.google.com) | Free Gemini 1.5 Flash (15 RPM / 1M tokens/day) |

> 💡 **Zero Keys Required Mode**: If you deploy without a `GEMINI_API_KEY`, PROGRESSIQ automatically falls back to its built-in offline AI engine with 0 external API dependencies.

---

## 🔑 Pre-Configured Multi-User Test Accounts

PROGRESSIQ automatically creates 4 test accounts on startup with 1-click quick sign-in:

| Role | Email | Password | Primary Capabilities |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@progressiq.ai` | `admin123` | Full administrative control, system settings, user management, project lifecycle. |
| **Project Manager** | `pm@progressiq.ai` | `pm123` | Executive KPI dashboard, schedule baselines, verification queue, risk approvals. |
| **Site Engineer** | `engineer@progressiq.ai` | `engineer123` | Mobile-optimized `+ Live Field Update`, camera capture, daily DPRs, material & safety logs. |
| **Viewer / Auditor** | `viewer@progressiq.ai` | `viewer123` | Read-only analytics, audit trails, and compliance reports. |

---

## ⚡ 5-Minute 1-Click Cloud Deployment Walkthrough

### Step 1: Provision Free PostgreSQL Database (Supabase)
1. Go to [supabase.com](https://supabase.com) and create a free project.
2. In **Project Settings** → **Database** → **Connection String**, copy the `URI`.
3. Change the protocol prefix from `postgresql://` to `postgresql+asyncpg://`.
   * Example: `postgresql+asyncpg://postgres:YourPassword@db.abcdefghijk.supabase.co:5432/postgres`
4. *(Optional)* Under **Storage**, create a public bucket named `progressiq-uploads`. Under **API Settings**, copy the `Project URL` and `anon public key`.

### Step 2: Deploy Backend API (Render)
1. Push your repository to GitHub / GitLab.
2. In [Render Dashboard](https://dashboard.render.com), click **New +** → **Blueprint** and select your repository (it will automatically read [`render.yaml`](file:///c:/Users/mural/OneDrive/Desktop/PROGRESSIQ/render.yaml)) OR create a **Web Service**:
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python -m uvicorn main:app --host 0.0.0.0 --port $PORT`
3. In **Environment Variables**, add:
   ```ini
   DATABASE_URL=postgresql+asyncpg://postgres:YourPassword@db.xxx.supabase.co:5432/postgres
   JWT_SECRET=generate_a_random_32_character_secret_key
   STORAGE_PROVIDER=local
   AI_PROVIDER=gemini
   GEMINI_API_KEY=your_free_gemini_api_key_or_leave_blank
   CORS_ORIGINS=*
   ```
4. Click **Deploy Web Service**. Copy your backend public URL (e.g. `https://progressiq-api.onrender.com`).

### Step 3: Deploy Frontend (Vercel)
1. In [Vercel Dashboard](https://vercel.com), click **Add New** → **Project** and import your repository.
2. Configure settings:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. In **Environment Variables**, set:
   ```ini
   VITE_API_URL=https://progressiq-api.onrender.com
   ```
4. Click **Deploy**. Your PROGRESSIQ application is now live on a public HTTPS URL (e.g. `https://progressiq.vercel.app`)!

---

## 📱 Multi-Device & Remote Usage Guide (Any Wi-Fi / 4G / Laptop Off)

### 1. Accessing from Anywhere
- Because the backend and database are deployed in the cloud, **your laptop can be closed or powered off**.
- Open the public URL (`https://progressiq.vercel.app`) on your smartphone browser (Safari, Chrome) or any remote computer.

### 2. Live Field Engineer Submission (on Mobile Phone)
1. On your phone (connected to mobile 4G/5G data or site Wi-Fi), open the URL.
2. Sign in as **Site Engineer** (`engineer@progressiq.ai` / `engineer123`).
3. Tap **"+ Live Field Update"**.
4. Snap a photo with your phone camera as verifiable proof.
5. Set progress percentage and add notes.
6. Tap **"Submit Live Field Update"**.

### 3. Live Project Manager Monitoring (on Laptop)
1. On your laptop (connected to home or office Wi-Fi), sign in as **Project Manager** (`pm@progressiq.ai` / `pm123`).
2. The dashboard receives the update **in real-time via Server-Sent Events (SSE)** without needing any manual refresh.
3. Inspect AI extraction, review the 6-point consistency check, and approve/flag verification items.

---

## 🐳 1-Command Local or Self-Hosted VPS Deployment (Docker Compose)

```bash
# Clone the repository
git clone https://github.com/your-org/progressiq.git
cd progressiq

# Start all services
docker compose up --build -d
```
- Open `http://localhost:3000` on your computer or `http://<your-ip>:3000` from any phone on your local network.
