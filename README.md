# Competitor Monitor

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%7C%20Auth-FFCA28?logo=firebase&logoColor=black)
![OpenAI](https://img.shields.io/badge/OpenAI-gpt--4o--mini-412991?logo=openai&logoColor=white)
![License](https://img.shields.io/badge/license-Portfolio%2FDemo-lightgrey)

AI-powered SaaS platform that monitors competitor websites daily, detects price and product changes, and sends instant alerts via Telegram or Email.

## What it does

You add competitor URLs. Every day at a scheduled time, the system opens each site in a real browser, extracts product data using AI-discovered CSS selectors, compares it with yesterday's snapshot, and — if something changed — sends a Telegram or Email alert with a full summary.

**Real example alert:**

```
Changes detected!

Site: site.com

Summary: Significant price drops on rose bouquets — up to 35% off.

Details:
...
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        FRONTEND                         │
│  React + Vite + Tailwind + Recharts                     │
│  Landing · Login (Google Auth) · Dashboard · History    │
│  Settings (Telegram connect or Email choice)            │
└───────────────────────┬─────────────────────────────────┘
                         │ Firestore (real-time)
┌────────────────────────▼──────────────────────────────────┐
│                       FIREBASE                            │
│  Firestore — sites / snapshots / hashes /                 │
│              selectors / changes / users                  │
│  Auth — Google Sign-In, per-user data isolation           │
└────────────────────────┬──────────────────────────────────┘
                         │ Admin SDK
┌────────────────────────▼──────────────────────────────────┐
│                       BACKEND                             │
│  Python · APScheduler · Playwright · OpenAI               │
│                                                           │
│  main.py ──► discoverer.py ──► scraper.py                 │
│      │                                                    │
│      └──► analyzer.py ──► notifier.py                     │
│                │                                          │
│           firebase_client.py  (all DB operations)         │
└───────────────────────────────────────────────────────────┘
```

## Daily Pipeline

```
Scheduled run — Scheduler fires (APScheduler cron job)
  │
  ├─ For each user → for each monitored site:
  │
  ├─ 1. DISCOVERY (first run only, or forced retry on stale selectors)
  │      Playwright opens site → grabs HTML
  │      BeautifulSoup strips noise (scripts, styles, SVG, comments)
  │      OpenAI identifies CSS selectors for product cards,
  │      names, prices, availability → saved to Firestore
  │
  ├─ 2. SCRAPING
  │      Uses saved selectors → extracts structured JSON:
  │      [{"name": "...", "price": "...", "availability": "..."}]
  │      Falls back to full-page text if selectors fail or return nothing
  │
  ├─ 3. HASH CHECK (cheap pre-filter)
  │      SHA-256 of today's serialized snapshot vs yesterday's
  │      If identical → skip (no OpenAI call, no cost)
  │
  ├─ 4. PRE-DIFF (structured data only)
  │      Compare product lists directly: new items, removed items,
  │      price changes, availability changes
  │      If nothing changed → skip AI entirely
  │
  ├─ 5. AI ANALYSIS
  │      Sends both snapshots to gpt-4o-mini
  │      Returns: has_changes, summary, red_flags[]
  │
  ├─ 6. SAVE + ALERT
  │      Change saved to Firestore → visible on the History page
  │      Alert sent via Telegram or Email (per user's preference)
  │
  └─ Repeat for next site
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Recharts |
| Auth | Firebase Authentication (Google Sign-In) |
| Database | Cloud Firestore |
| Scraping | Playwright (Chromium, headless) |
| HTML parsing | BeautifulSoup4 |
| AI | OpenAI API (gpt-4o-mini) |
| Email | Resend API |
| Alerts | Telegram Bot API |
| Scheduler | APScheduler (cron) |
| Language | Python 3.11+, JavaScript (React) |

## Key Engineering Decisions

**SHA-256 hash as a pre-filter** — before calling OpenAI, the system computes a hash of today's scraped content and compares it to yesterday's. If identical, the AI call is skipped entirely, eliminating unnecessary API costs when a page hasn't changed.

**AI-powered selector discovery** — instead of hardcoding CSS selectors per site (which breaks whenever a site redesigns), the system sends cleaned HTML to OpenAI once per site and asks it to find the right selectors. Selectors are stored in Firestore and reused every day. If a site redesigns and scraping starts failing, discovery reruns automatically.

**Structured JSON scraping** — the scraper returns `list[dict]` instead of raw text. This enables a second pre-filter: direct product comparison before AI (`find_changed_products`). Only changed products are sent to the AI, not the full catalog.

**Firebase as a message broker** — the Telegram connection flow uses Firestore as a relay: the frontend generates a unique token → the user opens the bot with that token → the bot saves `{token: chat_id}` to Firestore → a frontend `onSnapshot` listener picks it up automatically. No polling, no shared state between the frontend and the bot process.

**Per-user data isolation** — every Firestore document includes a `userId`. Security Rules enforce that users can only read/write their own data. The backend reads `userId` from each site document and sends alerts to that user's personal Telegram or Email.

**Soft delete** — when a user removes a site, the document is marked `active: false` instead of being deleted, preserving change history for the History page.

## Project Structure

```
competitor-monitor/
├── backend/
│   ├── main.py              # Orchestrator + APScheduler
│   ├── discoverer.py        # AI-powered CSS selector discovery
│   ├── scraper.py           # Playwright scraper (structured + fallback)
│   ├── analyzer.py          # OpenAI comparison + pre-diff logic
│   ├── notifier.py          # Telegram + Email alert dispatch
│   ├── firebase_client.py   # All Firestore read/write operations
│   └── bot.py                # Telegram bot (handles /start + token flow)
│
└── frontend/
    └── src/
        ├── pages/
        │   ├── Landing.jsx    # Public marketing page
        │   ├── Login.jsx      # Google Sign-In
        │   ├── Dashboard.jsx  # Site management + charts
        │   ├── History.jsx    # Change timeline + activity charts
        │   └── Settings.jsx   # Notification preferences
        └── components/
            ├── Layout.jsx      # Sidebar navigation
            └── ThemeToggle.jsx
```

## Features

- **Multi-user SaaS** — each user has isolated data, their own Telegram/Email alerts, and a personal dashboard
- **AI selector discovery** — works on any website without manual configuration
- **Dual notification channels** — Telegram (instant) or Email via Resend
- **Activity charts** — Recharts visualizations showing changes over time, per site and overall
- **Free plan** — a limited number of monitored sites with daily scans
- **One-click Telegram connect** — deep-link flow, no manual Chat ID entry

## Setup (run locally)

### Prerequisites

- Python 3.11+
- Node.js 18+
- A Firebase project (Authentication + Firestore enabled)
- An OpenAI API key
- A Telegram bot token (via [@BotFather](https://t.me/BotFather)) and/or a Resend API key for Email alerts

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
```

Create a `.env` file in `backend/` (see [Environment Variables](#environment-variables) below), then run:

```bash
python main.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Create a `.env` file in `frontend/` with your Firebase Web SDK config (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, etc. — see your Firebase project settings).

### Environment Variables

> Names below match what's used in `main.py` / `discoverer.py` / `analyzer.py`. Double-check the exact variable names your `firebase_client.py`, `notifier.py`, and `bot.py` expect before deploying — this list covers what's confirmed from the modules shown here.

| Variable | Used in | Description |
|---|---|---|
| `OPENAI_API_KEY` | `discoverer.py`, `analyzer.py` | OpenAI API key |
| `OPENAI_DISCOVERY_MODEL` | `discoverer.py` | Model for selector discovery (default: `gpt-4o-mini`) |
| `OPENAI_MODEL` | `analyzer.py` | Model for change analysis (default: `gpt-4o-mini`) |
| `CRON_HOUR` / `CRON_MINUTE` | `main.py` | Daily scan time (default: `8` / `1`) |
| `CRON_TIMEZONE` | `main.py` | Scheduler timezone (default: `UTC`) |
| `TELEGRAM_BOT_TOKEN` | `bot.py`, `notifier.py` | Telegram Bot API token |
| `RESEND_API_KEY` | `notifier.py` | Resend API key for Email alerts |
| Firebase credentials | `firebase_client.py` | Service account JSON / `GOOGLE_APPLICATION_CREDENTIALS` path |

### Before making the repo public (one-time)

If any secrets were ever committed, remove them from Git tracking (they stay on disk but won't be pushed):

```bash
git rm --cached backend/.env 2>/dev/null || true
git rm --cached backend/firebase-service-account.json 2>/dev/null || true
git rm --cached frontend/.env 2>/dev/null || true
git commit -m "chore: stop tracking sensitive config files"
```

Then make sure `.gitignore` covers `.env`, `.env.*`, and your Firebase service account file before pushing.

## License

This project is for portfolio/demo use. If you reuse it, respect the OpenAI, Firebase, and other third-party API terms of service.

## Contact

For questions about this project, open an issue or reach out via the contact details in the GitHub profile.
