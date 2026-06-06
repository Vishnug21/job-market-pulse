# Job Market Pulse

A full-stack job market analytics platform that scrapes, stores, and visualizes tech job listings across India's major cities. Built as a portfolio project demonstrating end-to-end data engineering — from automated web scraping to a live analytics dashboard.

---

## Features

**Data Collection**
- Scrapes job listings from **Naukri** and **Internshala** using Selenium
- Covers **14 CS/IT roles** × **4 cities** (Bangalore, Hyderabad, Mumbai, Delhi)
- Bulk scraper mode seeds the database with 500+ jobs in a single run
- JD parser extracts Qualifications, Requirements, and Skills from raw job descriptions
- Smart deduplication — URL-based first, then title + company + source

**Data Quality**
- Validation layer enforces schema integrity before every DB insert
- Salary and location normalization on ingest
- Quality report endpoint flags missing fields, invalid URLs, and cross-source duplicates

**Search & Filters**
- Full-text search across title and company
- Filter by experience level, salary minimum, WFH/remote, posted within N days, applied status
- Sort by recency or alphabetically

**Application Tracker**
- Mark any job as applied — persisted to PostgreSQL
- Filter view to show only pending or already-applied listings

**Analytics API**
- Job count by source, top roles by listing volume, daily scrape trend
- CSV export of the full dataset

**Frontend**
- React UI served via Flask (Babel standalone — no build step)
- Live scrape status polling
- Responsive card layout with filter sidebar

**Deployment**
- Railway-ready: reads `DATABASE_URL` from environment, `DISABLE_SCRAPING` flag disables scraping on production
- Gunicorn for production serving

---

## Tech Stack

| Layer | Technology |
|---|---|
| Web Framework | Flask 3.x |
| Database | PostgreSQL + psycopg2 |
| Scraping | Selenium 4 + webdriver-manager |
| Frontend | React 18 (Babel standalone, no build) |
| Analytics | Power BI (connects to PostgreSQL) |
| Deployment | Railway + Gunicorn |
| Language | Python 3.12 |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Flask App (app.py)                    │
│                                                             │
│   GET /          →  React UI (Babel, no build step)        │
│   POST /search   →  Query PostgreSQL with filters          │
│   POST /scrape   →  Trigger scraper in background thread   │
│   GET  /scrape-status                                       │
│   POST /mark-applied                                        │
│   GET  /api/analytics                                       │
│   GET  /api/export   →  CSV download                       │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │                        │
┌───────▼────────┐    ┌──────────▼─────────┐
│  scraper/      │    │  PostgreSQL         │
│                │    │                     │
│  naukri.py     │    │  jobs table         │
│  Internshala.py│───▶│  ├ id              │
│  jd_parser.py  │    │  ├ title           │
│  validator.py  │    │  ├ company         │
│  db.py         │    │  ├ location        │
└───────▲────────┘    │  ├ salary          │
        │             │  ├ experience      │
┌───────┴────────┐    │  ├ skills          │
│  bulk_scrape.py│    │  ├ job_url         │
│                │    │  ├ source          │
│  14 roles ×    │    │  ├ description     │
│  4 cities ×    │    │  ├ applied         │
│  2 sources     │    │  └ scraped_at      │
└────────────────┘    └──────────┬──────────┘
                                 │
                      ┌──────────▼──────────┐
                      │  Power BI           │
                      │  (PostgreSQL direct │
                      │   connection)       │
                      └─────────────────────┘
```

---

## Project Structure

```
job_market_pulse/
├── app.py                  # Flask routes and API
├── bulk_scrape.py          # Bulk seeding script (14 roles × 4 cities)
├── requirements.txt        # Production dependencies
├── requirements-local.txt  # + Selenium for local scraping
├── Procfile                # Railway/Heroku: gunicorn app:app
├── runtime.txt             # python-3.12
│
├── scraper/
│   ├── naukri.py           # Naukri scraper (two-pass: listings + JD)
│   ├── Internshala.py      # Internshala scraper
│   ├── jd_parser.py        # Extracts qualifications / requirements / skills from JD text
│   ├── validator.py        # Validation, normalization, quality reporting
│   └── db.py               # PostgreSQL connection, save_job(), migrations
│
├── templates/
│   └── index.HTML          # React shell (CDN React + Babel standalone)
│
└── static/
    ├── app.css
    └── app/
        ├── app.jsx
        ├── components.jsx
        ├── screens-main.jsx
        ├── screens-more.jsx
        ├── icons.jsx
        ├── data.jsx
        ├── api.js
        └── realdata.js
```

---

## Setup

### Prerequisites

- Python 3.12
- PostgreSQL (local) or a Railway PostgreSQL instance
- Google Chrome + ChromeDriver (managed automatically by webdriver-manager)

### 1. Clone and install

```bash
git clone https://github.com/your-username/job-market-pulse.git
cd job-market-pulse

python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

pip install -r requirements-local.txt
```

### 2. Configure environment

Create a `.env` file in the project root:

```env
DB_HOST=localhost
DB_NAME=job_market_pulse
DB_USER=postgres
DB_PASSWORD=your_password
DB_PORT=5432
```

### 3. Create the database table

Connect to PostgreSQL and run:

```sql
CREATE DATABASE job_market_pulse;

\c job_market_pulse

CREATE TABLE jobs (
    id          SERIAL PRIMARY KEY,
    title       TEXT NOT NULL,
    company     TEXT NOT NULL,
    location    TEXT,
    experience  TEXT,
    salary      TEXT,
    skills      TEXT,
    job_url     TEXT,
    source      TEXT NOT NULL,
    description TEXT DEFAULT '',
    applied     BOOLEAN DEFAULT FALSE,
    scraped_at  TIMESTAMP DEFAULT NOW()
);
```

### 4. Run the app

```bash
python app.py
```

Open [http://localhost:5000](http://localhost:5000).

### 5. Seed the database (bulk scrape)

```bash
python bulk_scrape.py
```

Scrapes 14 CS/IT roles across Bangalore, Hyderabad, Mumbai, and Delhi from Naukri. Runs with `skip_jd=True` for speed. Expect 400–600 unique jobs. An 8-second cooldown between combinations avoids rate limiting.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | React frontend |
| `POST` | `/search` | Search and filter jobs |
| `POST` | `/scrape` | Trigger a live scrape (background thread) |
| `GET` | `/scrape-status` | Poll scrape progress |
| `POST` | `/mark-applied` | Mark a job as applied |
| `GET` | `/api/analytics` | Aggregated stats (counts, by source, top roles, trend) |
| `GET` | `/api/quality-report` | Data quality metrics |
| `POST` | `/api/deduplicate` | Remove URL duplicates, keep earliest |
| `GET` | `/api/export` | Download full dataset as CSV |

**Search request body:**
```json
{
  "job_role": "Data Analyst",
  "source": "Naukri",
  "filters": {
    "experience": "0-1",
    "salary_min": "500000",
    "work_from_home": false,
    "posted_within": "7",
    "applied": "pending",
    "sort_by": "recent"
  }
}
```

---

## Roles Covered

| Domain | Roles |
|---|---|
| Software Development | Software Engineer, Full Stack Developer, Frontend Developer, Backend Developer, Android Developer |
| Data & Analytics | Data Analyst, Data Scientist, Data Engineer |
| AI / ML | Machine Learning Engineer |
| Infrastructure | DevOps Engineer, Cloud Engineer |
| Quality & Security | QA Engineer, Cybersecurity Analyst |
| Business | Business Analyst |

---

## Deployment on Railway

1. Push to GitHub
2. Create a new Railway project and connect the repository
3. Add a PostgreSQL plugin — Railway injects `DATABASE_URL` automatically
4. Set environment variable: `DISABLE_SCRAPING=true` (Selenium requires a display; scraping is done locally)
5. Railway reads `Procfile` and runs `gunicorn app:app`

The app reads `DATABASE_URL` when present (Railway) and falls back to individual `DB_*` env vars (local dev).

---

## Screenshots

### Dashboard
![Dashboard](screenshots/dashboard.png)
> **1,524 jobs** tracked across 2 sources · Top Hiring Locations bar chart · Jobs by Source donut (Naukri 56% / Internshala 44%) · Top Roles by listing count · Experience Mix breakdown (Fresher / 0–2 yr / 3–5 yr)

---

### Find Jobs
![Find Jobs](screenshots/find-jobs.png)
> Search across **1,524 listings** with real-time filtering by source, experience level, salary, WFH, and applied status. Each card shows title, company, location, experience, salary, and source badge with a one-click Apply button.

---

### Application Pipeline
![Applications](screenshots/applications.png)
> Kanban-style application tracker with **5 stages**: Saved → Applied → Interview → Offer → Rejected. 15 applications tracked across both Naukri and Internshala.

---

### Data Quality
![Data Quality](screenshots/data-quality.png)
> **74% overall completeness** across 1,524 records · **0 duplicate records** · Field completeness breakdown: Valid apply URL 100%, Experience tagged 100%, Description (JD) 100%, Skills extracted 77%, Salary disclosed 22%.

---

### Sources & Scraper Config
![Sources](screenshots/sources.png)
> Scraper health dashboard: Internshala (672 jobs · health 98% · IDLE) and Naukri (852 jobs · health 94%) · Configurable default role, schedule, max jobs per run, and auto-deduplicate settings.

---

## Power BI Dashboard

Connect Power BI Desktop directly to PostgreSQL:

1. **Get Data → PostgreSQL**
2. Host: `localhost` (or Railway host), Database: `job_market_pulse`
3. Import the `jobs` table
4. Build visuals:
   - Jobs by source (bar chart)
   - Salary distribution (histogram)
   - Top roles by listing count (treemap)
   - Location heatmap
   - Daily scrape trend (line chart)
   - Experience level breakdown (donut)
5. Publish to Power BI Service and embed the report URL in the `/reports` page

---

## Design Decisions

**Why Selenium over an API?**
Naukri and Internshala do not offer public job listing APIs. Selenium handles JavaScript-rendered pages and login walls. `webdriver-manager` auto-downloads the matching ChromeDriver version.

**Why Babel standalone instead of a build step?**
This is a portfolio project with a single HTML entry point. Serving JSX via Babel CDN eliminates the need for a Node.js build pipeline while keeping the component code readable and editable.

**Why text-based salary filtering?**
Salary strings from scrapers are heterogeneous ("₹5 LPA", "5-8 LPA", "Not disclosed"). Storing raw text preserves the source data; keyword matching at query time handles the variations without a brittle parsing step.

**Why `scraped_at` as a proxy for posting date?**
Job boards show relative dates ("3 days ago") that are hard to parse reliably across both sources. `scraped_at` is always accurate and sufficient for "posted within N days" filtering in a fresh dataset.

---

## License

MIT
